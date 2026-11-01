import 'server-only'
import type { LanguageModel, ModelMessage } from 'ai'
import { and, count, eq, gte, lt, sql } from 'drizzle-orm'
import type * as z from 'zod'
import type { AiPurpose, AiRunStatus } from '@/features/quota/schemas'
import { ApiError } from '@/server/api/errors'
import { loadAccountState } from '@/server/auth/account-state'
import { checkAccount } from '@/server/auth/guards'
import { db, type Tx } from '@/server/db/client'
import { aiDailySpend, aiRuns, quotaLedger } from '@/server/db/schema'
import { maybeAlert } from '@/server/quota/alerts'
import { getBalance, type Reservation, release, reserve, settle } from '@/server/quota/ledger'
import { quotaPeriodKey, spendDayKey } from '@/server/quota/period'
import { getSettings } from '@/server/settings'
import { callModel, type CallModelResult } from './call-model'
import { getFlashModel, hashedUserId, isAiConfigured } from './model'
import { costMicros, reserveMicros } from './pricing'
import { reservationFromLedger, withRetry } from './recovery'

/*
 * 所有 AI 调用的唯一入口（ai-and-quota.md 第 3 节）。签名 F1，实现 P1。
 * 流程：检查（封号、暂停、日上限、并发与频率）→ 预占 → 调用 → 结算或释放 → 写 ai_runs。
 * 不记录 prompt 正文、用户输入、模型输出和图片。
 * 模型调用部分在 call-model.ts（MockLanguageModelV4 测成功、报错、校验失败、超时）。
 */

/** prompts/<purpose>.ts 导出的定义（ai-and-quota.md 第 7 节）。D6 写具体 prompt */
export interface PromptDef<P extends AiPurpose, S extends z.ZodType> {
  id: P
  /** 改 prompt 必须加一 */
  version: number
  /** 中文；不放用户数据 */
  system: string
  /** 输出 schema：模型输出先过它校验，失败算识别失败 */
  schema: S
  /** 预占上限的依据，必填 */
  maxOutputTokens: number
  /** 必须显式声明；结构化识别用 disabled */
  thinking: { type: 'enabled' | 'disabled' }
  /** 预估输入 tokens（含图片），用于预占 */
  estimatedInputTokens: number
  /** 超时（毫秒），默认 30 秒 */
  timeoutMs?: number
}

export interface RunAiInput<P extends AiPurpose, S extends z.ZodType> {
  prompt: PromptDef<P, S>
  userId: string
  ip: string
  /** 请求的 idempotency-key：预占与结算共用 */
  idempotencyKey: string
  /** user message（图片作为 file part 放在这里） */
  messages: ModelMessage[]
  /** 测试注入；默认 getFlashModel() */
  model?: LanguageModel
  now?: Date
}

export type RunAiResult<S extends z.ZodType> =
  | { ok: true; aiRunId: string; output: z.infer<S>; costMicros: number }
  /** 校验失败或超时：已产生的费用照常结算；调用方映射为 422 AI_RECOGNITION_FAILED（带 aiRunId） */
  | {
      ok: false
      aiRunId: string
      reason: 'invalid-output' | 'timeout' | 'failed'
      costMicros: number
    }

/** 进行中的调用超过这个时长视为卡死（进程重启留下的 running 行），不再计入并发 */
const STALE_RUNNING_MS = 5 * 60_000
/** 单人单日花费告警阈值（ADR-0002 第 7 节）：5 元 */
const USER_DAILY_SPEND_ALERT_MICROS = 5_000_000

/** 结算事务的重试次数与间隔（毫秒，第 n 次等 n 倍） */
const SETTLE_ATTEMPTS = 3
const SETTLE_RETRY_DELAY_MS = 200
/** 每次对账最多处理的卡死调用数 */
const RECONCILE_BATCH = 20

const pausedError = (detail: string) => new ApiError('AI_PAUSED', detail)

/** 今日全站花费（北京时间日期键） */
async function spentToday(dayKey: string): Promise<number> {
  const [row] = await db
    .select({ spent: aiDailySpend.spentMicros })
    .from(aiDailySpend)
    .where(eq(aiDailySpend.dayKey, dayKey))
  return row?.spent ?? 0
}

