import 'server-only'
import {
  type UIMessage,
  createIdGenerator,
  createUIMessageStreamResponse,
  isStepCount,
  toUIMessageStream,
  ToolLoopAgent,
} from 'ai'
import type { JudgeInput } from '@/features/referee/rules'
import type { Verdict } from '@/features/referee/schemas'
import type { LocalDate, Module } from '@/features/shared/schemas'
import type { DbOrTx } from '@/server/db/client'
import {
  ensureConversation,
  loadMessages,
  saveMessages,
  touchConversation,
} from '@/server/services/agent/conversations'
import { getFlashModel, hashedUserId } from '../model'
import { usageFromSdk, type TokenUsage } from '../pricing'
import { createRepairToolCall } from '../repair-tool-call'
import { filterEmptyAssistantMessages, reserveAgentRun, settleAgentRun } from '../run-agent'
import { refereeSystemPrompt, REFEREE_PROMPT_VERSION } from './prompt'
import { buildRefereeTools, MAX_REFEREE_SEARCHES } from './tools'

/*
 * 裁判 Agent 的流式运行（checkin-modules.md 第 4 节、ADR-0027）。
 * 预占（高分位输出估算 + 联网 6 次）→ ToolLoopAgent 流式（最多 10 步，最后一步强制 submitVerdict，
 * 带确定性 repairToolCall 且仅在 submitVerdict 真正产出 verdict 时停止，避免非法入参提前中止循环）
 * → 后台按实际用量结算，失败释放。和 Agent 对话同一套账本。
 * 带 conversation 时，这次分析就是一个 Agent 会话：用户那句话 + 分析回合在流结束时落库（全局只有一个 Agent）。
 */

export const REFEREE_MAX_STEPS = 10
export const REFEREE_MAX_OUTPUT_PER_STEP = 4096
/** 裁判整轮输出预占估算（实际多在 150–1200 tokens，12000 已留足约 10 倍余量） */
export const REFEREE_RESERVE_OUTPUT_TOKENS = 12_000
const ZERO_USAGE: TokenUsage = { inputMissTokens: 0, inputHitTokens: 0, outputTokens: 0 }

/** 分析所在的 Agent 会话：id 由前端生成（新对话），text 是用户看到的那句话 */
export interface RefereeConversation {
  id: string
  messageId: string
  text: string
}

export interface StreamRefereeInput {
  db: DbOrTx
  userId: string
  ip: string
  idempotencyKey: string
  goalId: string
  module: Module
  today: LocalDate
  /** 实际要裁判的打卡日（补昨日卡时为昨天） */
  targetDay?: LocalDate
  /** 覆盖修改已存在的学习记录时排除自身 id */
  excludeCheckinId?: string
  timeZone: string
  weightKg: number | null
  judgeBase: Omit<JudgeInput, 'facts' | 'extras'>
  conversation?: (RefereeConversation & { title: string }) | null
  /** 用户选的形象名 */
  petName?: string
  /** 给模型看的待裁判记录（user message，JSON） */
  brief: Record<string, unknown>
  now: Date
}

