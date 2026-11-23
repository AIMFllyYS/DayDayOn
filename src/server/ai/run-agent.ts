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
import { AGENT_RESERVE_OUTPUT_TOKENS, buildAgent, DEEP_THINK_RESERVE_OUTPUT_TOKENS } from './agent'
import { MAX_SEARCHES_PER_TURN, SEARCH_FETCH_COST_MICROS, type SearchBudget } from './agent-tools'
import {
  ensureConversation,
  loadMessages,
  saveMessages,
  stripFileParts,
  titleFromFirstUserText,
  touchConversation,
} from '@/server/services/agent/conversations'
import { loadPetName } from '@/server/services/agent/pet-name'
import { loadClock } from '@/server/services/checkins/clock'
import type { AiRunStatus } from '@/features/quota/schemas'

/*
 * Agent 对话的额度记账（ai-and-quota.md 第 3 节）。和 runAi 同一套账本：
 * 预占（整轮输出高分位估算 + 联网次数上限）→ ToolLoopAgent 流式 → 按实际 token + 联网次数结算 / 失败释放。
 */

const AGENT_PROMPT_VERSION = 3

const ZERO_USAGE: TokenUsage = { inputMissTokens: 0, inputHitTokens: 0, outputTokens: 0 }
/** 多步工具结果上下文的预占余量（按实际高分位预留，避免单步与步数大幅放宽后误触发 402） */
const AGENT_TOOL_CONTEXT_INPUT_RESERVE = 30_000

type Settings = Awaited<ReturnType<typeof preflight>>

export interface ReservedAgentRun {
  aiRunId: string
  reservation: Reservation
  settings: Settings
  dayKey: string
}

const ESTIMATED_TOKENS_PER_IMAGE = 1600
const IMAGE_ONLY_DEFAULT_PROMPT =
  '请查看并识别我上传的照片内容；如果是饮食、运动、睡眠、学习等打卡相关内容，请查好对应事实并生成打卡草稿供我确认。'

/** 粗略估计输入 tokens：字符数 / 2 + 图片视觉余量 + 每步工具结果余量。宁可高估（预占安全，结算多退） */
export function estimateAgentInputTokens(messages: readonly UIMessage[]): number {
  let chars = 0
  let imageTokens = 0
  for (const m of messages) {
    for (const p of m.parts) {
      if (typeof p === 'object' && p !== null) {
        if ('text' in p && typeof p.text === 'string') {
          chars += p.text.length
        } else if ('type' in p && (p as { type?: unknown }).type === 'file') {
          imageTokens += ESTIMATED_TOKENS_PER_IMAGE
        }
      }
    }
  }
  return Math.ceil(chars / 2) + imageTokens + AGENT_TOOL_CONTEXT_INPUT_RESERVE
}

/** 过滤历史与落库中空的助手消息（流式启动前报错产生的空 parts 行，防止堆积与污染对话） */
export function filterEmptyAssistantMessages<T extends { role: string; parts: readonly unknown[] }>(
  messages: readonly T[],
): T[] {
  return messages.filter((m) => m.role !== 'assistant' || m.parts.length > 0)
}

/** 当用户仅发送图片未输入任何文字时，仅在发往模型的消息副本中补一句识图引导语（不写入数据库） */
export function withImageFallbackPrompt(messages: readonly UIMessage[]): UIMessage[] {
  return messages.map((m) => {
    if (m.role !== 'user') return m
    const hasFile = m.parts.some(
      (p) => typeof p === 'object' && p !== null && (p as { type?: unknown }).type === 'file',
    )
    if (!hasFile) return m
    const hasNonEmptyText = m.parts.some(
      (p) =>
        typeof p === 'object' &&
        p !== null &&
        p.type === 'text' &&
        typeof (p as { text?: unknown }).text === 'string' &&
        (p as { text: string }).text.trim().length > 0,
    )
    if (hasNonEmptyText) return m
    return {
      ...m,
      parts: [...m.parts, { type: 'text', text: IMAGE_ONLY_DEFAULT_PROMPT }],
    }
  })
}

