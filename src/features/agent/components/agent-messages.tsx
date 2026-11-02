'use client'

import { useRef, useEffect } from 'react'
import type { ChatStatus, UIMessage } from 'ai'
import { Mascot } from '@/components/mascot/mascot'
import { AgentDraftSchema, type AgentDraft } from '../schemas'
import { toTurnView } from '../map-message'
import { AgentTurn } from './agent-turn'
import { DraftCard } from './draft-card'
import { UserMessage } from './user-message'

/*
 * Agent 对话的消息流：用户消息 + 助手回合（AgentTurn）+ 草稿卡。
 * UIMessage → AgentTurnView 的映射在 map-message.ts，草稿从 tool-draft* 的输出里取。
 */

const DRAFT_TOOLS = new Set(['draftCheckin', 'draftTodo', 'draftWeight'])

function draftsOf(message: UIMessage): AgentDraft[] {
  const out: AgentDraft[] = []
  for (const part of message.parts as Array<Record<string, unknown> & { type?: string }>) {
    const type = part?.type
    if (typeof type !== 'string' || !type.startsWith('tool-')) continue
    if (!DRAFT_TOOLS.has(type.slice(5))) continue
    if (part.state !== 'output-available') continue
    const parsed = AgentDraftSchema.safeParse(part.output)
    if (parsed.success) out.push(parsed.data)
  }
  return out
}

function userText(message: UIMessage): string {
  return (message.parts as Array<Record<string, unknown> & { type?: string }>)
    .filter((p) => p.type === 'text')
    .map((p) => String(p.text ?? ''))
    .join('\n')
}

function userFileCount(message: UIMessage): number {
  return (message.parts as Array<{ type?: string }>).filter((p) => p.type === 'file').length
}

function turnStatusFor(
  chatStatus: ChatStatus,
  isLast: boolean,
): 'submitted' | 'streaming' | 'done' | 'error' {
  if (!isLast) return 'done'
  if (chatStatus === 'error') return 'error'
  if (chatStatus === 'submitted') return 'submitted'
  if (chatStatus === 'streaming') return 'streaming'
  return 'done'
}

export function AgentMessages({ messages, status }: { messages: UIMessage[]; status: ChatStatus }) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const last = messages.at(-1)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, last?.parts.length])

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
        <Mascot mood="happy" size={72} />
        <p className="text-body text-muted">我是团团，你的打卡搭子～</p>
        <p className="text-caption text-subtle max-w-xs">
          告诉我你做了什么，比如「今天跑了 3 公里」「中午吃了番茄炒蛋」，我帮你记下来
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {messages.map((m, i) => {
        if (m.role === 'user') {
          const files = userFileCount(m)
          return (
            <UserMessage
              key={m.id}
              attachments={files > 0 ? `${files} 张照片（识别后不保存）` : undefined}
            >
              {userText(m)}
            </UserMessage>
          )
        }
        const drafts = draftsOf(m)
        return (
          <AgentTurn
            key={m.id}
            turn={toTurnView(m, turnStatusFor(status, i === messages.length - 1))}
          >
            {drafts.map((d, j) => (
              <DraftCard key={`${m.id}-${j}`} draft={d} />
            ))}
          </AgentTurn>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