export async function streamReferee(input: StreamRefereeInput): Promise<Response> {
  const userText = JSON.stringify(input.brief)
  // 会话归属先校验（别人的会话 id 直接 404），放在预占前面，免得白占额度；消息在流结束时落库
  const conv = input.conversation ?? null
  const userMessage: UIMessage | null = conv
    ? { id: conv.messageId, role: 'user', parts: [{ type: 'text', text: conv.text }] }
    : null
  if (conv) {
    await loadMessages(input.db, input.userId, conv.id, { allowMissing: true })
    await ensureConversation(input.db, input.userId, conv.id, conv.title, input.now)
    await touchConversation(input.db, input.userId, conv.id, input.now)
  }

  const reserved = await reserveAgentRun({
    userId: input.userId,
    ip: input.ip,
    idempotencyKey: input.idempotencyKey,
    // 系统提示约 1200 字 + 记录 + 每步工具结果余量；宁可高估，结算多退
    estimatedInputTokens: Math.ceil(userText.length / 2) + 1200 + REFEREE_MAX_STEPS * 1500,
    now: input.now,
    purpose: 'referee',
    promptVersion: REFEREE_PROMPT_VERSION,
    maxOutputTokens: REFEREE_RESERVE_OUTPUT_TOKENS,
    maxSearches: MAX_REFEREE_SEARCHES,
  })

  const search = { used: 0, costMicros: 0 }
  let verdict: Verdict | null = null
  const tools = buildRefereeTools({
    db: input.db,
    userId: input.userId,
    goalId: input.goalId,
    module: input.module,
    today: input.today,
    targetDay: input.targetDay ?? input.today,
    excludeCheckinId: input.excludeCheckinId,
    timeZone: input.timeZone,
    weightKg: input.weightKg,
    search,
    judgeBase: input.judgeBase,
    aiRunId: reserved.aiRunId,
    onVerdict: (v) => {
      verdict = v
    },
  })

  const startedAt = Date.now()
  let result: Awaited<ReturnType<ToolLoopAgent<never, typeof tools>['stream']>>
  try {
    const agent = new ToolLoopAgent({
      model: getFlashModel(),
      instructions: refereeSystemPrompt(input.module, input.petName),
      tools,
      // 仅在 submitVerdict 真正成功回调写入 verdict 时停止；若某步入参非法，允许下一轮自我修正重试
      stopWhen: [() => verdict !== null, isStepCount(REFEREE_MAX_STEPS)],
      maxOutputTokens: REFEREE_MAX_OUTPUT_PER_STEP,
      // 最后一步只允许提交结论，保证步数内一定交卷
      prepareStep: ({ stepNumber }) =>
        stepNumber >= REFEREE_MAX_STEPS - 1
          ? { toolChoice: { type: 'tool', toolName: 'submitVerdict' } }
          : undefined,
      repairToolCall: createRepairToolCall(),
      providerOptions: {
        deepseek: {
          userId: await hashedUserId(input.userId),
          thinking: { type: 'disabled' },
        },
      },
    })

    result = await agent.stream({ messages: [{ role: 'user', content: userText }] })
  } catch (error) {
    console.error(
      '[ai] 裁判流式初始化失败，立即释放预占',
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
  // 客户端断开也让模型跑完并结算
  result.consumeStream()

  void (async () => {
    let usage = ZERO_USAGE
    let status: 'succeeded' | 'failed' = 'failed'
    try {
      usage = usageFromSdk(await result.usage)
      status = verdict === null ? 'failed' : 'succeeded'
    } catch (error) {
      console.error('[ai] 裁判流式失败或中止', error instanceof Error ? error.name : typeof error)
    }
    await settleAgentRun({
      userId: input.userId,
      dayKey: reserved.dayKey,
      reservation: reserved.reservation,
      usage,
      searchCostMicros: search.costMicros,
      latencyMs: Date.now() - startedAt,
      status,
      settings: reserved.settings,
    })
  })()

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools,
      generateMessageId: createIdGenerator({ prefix: 'ref', size: 16 }),
      ...(userMessage ? { originalMessages: [userMessage] } : {}),
      onEnd: async ({ messages }) => {
        if (!conv) return
        try {
          const persistable = filterEmptyAssistantMessages(messages)
          await saveMessages(
            input.db,
            input.userId,
            conv.id,
            persistable.map((m, idx) => ({
              messageId: m.id,
              role: m.role === 'user' ? 'user' : 'assistant',
              parts: m.parts as unknown[],
              createdAt: new Date(input.now.getTime() + idx),
            })),
          )
        } catch (error) {
          console.error(
            '[ai] 裁判会话持久化失败',
            error instanceof Error ? error.message : String(error),
          )
        }
      },
      onError: (error) => {
        console.error(
          '[ai] 裁判流式分片出错',
          error instanceof Error ? error.message : String(error),
        )
        return `${input.petName ?? '团团'}裁判走神了一下，这次先按规则判定`
      },
    }),
  })
}
