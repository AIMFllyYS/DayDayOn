import type { ReactNode } from 'react'
import { MascotSvg, type MascotCharacter, type MascotMood } from '@/components/mascot/mascot-svg'
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
  character?: MascotCharacter
  /** 正文之后的产物：草稿卡、图表等 */
  children?: ReactNode
  onRetry?: () => void
  className?: string
}

/**
 * 一次助手回复。思考、工具调用、文字输出是同一个回合的三种 part，合在一个组件里按固定顺序呈现：
 *   活动条（思考 + 工具，一行，可展开）→ 正文 → 产物（草稿卡）→ 来源 → 错误与重试
 */
export function AgentTurn({
  turn,
  traceOpen,
  character = 'tuan',
  children,
  onRetry,
  className,
}: AgentTurnProps) {
  const { text, streaming } = turnText(turn)
  const sources = turnSources(turn)
  const hasProcess =
    turn.status === 'submitted' ||
    turn.parts.some((p) => p.type === 'reasoning' || p.type === 'tool') ||
    (turn.status === 'streaming' && text.length === 0)
  const petName = character === 'dun' ? '墩墩' : '团团'
  const statusTag =
    turn.status === 'streaming' ? '思考中…' : turn.status === 'submitted' ? '准备中…' : 'AI打卡搭子'

  return (
    <article
      aria-label={`${petName}的回复`}
      aria-busy={turn.status === 'streaming' || undefined}
      className={cn('flex w-full max-w-full min-w-0 flex-col gap-1.5', className)}
    >
      {/* 头部身份行：IP 头像 + 角色名称 + 状态/副标题 */}
      <header className="flex items-center gap-2 px-0.5">
        <span className="bg-surface shadow-soft shrink-0 rounded-full p-0.5">
          <MascotSvg character={character} mood={avatarMood[turn.status]} size={24} />
        </span>
        <span className="text-caption text-foreground font-semibold">{petName}</span>
        <span className="text-tiny text-muted">{statusTag}</span>
      </header>

      {/* 下方内容主体：偏向左侧（微小缩进 pl-1 sm:pl-1.5），宽度 100% 铺开 */}
      <div className="flex w-full max-w-full min-w-0 flex-col gap-2 pl-1 sm:pl-1.5">
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
