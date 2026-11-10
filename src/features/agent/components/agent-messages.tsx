'use client'

import { useRef, useEffect } from 'react'
import type { ChatStatus, UIMessage } from 'ai'
import { Mascot } from '@/components/mascot/mascot'
import type { MascotCharacter } from '@/components/mascot/mascot-svg'
import { InsightCard, InsightGrid } from '@/features/insights/components/insight-card'
import { InsightsSchema, type Insights } from '@/features/insights/schemas'
import { VerdictCard } from '@/features/referee/components/verdict-card'
import { AgentDraftSchema, type AgentDraft } from '../schemas'
import { findVerdict } from '../use-referee-run'
import { formatChatError, toTurnView } from '../map-message'
import { AgentTurn } from './agent-turn'
import { DraftCard } from './draft-card'
import { ThinkingDots } from './thinking-dots'
import { UserMessage } from './user-message'

/*
 * Agent 对话的消息流：用户消息 + 助手回合（AgentTurn）+ 草稿卡。
 * UIMessage → AgentTurnView 的映射在 map-message.ts，草稿从 tool-draft* 的输出里取。
 */

// 返回 AgentDraft 的工具：输出渲染成草稿卡（server/ai/agent-tools.ts、agent-checkin-tools.ts）
const DRAFT_TOOLS = new Set([
  'draftCheckin',
  'draftUpdateCheckin',
  'draftDeleteCheckin',
  'draftTodo',
  'draftWeight',
])
const QUICK_PROMPTS = [
  '我今天完成得怎么样？',
  '帮我记一下今天跑了 3 公里',
  '看看好友今天打卡没',
] as const

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

// 返回近况数据的工具：输出画成和主页同一种近况卡（server/ai/agent-tools.ts 的 showStats）
const STATS_TOOLS = new Set(['showStats'])

function statsOf(message: UIMessage): Insights[] {
  const out: Insights[] = []
  for (const part of message.parts as Array<Record<string, unknown> & { type?: string }>) {
    const type = part?.type
    if (typeof type !== 'string' || !type.startsWith('tool-')) continue
    if (!STATS_TOOLS.has(type.slice(5))) continue
    if (part.state !== 'output-available') continue
    const parsed = InsightsSchema.safeParse(part.output)
    if (parsed.success) out.push(parsed.data)
  }
  return out
}

function StatsBlock({ data }: { data: Insights }) {
  if (data.items.length === 0) return null
  if (data.items.length === 1 && data.items[0]) {
    return (
      <InsightCard
        insight={data.items[0]}
        days={data.days}
        size="full"
        href={`/goals/${data.items[0].goalId}`}
      />
    )
  }
  return (
    <div className="@container">
      <InsightGrid items={data.items} days={data.days} />
    </div>
  )
}

const STRIPPED_FILE_NOTE_RE = /^\d+\s*张照片（识别后不保存）$/

// 仅保存在当前浏览器页面内存中的消息图片预览表（切换会话再切回仍可见，关闭标签页即释放，绝不落盘）
const sessionMessageImages = new Map<string, string[]>()

function userImageUrls(message: UIMessage): string[] {
  const inlineUrls = (message.parts as Array<{ type?: string; mediaType?: string; url?: string }>)
    .filter(
      (p) =>
        p.type === 'file' &&
        typeof p.url === 'string' &&
        p.url.length > 0 &&
        (!p.mediaType || p.mediaType.startsWith('image/')),
    )
    .map((p) => p.url as string)

  if (inlineUrls.length > 0) {
    sessionMessageImages.set(message.id, inlineUrls)
    return inlineUrls
  }
  return sessionMessageImages.get(message.id) ?? []
}