/** 第 1 步：检查。不满足直接抛 ApiError，不调用模型、不写 ai_runs */
async function preflight(userId: string, now: Date, dayKey: string) {
  const state = await loadAccountState(userId)
  const accountError = checkAccount(state, now)
  if (accountError) throw accountError

  const settings = await getSettings()
  if (!isAiConfigured()) throw pausedError('DEEPSEEK_API_KEY 未配置')
  if (settings.aiPaused) throw pausedError('管理员已手动暂停 AI')
  const spent = await spentToday(dayKey)
  if (spent >= settings.dailySpendCapMicros) {
    void maybeAlert('daily-cap-reached', dayKey, {
      spentMicros: spent,
      capMicros: settings.dailySpendCapMicros,
    })
    throw pausedError('今日全站 AI 花费已达上限')
  }
  return settings
}

/** 并发与频率：在持有额度行锁的事务里数，同一用户的请求在这里串行 */
async function checkUserLimits(
  tx: Tx,
  userId: string,
  now: Date,
  limits: { aiConcurrency: number; aiHourlyLimit: number },
  dayKey: string,
) {
  const [running] = await tx
    .select({ n: count() })
    .from(aiRuns)
    .where(
      and(
        eq(aiRuns.userId, userId),
        eq(aiRuns.status, 'running'),
        gte(aiRuns.createdAt, new Date(now.getTime() - STALE_RUNNING_MS)),
      ),
    )
  if ((running?.n ?? 0) >= limits.aiConcurrency) {
    throw new ApiError('RATE_LIMITED', '进行中的 AI 调用太多', { retryAfterSeconds: 10 })
  }
  const [hourly] = await tx
    .select({ n: count() })
    .from(aiRuns)
    .where(
      and(eq(aiRuns.userId, userId), gte(aiRuns.createdAt, new Date(now.getTime() - 3_600_000))),
    )
  if ((hourly?.n ?? 0) >= limits.aiHourlyLimit) {
    void maybeAlert('user-hourly-calls', dayKey, { userId, calls: hourly?.n ?? 0 })
    throw new ApiError('RATE_LIMITED', '一小时内 AI 调用次数太多', { retryAfterSeconds: 600 })
  }
}

/**
 * 执行一次 AI 调用。检查不通过时抛 ApiError：403 ACCOUNT_BANNED、503 AI_PAUSED、
 * 429 RATE_LIMITED、402 QUOTA_INSUFFICIENT（不调用模型、不写 ai_runs）。
 */
