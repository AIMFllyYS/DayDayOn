import type { ReactNode } from 'react'
import { MascotSvg, type MascotMood } from '@/components/mascot/mascot-svg'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { hostOf, turnSources, turnText } from '../turn'
import type { AgentTurnView } from '../types'
import { ActivityTrail } from './activity-trail'
import { AnswerText } from './answer-text'

const avatarMood: Record<AgentTurnView['status'], MascotMood> = {
  submitted: 'thinking',
  streaming: 'thinking',
  done: 'happy',
  error: 'sad',
}

interface AgentTurnProps {
  turn: AgentTurnView
  /** 不传时自动：进行中展开、完成后收起；传 true / false 固定展开或收起（演示用） */
  traceOpen?: boolean
  /** 正文之后的产物：草稿卡、图表等 */
  children?: ReactNode
  onRetry?: () => void
  className?: string
}

/**
 * 一次助手回复。思考、工具调用、文字输出是同一个回合的三种 part，合在一个组件里按固定顺序呈现：
 *   活动条（思考 + 工具，一行，可展开）→ 正文 → 产物（草稿卡）→ 来源 → 错误与重试
 */
export function AgentTurn({ turn, traceOpen, children, onRetry, className }: AgentTurnProps) {
  const { text, streaming } = turnText(turn)
  const sources = turnSources(turn)
  const hasProcess =
    turn.status === 'submitted' ||
    turn.parts.some((p) => p.type === 'reasoning' || p.type === 'tool') ||
    (turn.status === 'streaming' && text.length === 0)

  return (
    <article
      aria-label="团团的回复"
      aria-busy={turn.status === 'streaming' || undefined}
      className={cn('flex items-start gap-2.5', className)}
    >
      <span className="bg-surface shadow-soft mt-0.5 shrink-0 rounded-full p-0.5">
        <MascotSvg mood={avatarMood[turn.status]} size={34} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {hasProcess && <ActivityTrail turn={turn} defaultOpen={traceOpen} />}
        {text && <AnswerText text={text} streaming={streaming} />}
        {children}
        {sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-tiny text-muted">参考了</span>
            {sources.map((s, i) => (
              <a
                key={s.id}
                href={s.url}
                target="_blank"
                rel="noreferrer noopener"
                title={s.title ?? s.url}
                className="border-border bg-surface text-tiny text-muted hover:border-border-strong hover:text-foreground inline-flex h-7 max-w-52 items-center gap-1.5 rounded-full border px-2.5 transition-colors"
              >
                <span className="bg-study-soft font-display text-tiny text-study-ink flex size-4 shrink-0 items-center justify-center rounded-full font-bold">
                  {i + 1}
                </span>
                <span className="truncate">{hostOf(s.url)}</span>
              </a>
            ))}
          </div>
        )}
        {turn.status === 'error' && (
          <div
            role="alert"
            className="bg-danger-soft text-caption text-danger-ink flex items-center gap-2 rounded-2xl px-3 py-2"
          >
            <Icon name="alert" size={16} lineOnly />
            <span className="flex-1">{turn.errorText ?? '这次没能完成，稍后再试试'}</span>
            {onRetry && (
              <Button size="sm" variant="secondary" icon="undo" onClick={onRetry}>
                重试
              </Button>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