export async function reserveAgentRun(input: {
  userId: string
  ip: string
  idempotencyKey: string
  estimatedInputTokens: number
  now: Date
  /** 默认 Agent 对话；裁判传 'referee' 和自己的上限 */
  purpose?: 'agent-chat' | 'referee'
  promptVersion?: number
  maxOutputTokens?: number
  maxSearches?: number
}): Promise<ReservedAgentRun> {
  const dayKey = spendDayKey(input.now)
  const settings = await preflight(input.userId, input.now, dayKey)
  const tokenReserve = reserveMicros(
    input.estimatedInputTokens,
    input.maxOutputTokens ?? AGENT_RESERVE_OUTPUT_TOKENS,
  )
  const searchReserve = (input.maxSearches ?? MAX_SEARCHES_PER_TURN) * SEARCH_FETCH_COST_MICROS
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
        purpose: input.purpose ?? 'agent-chat',
        promptVersion: input.promptVersion ?? AGENT_PROMPT_VERSION,
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

export async function settleAgentRun(input: {
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
    maxOutputTokens: input.deepThink
      ? DEEP_THINK_RESERVE_OUTPUT_TOKENS
      : AGENT_RESERVE_OUTPUT_TOKENS,
    now,
  })

  const startedAt = Date.now()
  let petName = '团团'
  let agent: ReturnType<typeof buildAgent>
  let result: Awaited<ReturnType<ReturnType<typeof buildAgent>['stream']>>
  try {
    const firstUserText = firstUserTextOf(input.messages)
    await ensureConversation(
      db,
      input.userId,
      input.conversationId,
      titleFromFirstUserText(firstUserText),
      now,
    )
    await touchConversation(db, input.userId, input.conversationId, now)

    const [clock, loadedPetName] = await Promise.all([
      loadClock(db, input.userId),
      loadPetName(db, input.userId),
    ])
    petName = loadedPetName
    agent = buildAgent({
      model: getFlashModel(),
      userId: input.userId,
      userIdHash,
      deepThink: input.deepThink,
      search,
      now,
      clock,
      petName,
    })

    const modelInputMessages = withImageFallbackPrompt(filterEmptyAssistantMessages(input.messages))
    result = await agent.stream({
      messages: await convertToModelMessages(modelInputMessages, {
        tools: agent.tools,
        // 历史消息里若因异常中断残留未完成的 tool-call（input-streaming / input-available），自动忽略，
        // 彻底避免 AI_MissingToolResultsError 毒化整个会话
        ignoreIncompleteToolCalls: true,
      }),
    })
  } catch (error) {
    console.error(
      '[ai] agent 流式初始化失败，立即释放预占',
      error instanceof Error ? error.name : typeof error,
    )
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
    throw error
  }
  // 客户端断开也不影响模型跑完与结算（ai-and-quota.md：流式中断按已产生用量结算）
  result.consumeStream()

  let hadStreamError = false
  const response = createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools: agent.tools,
      originalMessages: input.messages,
      generateMessageId: createIdGenerator({ prefix: 'amsg', size: 16 }),
      onError: (error) => {
        hadStreamError = true
        console.error(
          '[ai] agent 流式分片出错',
          error instanceof Error ? error.message : String(error),
        )
        return `${petName}刚刚走神了一下，点重试再叫我一次吧`
      },
      onEnd: async ({ messages }) => {
        try {
          const persistable = filterEmptyAssistantMessages(messages)
          await saveMessages(
            db,
            input.userId,
            input.conversationId,
            persistable.map((m, idx) => ({
              messageId: m.id,
              role: m.role === 'user' ? 'user' : 'assistant',
              parts: stripFileParts(m.parts as unknown[]),
              createdAt: (m as { createdAt?: Date }).createdAt ?? new Date(now.getTime() + idx),
            })),
          )
        } catch (error) {
          console.error(
            '[ai] agent 消息持久化失败',
            error instanceof Error ? error.message : String(error),
          )
        }
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
        status: hadStreamError ? 'failed' : 'succeeded',
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

/** 取第一条用户消息的纯文本（生成会话标题用；纯发图时记为「图片打卡识别」） */
function firstUserTextOf(messages: readonly UIMessage[]): string {
  for (const m of messages) {
    if (m.role !== 'user') continue
    for (const p of m.parts) {
      if (
        typeof p === 'object' &&
        p !== null &&
        p.type === 'text' &&
        typeof p.text === 'string' &&
        p.text.trim().length > 0
      ) {
        return p.text
      }
    }
    const hasImage = m.parts.some(
      (p) => typeof p === 'object' && p !== null && (p as { type?: unknown }).type === 'file',
    )
    if (hasImage) return '图片打卡识别'
  }
  return ''
}

/** 供路由读取历史：加载会话消息（自动过滤历史失败残留的空助手消息） */
export async function loadConversationMessages(
  userId: string,
  conversationId: string,
  options: { allowMissing?: boolean } = {},
): Promise<UIMessage[]> {
  const stored = await loadMessages(db, userId, conversationId, options)
  return filterEmptyAssistantMessages(stored).map((m) => ({
    id: m.id,
    role: m.role,
    parts: m.parts,
    createdAt: m.createdAt,
  })) as unknown as UIMessage[]
}