function userExtractedContent(
  message: UIMessage,
  hasLiveImages: boolean,
): {
  text: string
  attachmentNote?: string
} {
  const rawTexts = (message.parts as Array<Record<string, unknown> & { type?: string }>)
    .filter((p) => p.type === 'text')
    .map((p) => String(p.text ?? ''))

  const strippedNotes = rawTexts.filter((t) => STRIPPED_FILE_NOTE_RE.test(t.trim()))
  const bodyTexts = rawTexts.filter((t) => !STRIPPED_FILE_NOTE_RE.test(t.trim()))
  const filePartCount = (message.parts as Array<{ type?: string }>).filter(
    (p) => p.type === 'file',
  ).length

  if (filePartCount > 0) {
    return {
      text: bodyTexts.join('\n').trim(),
      attachmentNote: `${filePartCount} 张照片（识别后不保存）`,
    }
  }
  if (strippedNotes.length > 0) {
    return {
      text: hasLiveImages ? bodyTexts.join('\n').trim() : rawTexts.join('\n').trim(),
      attachmentNote: hasLiveImages ? strippedNotes[0] : undefined,
    }
  }
  return { text: rawTexts.join('\n').trim() }
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

export function AgentMessages({
  messages,
  status,
  error,
  isLoadingHistory = false,
  onRetry,
  onQuickPrompt,
  character = 'tuan',
}: {
  messages: UIMessage[]
  status: ChatStatus
  error?: Error
  isLoadingHistory?: boolean
  onRetry?: () => void
  onQuickPrompt?: (text: string) => void
  character?: MascotCharacter
}) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const last = messages.at(-1)
  const petName = character === 'dun' ? '墩墩' : '团团'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, last?.parts.length, status])

  if (messages.length === 0) {
    if (isLoadingHistory) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
          <Mascot character={character} mood="thinking" size={64} />
          <div className="text-caption text-muted flex items-center gap-1.5">
            <span>正在加载历史对话</span>
            <ThinkingDots />
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
        <Mascot character={character} mood="happy" size={72} />
        <p className="text-body text-muted">我是{petName}，你的打卡搭子～</p>
        <p className="text-caption text-subtle max-w-xs">
          告诉我你做了什么，比如「今天跑了 3 公里」「中午吃了番茄炒蛋」，我帮你记下来
        </p>
        {onQuickPrompt && (
          <div className="mt-2 flex max-w-sm flex-wrap justify-center gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onQuickPrompt(prompt)}
                className="border-border bg-surface text-caption text-foreground hover:border-border-strong hover:bg-surface-sunken rounded-full border px-3 py-1.5 transition-all duration-(--dur-fast) active:scale-[0.97]"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const errorText = status === 'error' ? formatChatError(error) : undefined

  return (
    <div className="flex w-full max-w-full min-w-0 flex-col gap-4">
      {messages.map((m, i) => {
        if (m.role === 'user') {
          const images = userImageUrls(m)
          const { text, attachmentNote } = userExtractedContent(m, images.length > 0)
          return (
            <UserMessage key={m.id} imageUrls={images} attachments={attachmentNote}>
              {text}
            </UserMessage>
          )
        }
        const isLast = i === messages.length - 1
        const drafts = draftsOf(m)
        // 打卡页「让 Agent 分析」的那一轮：结论卡和打卡页同一种样子，确认入库回打卡页点
        const verdict = findVerdict(m.parts)
        const stats = statsOf(m)
        return (
          <AgentTurn
            key={m.id}
            character={character}
            turn={toTurnView(m, turnStatusFor(status, isLast), isLast ? errorText : undefined)}
            onRetry={isLast ? onRetry : undefined}
          >
            {verdict && <VerdictCard verdict={verdict} />}
            {stats.map((s, j) => (
              <StatsBlock key={`${m.id}-stats-${j}`} data={s} />
            ))}
            {drafts.map((d, j) => (
              <DraftCard key={`${m.id}-${j}`} draft={d} />
            ))}
          </AgentTurn>
        )
      })}
      {last?.role === 'user' && (status === 'submitted' || status === 'streaming') && (
        <AgentTurn
          key="pending-turn"
          character={character}
          turn={{ id: 'pending-turn', status: 'submitted', parts: [] }}
        />
      )}
      {last?.role === 'user' && status === 'error' && (
        <AgentTurn
          key="error-turn"
          character={character}
          turn={{
            id: 'error-turn',
            status: 'error',
            parts: [],
            errorText,
          }}
          onRetry={onRetry}
        />
      )}
      <div ref={bottomRef} />
    </div>
  )
}