export async function runAi<P extends AiPurpose, S extends z.ZodType>(
  input: RunAiInput<P, S>,
): Promise<RunAiResult<S>> {
  const { prompt, userId } = input
  const now = input.now ?? new Date()
  const dayKey = spendDayKey(now)
  const settings = await preflight(userId, now, dayKey)

  // 第 2 步：预占。额度行锁 → 对账卡死的调用 → 幂等键查重 → 并发 / 频率 → 写 running 的 ai_runs → 预占；
  // 任一步失败整个回滚。额度行锁让同一用户的这些步骤串行
  const reservedAmount = reserveMicros(prompt.estimatedInputTokens, prompt.maxOutputTokens)
  const { aiRunId, reservation } = await db.transaction(async (tx) => {
    await getBalance(tx, userId, now)
    await reconcileStaleRuns(tx, userId, now)
    await rejectReusedKey(tx, userId, input.idempotencyKey)
    await checkUserLimits(tx, userId, now, settings, dayKey)
    const [run] = await tx
      .insert(aiRuns)
      .values({
        userId,
        ip: input.ip,
        purpose: prompt.id,
        promptVersion: prompt.version,
        status: 'running',
        reservedMicros: reservedAmount,
        dayKey,
        idempotencyKey: input.idempotencyKey,
      })
      .returning({ id: aiRuns.id })
    if (!run) throw new Error('写 ai_runs 失败')
    const r = await reserve(
      tx,
      userId,
      reservedAmount,
      { aiRunId: run.id, idempotencyKey: input.idempotencyKey },
      now,
    )
    return { aiRunId: run.id, reservation: r }
  })

  // 第 3 步：调用。callModel 本身不抛错；这里兜住取模型、算哈希这类意外，按失败处理并释放预占
  const startedAt = Date.now()
  let result: CallModelResult<S>
  try {
    result = await callModel({
      model: input.model ?? getFlashModel(),
      system: prompt.system,
      schema: prompt.schema,
      maxOutputTokens: prompt.maxOutputTokens,
      thinking: prompt.thinking,
      messages: input.messages,
      userIdHash: await hashedUserId(userId),
      timeoutMs: prompt.timeoutMs,
    })
  } catch (error) {
    console.error('[ai] 调用前置步骤失败', error instanceof Error ? error.name : typeof error)
    result = { kind: 'failed', usage: { inputMissTokens: 0, inputHitTokens: 0, outputTokens: 0 } }
  }
  const latencyMs = Date.now() - startedAt
  const cost = costMicros(result.usage)
  const status: AiRunStatus = result.kind === 'ok' ? 'succeeded' : result.kind
  const outcome: RunOutcome = { status, usage: result.usage, cost, latencyMs }

  // 第 4–6 步：结算或释放、全站日花费、写回 ai_runs。失败重试；仍失败时把用量单独记到 ai_runs 上，
  // 行保持 running，由这个用户下一次调用前的对账按记下的费用结算。
  // 模型已经花了钱，不能抛出可重试的 500（同键重试会再预占、再调一次模型）
  try {
    await withRetry(
      () =>
        db.transaction(async (tx) => {
          const at = new Date()
          await getBalance(tx, userId, at)
          await finishRun(tx, { userId, dayKey, reservation, outcome, now: at })
        }),
      { attempts: SETTLE_ATTEMPTS, delayMs: SETTLE_RETRY_DELAY_MS },
    )
  } catch (error) {
    console.error('[ai] 结算失败，留给对账', error instanceof Error ? error.message : error)
    await recordPendingUsage(aiRunId, outcome)
  }

  if (cost > 0) void afterSpend(userId, dayKey, settings.dailySpendCapMicros)

  if (result.kind === 'ok') return { ok: true, aiRunId, output: result.output, costMicros: cost }
  return { ok: false, aiRunId, reason: result.kind, costMicros: cost }
}

interface RunOutcome {
  status: AiRunStatus
  usage: CallModelResult<z.ZodType>['usage']
  cost: number
  latencyMs: number
}

/**
 * 结算一次调用：按费用结算或全额释放、累加全站日花费、写回 ai_runs。调用方已持有额度行锁。
 * 退款金额从这次调用的流水还原；已经结算过（另一路抢先）就只补写 ai_runs，不再退一次。
 */
async function finishRun(
  tx: Tx,
  args: {
    userId: string
    dayKey: string
    reservation: Reservation
    outcome: RunOutcome
    now: Date
  },
): Promise<void> {
  const { userId, dayKey, reservation, outcome, now } = args
  const ledger = await tx
    .select({
      kind: quotaLedger.kind,
      bucket: quotaLedger.bucket,
      amountMicros: quotaLedger.amountMicros,
    })
    .from(quotaLedger)
    .where(eq(quotaLedger.aiRunId, reservation.aiRunId))
  const pending = reservationFromLedger(ledger)
  if (pending) {
    const r: Reservation = { ...reservation, ...pending }
    if (outcome.cost > 0) await settle(tx, userId, r, outcome.cost, now)
    else await release(tx, userId, r, now)
    if (outcome.cost > 0) {
      await tx
        .insert(aiDailySpend)
        .values({ dayKey, spentMicros: outcome.cost })
        .onConflictDoUpdate({
          target: aiDailySpend.dayKey,
          set: { spentMicros: sql`${aiDailySpend.spentMicros} + ${outcome.cost}`, updatedAt: now },
        })
    }
  }
  await tx
    .update(aiRuns)
    .set({
      status: outcome.status,
      inputMissTokens: outcome.usage.inputMissTokens,
      inputHitTokens: outcome.usage.inputHitTokens,
      outputTokens: outcome.usage.outputTokens,
      costMicros: outcome.cost,
      latencyMs: outcome.latencyMs,
      updatedAt: now,
    })
    .where(eq(aiRuns.id, reservation.aiRunId))
}

