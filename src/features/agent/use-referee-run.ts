'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useCallback, useMemo } from 'react'
import { VerdictSchema, type Verdict } from '@/features/referee/schemas'
import { formatChatError, toTurnView } from './map-message'
import type { AgentTurnView } from './types'

/*
 * 打卡裁判的流式运行（checkin-modules.md 第 4 节）：POST /api/v1/goals/{goalId}/referee。
 * 放在 features/agent/ 是因为 @ai-sdk/react 只允许在这里 import（ai-and-quota.md 第 1 节）。
 * 只认 submitVerdict 工具的输出；没交卷或请求失败时 status = 'failed'，由调用方改用规则判定。
 */

export type RefereeStatus = 'idle' | 'running' | 'done' | 'failed'

export interface RefereeRun {
  status: RefereeStatus
  turn: AgentTurnView | null
  verdict: Verdict | null
  /** 失败时给用户看的一句话 */
  errorText: string | null
  start: (checkin: unknown, idempotencyKey: string) => void
  reset: () => void
}

function findVerdict(parts: readonly unknown[]): Verdict | null {
  for (const p of parts) {
    if (typeof p !== 'object' || p === null) continue
    const part = p as { type?: unknown; state?: unknown; output?: unknown }
    if (part.type !== 'tool-submitVerdict' || part.state !== 'output-available') continue
    const out = part.output as { verdict?: unknown } | null
    const parsed = VerdictSchema.safeParse(out?.verdict)
    if (parsed.success) return parsed.data
  }
  return null
}

export function useRefereeRun(goalId: string): RefereeRun {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/v1/goals/${encodeURIComponent(goalId)}/referee`,
        prepareSendMessagesRequest: ({ body }) => {
          const extra = (body ?? {}) as { checkin?: unknown; idempotencyKey?: string }
          return { body: { checkin: extra.checkin, idempotencyKey: extra.idempotencyKey } }
        },
      }),
    [goalId],
  )

  const { messages, status, error, sendMessage, setMessages, stop, clearError } = useChat({
    id: `referee-${goalId}`,
    transport,
  })

  const assistant = [...messages].reverse().find((m) => m.role === 'assistant') ?? null
  const verdict = assistant ? findVerdict(assistant.parts) : null
  const streaming = status === 'submitted' || status === 'streaming'

  let runStatus: RefereeStatus = 'idle'
  if (messages.length > 0) {
    if (streaming && !verdict) runStatus = 'running'
    else if (verdict) runStatus = 'done'
    else if (status === 'error' || status === 'ready') runStatus = 'failed'
  }

  const turn: AgentTurnView | null = assistant
    ? toTurnView(
        assistant,
        runStatus === 'running' ? 'streaming' : runStatus === 'failed' ? 'error' : 'done',
      )
    : null

  const start = useCallback(
    (checkin: unknown, idempotencyKey: string) => {
      clearError()
      setMessages([])
      void sendMessage({ text: '请裁判这条打卡' }, { body: { checkin, idempotencyKey } })
    },
    [clearError, sendMessage, setMessages],
  )

  const reset = useCallback(() => {
    void stop()
    clearError()
    setMessages([])
  }, [clearError, setMessages, stop])

  return {
    status: runStatus,
    turn,
    verdict,
    errorText:
      runStatus === 'failed'
        ? error
          ? formatChatError(error)
          : '团团这次没能给出结论，先按达标规则判定'
        : null,
    start,
    reset,
  }
}
