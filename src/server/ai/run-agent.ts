import 'server-only'
import {
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from 'ai'
import { db } from '@/server/db/client'
import { aiRuns } from '@/server/db/schema'
import { getBalance, reserve, type Reservation } from '@/server/quota/ledger'
import { spendDayKey } from '@/server/quota/period'
import { getFlashModel, hashedUserId } from './model'
import { costMicros, reserveMicros, usageFromSdk, type TokenUsage } from './pricing'
import { withRetry } from './recovery'
import {
  afterSpend,
  checkUserLimits,
  finishRun,
  preflight,
  reconcileStaleRuns,
  recordPendingUsage,
  rejectReusedKey,
  SETTLE_ATTEMPTS,
  SETTLE_RETRY_DELAY_MS,
  type RunOutcome,
} from './run'
import { buildAgent, MAX_OUTPUT_TOKENS_PER_STEP, MAX_STEPS } from './agent'
import { MAX_SEARCHES_PER_TURN, SEARCH_FETCH_COST_MICROS, type SearchBudget } from './agent-tools'
import {
  ensureConversation,
  loadMessages,
  saveMessages,
  stripFileParts,
  titleFromFirstUserText,
  touchConversation,
} from '@/server/services/agent/conversations'
import type { AiRunStatus } from '@/features/quota/schemas'

/*
 * Agent 对话的额度记账（ai-and-quota.md 第 3 节）。和 runAi 同一套账本：
 * 预占（token 上限 + 联网次数上限）→ ToolLoopAgent 流式 → 按实际 token + 联网次数结算 / 失败释放。
 * 预占比单次调用大（多步循环），所以 maxOutputTokens 按 MAX_STEPS × 单步上限算。
 */

const AGENT_PROMPT_VERSION = 1

const ZERO_USAGE: TokenUsage = { inputMissTokens: 0, inputHitTokens: 0, outputTokens: 0 }

type Settings = Awaited<ReturnType<typeof preflight>>

export interface ReservedAgentRun {
  aiRunId: string
  reservation: Reservation
  settings: Settings
  dayKey: string
}

/** 粗略估计输入 tokens：字符数 / 2 + 每步工具结果余量。宁可高估（预占安全，结算多退） */
export function estimateAgentInputTokens(messages: readonly UIMessage[]): number {
  let chars = 0
  for (const m of messages) {
    for (const p of m.parts) {
      if (typeof p === 'object' && p !== null && 'text' in p && typeof p.text === 'string') {
        chars += p.text.length
      }
    }
  }
  return Math.ceil(chars / 2) + MAX_STEPS * 2000
}

async function reserveAgentRun(input: {
  userId: string
  ip: string
  idempotencyKey: string
  estimatedInputTokens: number
  now: Date
}): Promise<ReservedAgentRun> {
  const dayKey = spendDayKey(input.now)
  const settings = await preflight(input.userId, input.now, dayKey)
  const tokenReserve = reserveMicros(
    input.estimatedInputTokens,
    MAX_STEPS * MAX_OUTPUT_TOKENS_PER_STEP,
  )
  const searchReserve = MAX_SEARCHES_PER_TURN * SEARCH_FETCH_COST_MICROS
  const reservedAmount = tokenReserve + searchReserve
  const { aiRunId, reservation } = await db.transaction(async (tx) => {
    await getBalance(tx, input.userId, input.now)
    await reconcileStaleRuns(tx, input.userId, input.now)
    await rejectReusedKey(tx, input.userId, input.idempotencyKey)
    await checkUserLimits(tx, input.userId, input.now, settings, dayKey)
    const [run] = await tx
      .insert(aiRuns)
      .values({
        userId: input.userId,
        ip: input.ip,
        purpose: 'agent-chat',
        promptVersion: AGENT_PROMPT_VERSION,
        status: 'running',
        reservedMicros: reservedAmount,
        dayKey,
        idempotencyKey: input.idempotencyKey,
      })
      .returning({ id: aiRuns.id })
    if (!run) throw new Error('写 ai_runs 失败')
    const r = await reserve(
      tx,
      input.userId,
      reservedAmount,
      { aiRunId: run.id, idempotencyKey: input.idempotencyKey },
      input.now,
    )
    return { aiRunId: run.id, reservation: r }
  })
  return { aiRunId, reservation, settings, dayKey }
}

async function settleAgentRun(input: {
  userId: string
  dayKey: string
  reservation: Reservation
  usage: TokenUsage
  searchCostMicros: number
  latencyMs: number
  status: AiRunStatus
  settings: Settings
}): Promise<void> {
  const cost = costMicros(input.usage) + input.searchCostMicros
  const outcome: RunOutcome = {
    status: input.status,
    usage: input.usage,
    cost,
    latencyMs: input.latencyMs,
  }
  try {
    await withRetry(
      () =>
        db.transaction(async (tx) => {
          const at = new Date()
          await getBalance(tx, input.userId, at)
          await finishRun(tx, {
            userId: input.userId,
            dayKey: input.dayKey,
            reservation: input.reservation,
            outcome,
            now: at,
          })
        }),
      { attempts: SETTLE_ATTEMPTS, delayMs: SETTLE_RETRY_DELAY_MS },
    )
  } catch (error) {
    console.error('[ai] agent 结算失败，留给对账', error instanceof Error ? error.message : error)
    await recordPendingUsage(input.reservation.aiRunId, outcome)
  }
  if (cost > 0) void afterSpend(input.userId, input.dayKey, input.settings.dailySpendCapMicros)
}

export interface StreamAgentChatInput {
  userId: string
  ip: string
  idempotencyKey: string
  conversationId: string
  /** 已含新用户消息的完整 UI 消息序列 */
  messages: UIMessage[]
  deepThink: boolean
  now?: Date
}

/**
 * 流式执行一轮 Agent 对话，返回 UI message stream 的 HTTP Response。
 * 会话不存在时创建；消息在 onEnd 持久化（图片已换成文字说明）；额度在后台按实际用量结算。
 */
export async function streamAgentChat(input: StreamAgentChatInput): Promise<Response> {
  const now = input.now ?? new Date()
  const userIdHash = await hashedUserId(input.userId)
  const search: SearchBudget = { used: 0, costMicros: 0 }

  // 预占在流式开始前完成：额度不足 / 封号 / 暂停 / 并发超限都直接抛 ApiError（由根 onError 转 JSON）
  const reserved = await reserveAgentRun({
    userId: input.userId,
    ip: input.ip,
    idempotencyKey: input.idempotencyKey,
    estimatedInputTokens: estimateAgentInputTokens(input.messages),
    now,
  })

  const firstUserText = firstUserTextOf(input.messages)
  await ensureConversation(
    db,
    input.userId,
    input.conversationId,
    titleFromFirstUserText(firstUserText),
    now,
  )
  await touchConversation(db, input.userId, input.conversationId, now)

  const agent = buildAgent({
    model: getFlashModel(),
    userId: input.userId,
    userIdHash,
    deepThink: input.deepThink,
    search,
    now,
  })

  const startedAt = Date.now()
  const result = await agent.stream({
    messages: await convertToModelMessages(input.messages),
  })
  // 客户端断开也不影响模型跑完与结算（ai-and-quota.md：流式中断按已产生用量结算）
  result.consumeStream()

  const response = createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: input.messages,
      generateMessageId: createIdGenerator({ prefix: 'amsg', size: 16 }),
      onEnd: async ({ messages }) => {
        await saveMessages(
          db,
          input.userId,
          input.conversationId,
          messages.map((m) => ({
            messageId: m.id,
            role: m.role === 'user' ? 'user' : 'assistant',
            parts: stripFileParts(m.parts as unknown[]),
            createdAt: (m as { createdAt?: Date }).createdAt ?? now,
          })),
        )
      },
    }),
  })

  // 后台结算：按实际 token 用量 + 联网次数
  void (async () => {
    try {
      const usage = await result.usage
      await settleAgentRun({
        userId: input.userId,
        dayKey: reserved.dayKey,
        reservation: reserved.reservation,
        usage: usageFromSdk(usage),
        searchCostMicros: search.costMicros,
        latencyMs: Date.now() - startedAt,
        status: 'succeeded',
        settings: reserved.settings,
      })
    } catch (error) {
      console.error('[ai] agent 流式失败或中止', error instanceof Error ? error.name : typeof error)
      await settleAgentRun({
        userId: input.userId,
        dayKey: reserved.dayKey,
        reservation: reserved.reservation,
        usage: ZERO_USAGE,
        searchCostMicros: search.costMicros,
        latencyMs: Date.now() - startedAt,
        status: 'failed',
        settings: reserved.settings,
      })
    }
  })()

  return response
}

/** 取第一条用户消息的纯文本（生成会话标题用） */
function firstUserTextOf(messages: readonly UIMessage[]): string {
  for (const m of messages) {
    if (m.role !== 'user') continue
    for (const p of m.parts) {
      if (typeof p === 'object' && p !== null && p.type === 'text' && typeof p.text === 'string') {
        return p.text
      }
    }
  }
  return ''
}

/** 供路由读取历史：加载会话消息 */
export async function loadConversationMessages(
  userId: string,
  conversationId: string,
): Promise<UIMessage[]> {
  const stored = await loadMessages(db, userId, conversationId)
  return stored.map((m) => ({
    id: m.id,
    role: m.role,
    parts: m.parts,
    createdAt: m.createdAt,
  })) as unknown as UIMessage[]
}
