'use client'

import type { UIMessage } from 'ai'
import { useCallback, useState } from 'react'
import { VerdictSchema, type Verdict } from '@/features/referee/schemas'
import { useAgentChat } from './chat-context'
import { formatChatError, toTurnView } from './map-message'
import type { AgentTurnView } from './types'

/*
 * 打卡页的「让 Agent 分析」（checkin-modules.md 第 4 节）。全局只有一个 Agent：
 * start() 新开一个 Agent 会话，把这条打卡交给裁判接口，分析就是这个会话的第一轮，
 * 历史对话里能找到、对话框里能接着问（chat-context.tsx 的 startReferee）。
 * 这里只认 submitVerdict 的输出；没交卷、请求失败或分析中途切到别的会话时 status = 'failed'，
 * 由调用方改用规则判定。会话后来被接着聊了，结论仍取第一轮的分析，并在本地记住。
 */

export type RefereeStatus = 'idle' | 'running' | 'done' | 'failed'

export interface RefereeRun {
  status: RefereeStatus
  turn: AgentTurnView | null
  verdict: Verdict | null
  /** 失败时给用户看的一句话 */
  errorText: string | null
  /** 这次分析所在的会话 */
  conversationId: string | null
  start: (input: { checkin: unknown; text: string; idempotencyKey: string }) => void
  reset: () => void
}

export function findVerdict(parts: readonly unknown[]): Verdict | null {
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

interface Snapshot {
  status: RefereeStatus
  turn: AgentTurnView | null
  verdict: Verdict | null
  errorText: string | null
}

const IDLE: Snapshot = { status: 'idle', turn: null, verdict: null, errorText: null }

/** 从当前会话的消息里读出这次分析（第一条助手消息） */
export function readRun(
  messages: readonly UIMessage[],
  chatStatus: 'submitted' | 'streaming' | 'ready' | 'error',
  error: Error | undefined,
): Snapshot {
  const assistantIndex = messages.findIndex((m) => m.role === 'assistant')
  const assistant = assistantIndex >= 0 ? messages[assistantIndex] : undefined
  const verdict = assistant ? findVerdict(assistant.parts) : null
  // 第一轮还在跑：会话里只有用户那句话，或者第一条助手消息就是最后一条且还在流式
  const firstTurnLive =
    (chatStatus === 'submitted' || chatStatus === 'streaming') &&
    (assistantIndex < 0 || assistantIndex === messages.length - 1)

  let status: RefereeStatus
  if (verdict) status = 'done'
  else if (firstTurnLive || messages.length === 0) status = 'running'
  else status = 'failed'

  const turn = assistant
    ? toTurnView(
        assistant,
        status === 'running' ? 'streaming' : status === 'failed' ? 'error' : 'done',
      )
    : null
  const errorText =
    status === 'failed'
      ? chatStatus === 'error' && error
        ? formatChatError(error)
        : '这次没能给出结论，先按达标规则判定'
      : null
  return { status, turn, verdict, errorText }
}

export function useRefereeRun(goalId: string): RefereeRun {
  const chat = useAgentChat()
  const [runConversation, setRunConversation] = useState<string | null>(null)
  // 最后一次在本会话里读到的分析；切到别的会话后沿用它
  const [latched, setLatched] = useState<{ id: string; snap: Snapshot } | null>(null)

  let snap: Snapshot = IDLE
  if (runConversation !== null) {
    if (chat.conversationId === runConversation) {
      snap = readRun(chat.messages, chat.status, chat.error)
      if (latched?.id !== runConversation || latched.snap !== snap) {
        // 只在内容真的变了时记住，避免每次渲染都 setState
        const prev = latched?.id === runConversation ? latched.snap : null
        if (
          !prev ||
          prev.status !== snap.status ||
          prev.verdict !== snap.verdict ||
          prev.turn?.parts.length !== snap.turn?.parts.length
        ) {
          setLatched({ id: runConversation, snap })
        }
      }
    } else if (latched?.id === runConversation) {
      // 分析中途切走了会话：已经出结论就沿用，没出就算失败（服务端那一轮照样跑完并存进历史）
      snap = latched.snap.verdict
        ? latched.snap
        : {
            ...latched.snap,
            status: 'failed',
            errorText: '分析时切到了别的对话，先按达标规则判定',
          }
    } else {
      // 刚点开始、还没切到新会话的那一下：算作分析中
      snap = { ...IDLE, status: 'running' }
    }
  }

  const { startReferee } = chat
  const start = useCallback<RefereeRun['start']>(
    ({ checkin, text, idempotencyKey }) => {
      const id = startReferee({ goalId, checkin, text, idempotencyKey })
      setLatched(null)
      setRunConversation(id)
    },
    [goalId, startReferee],
  )

  const { stop, conversationId } = chat
  const reset = useCallback(() => {
    // 只停自己这一轮；会话本身留在历史里
    if (runConversation !== null && conversationId === runConversation) void stop()
    setRunConversation(null)
    setLatched(null)
  }, [conversationId, runConversation, stop])

  return { ...snap, conversationId: runConversation, start, reset }
}