/** 结算彻底失败时单独记下用量和费用（行仍是 running），对账按它结算。再失败只记日志 */
async function recordPendingUsage(aiRunId: string, outcome: RunOutcome): Promise<void> {
  try {
    await db
      .update(aiRuns)
      .set({
        inputMissTokens: outcome.usage.inputMissTokens,
        inputHitTokens: outcome.usage.inputHitTokens,
        outputTokens: outcome.usage.outputTokens,
        costMicros: outcome.cost,
        latencyMs: outcome.latencyMs,
        updatedAt: new Date(),
      })
      .where(and(eq(aiRuns.id, aiRunId), eq(aiRuns.status, 'running')))
  } catch (error) {
    console.error('[ai] 记录待结算用量失败', error instanceof Error ? error.message : error)
  }
}

/**
 * 对账：这个用户 running 超过 STALE_RUNNING_MS 的调用（结算失败、进程重启留下的）按记下的费用结算，
 * 没记下费用的全额释放，状态改为 failed。在持有额度行锁的预占事务里执行（懒对账，不需要定时任务）。
 */
export async function reconcileStaleRuns(tx: Tx, userId: string, now: Date): Promise<void> {
  const stale = await tx
    .select({
      id: aiRuns.id,
      dayKey: aiRuns.dayKey,
      idempotencyKey: aiRuns.idempotencyKey,
      costMicros: aiRuns.costMicros,
      inputMissTokens: aiRuns.inputMissTokens,
      inputHitTokens: aiRuns.inputHitTokens,
      outputTokens: aiRuns.outputTokens,
      latencyMs: aiRuns.latencyMs,
      createdAt: aiRuns.createdAt,
    })
    .from(aiRuns)
    .where(
      and(
        eq(aiRuns.userId, userId),
        eq(aiRuns.status, 'running'),
        lt(aiRuns.createdAt, new Date(now.getTime() - STALE_RUNNING_MS)),
      ),
    )
    .limit(RECONCILE_BATCH)
  for (const run of stale) {
    await finishRun(tx, {
      userId,
      dayKey: run.dayKey,
      // 金额由 finishRun 从流水还原；这里只给关联键和预占时的周期（跨周时本周部分不退）
      reservation: {
        aiRunId: run.id,
        idempotencyKey: run.idempotencyKey ?? '',
        weeklyMicros: 0,
        bonusMicros: 0,
        periodKey: quotaPeriodKey(run.createdAt),
      },
      outcome: {
        status: 'failed',
        usage: {
          inputMissTokens: run.inputMissTokens,
          inputHitTokens: run.inputHitTokens,
          outputTokens: run.outputTokens,
        },
        cost: run.costMicros,
        latencyMs: run.latencyMs,
      },
      now,
    })
  }
}

/**
 * 同一个幂等键已经有过一次调用（例如中途出错后客户端用同一个键重试）：不再预占、不再调模型。
 * 进行中返回 409 REQUEST_IN_PROGRESS，已结束返回 409 IDEMPOTENCY_KEY_REUSED（幂等中间件会记住）。
 */
async function rejectReusedKey(tx: Tx, userId: string, idempotencyKey: string): Promise<void> {
  const [existing] = await tx
    .select({ status: aiRuns.status })
    .from(aiRuns)
    .where(and(eq(aiRuns.userId, userId), eq(aiRuns.idempotencyKey, idempotencyKey)))
    .limit(1)
  if (!existing) return
  if (existing.status === 'running') {
    throw new ApiError('REQUEST_IN_PROGRESS', '同一个请求还在处理中')
  }
  throw new ApiError('IDEMPOTENCY_KEY_REUSED', '这个请求已经处理过')
}

/** 花费后的告警检查：全站日上限、单人单日 5 元。失败只记日志 */
async function afterSpend(userId: string, dayKey: string, capMicros: number): Promise<void> {
  try {
    const spent = await spentToday(dayKey)
    if (spent >= capMicros) {
      await maybeAlert('daily-cap-reached', dayKey, { spentMicros: spent, capMicros })
    }
    const [mine] = await db
      .select({ total: sql<number>`coalesce(sum(${aiRuns.costMicros}), 0)::bigint` })
      .from(aiRuns)
      .where(and(eq(aiRuns.userId, userId), eq(aiRuns.dayKey, dayKey)))
    const total = Number(mine?.total ?? 0)
    if (total > USER_DAILY_SPEND_ALERT_MICROS) {
      await maybeAlert('user-daily-spend', dayKey, { userId, spentMicros: total })
    }
  } catch (error) {
    console.error('[ai] 花费告警检查失败', error instanceof Error ? error.message : error)
  }
}
