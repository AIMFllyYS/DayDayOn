import 'server-only'
import {
  createIdGenerator,
  createUIMessageStreamResponse,
  hasToolCall,
  isStepCount,
  toUIMessageStream,
  ToolLoopAgent,
} from 'ai'
import type { JudgeInput } from '@/features/referee/rules'
import type { Verdict } from '@/features/referee/schemas'
import type { LocalDate, Module } from '@/features/shared/schemas'
import type { DbOrTx } from '@/server/db/client'
import { getFlashModel, hashedUserId } from '../model'
import { usageFromSdk, type TokenUsage } from '../pricing'
import { reserveAgentRun, settleAgentRun } from '../run-agent'
import { refereeSystemPrompt, REFEREE_PROMPT_VERSION } from './prompt'
import { buildRefereeTools, MAX_REFEREE_SEARCHES } from './tools'

/*
 * 裁判 Agent 的流式运行（checkin-modules.md 第 4 节、ADR-0027）。
 * 预占（token 上限 + 联网 3 次）→ ToolLoopAgent 流式（最多 6 步，最后一步强制 submitVerdict）
 * → 后台按实际用量结算，失败释放。和 Agent 对话同一套账本，不落会话消息。
 */

export const REFEREE_MAX_STEPS = 6
export const REFEREE_MAX_OUTPUT_PER_STEP = 1500
const ZERO_USAGE: TokenUsage = { inputMissTokens: 0, inputHitTokens: 0, outputTokens: 0 }

export interface StreamRefereeInput {
  db: DbOrTx
  userId: string
  ip: string
  idempotencyKey: string
  goalId: string
  module: Module
  today: LocalDate
  timeZone: string
  weightKg: number | null
  judgeBase: Omit<JudgeInput, 'facts' | 'extras'>
  /** 给模型看的待裁判记录（user message，JSON） */
  brief: Record<string, unknown>
  now: Date
}

export async function streamReferee(input: StreamRefereeInput): Promise<Response> {
  const userText = JSON.stringify(input.brief)
  const reserved = await reserveAgentRun({
    userId: input.userId,
    ip: input.ip,
    idempotencyKey: input.idempotencyKey,
    // 系统提示约 1200 字 + 记录 + 每步工具结果余量；宁可高估，结算多退
    estimatedInputTokens: Math.ceil(userText.length / 2) + 1200 + REFEREE_MAX_STEPS * 1500,
    now: input.now,
    purpose: 'referee',
    promptVersion: REFEREE_PROMPT_VERSION,
    maxOutputTokens: REFEREE_MAX_STEPS * REFEREE_MAX_OUTPUT_PER_STEP,
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
    timeZone: input.timeZone,
    weightKg: input.weightKg,
    search,
    judgeBase: input.judgeBase,
    aiRunId: reserved.aiRunId,
    onVerdict: (v) => {
      verdict = v
    },
  })

  const agent = new ToolLoopAgent({
    model: getFlashModel(),
    instructions: refereeSystemPrompt(input.module),
    tools,
    stopWhen: [hasToolCall('submitVerdict'), isStepCount(REFEREE_MAX_STEPS)],
    maxOutputTokens: REFEREE_MAX_OUTPUT_PER_STEP,
    // 最后一步只允许提交结论，保证 6 步内一定交卷
    prepareStep: ({ stepNumber }) =>
      stepNumber >= REFEREE_MAX_STEPS - 1
        ? { toolChoice: { type: 'tool', toolName: 'submitVerdict' } }
        : undefined,
    providerOptions: {
      deepseek: {
        userId: await hashedUserId(input.userId),
        thinking: { type: 'disabled' },
      },
    },
  })

  const startedAt = Date.now()
  const result = await agent.stream({ messages: [{ role: 'user', content: userText }] })
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
      onError: (error) => {
        console.error(
          '[ai] 裁判流式分片出错',
          error instanceof Error ? error.message : String(error),
        )
        return '团团裁判走神了一下，这次先按规则判定'
      },
    }),
  })
}
