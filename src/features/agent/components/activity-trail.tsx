'use client'

import { useId, useState } from 'react'
import { Icon } from '@/components/ui/icon'
import { softToneClass } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
import { formatDuration } from '../format'
import { getToolMeta } from '../tool-meta'
import { isToolRunning, splitSteps, summarizeTurn, type AgentStep } from '../turn'
import type { AgentTurnView, ReasoningPart, ToolPart } from '../types'
import { ThinkingDots } from './thinking-dots'

const MAX_CHIPS = 5
const MOBILE_CHIPS = 3

/**
 * 活动条：把一次回复里的"思考 + 工具调用"压成一行。
 * 收起时只占一行：左边是当前在做什么，右边是按步分组的工具小方块（同一步并行的叠在一起）；
 * 展开后是按步排列的时间线，每个工具一行，点开看参数和结果。
 * 工具再多也只占一行高度，正文（AI 的回答）始终是视觉重点。
 */
export function ActivityTrail({
  turn,
  defaultOpen = false,
  className,
}: {
  turn: AgentTurnView
  defaultOpen?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const regionId = useId()
  const summary = summarizeTurn(turn)
  const steps = splitSteps(turn.parts)
  const live = turn.status === 'submitted' || turn.status === 'streaming'
  const totalMs = turn.durationMs

  // 收起时这一行要和工具方块挤在一起，只放最关键的信息；步数在展开后的时间线里看，手机上再省掉耗时
  const doneText =
    turn.status === 'error'
      ? '中断'
      : summary.tools.length > 0
        ? `${summary.tools.length} 个工具`
        : '思考完成'

  return (
    <div
      className={cn(
        'bg-surface/80 overflow-hidden rounded-2xl border transition-colors duration-(--dur-base)',
        live ? 'border-primary-soft' : 'border-border',
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={regionId}
        disabled={steps.length === 0}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center gap-2.5 px-3 py-1.5 text-left disabled:cursor-default"
      >
        <StatusGlyph status={turn.status} failed={summary.failed > 0} />
        <span className="text-caption min-w-0 flex-1 truncate">
          {live ? (
            <span className="text-foreground font-semibold">
              {summary.activity}
              <ThinkingDots className="text-primary ml-1.5" />
            </span>
          ) : (
            <span className="text-muted">
              {doneText}
              {totalMs ? <span className="max-sm:hidden"> · {formatDuration(totalMs)}</span> : null}
              {summary.failed > 0 && (
                <span className="text-danger-ink"> · {summary.failed} 个失败</span>
              )}
            </span>
          )}
        </span>
        <ChipStrip steps={steps} />
        {steps.length > 0 && (
          <Icon
            name="chevron-down"
            size={16}
            className={cn(
              'text-subtle ease-spring shrink-0 transition-transform duration-(--dur-base)',
              open && 'rotate-180',
            )}
          />
        )}
      </button>

      {open && steps.length > 0 && (
        <ol
          id={regionId}
          className="animate-fade-in border-border border-t border-dashed px-3 pt-2 pb-3"
        >
          {steps.map((s, i) => (
            <StepBlock key={s.index} step={s} last={i === steps.length - 1} />
          ))}
        </ol>
      )}
    </div>
  )
}

function StatusGlyph({ status, failed }: { status: AgentTurnView['status']; failed: boolean }) {
  if (status === 'submitted' || status === 'streaming') {
    return (
      <span className="relative flex size-6 shrink-0 items-center justify-center">
        <span className="bg-primary-soft absolute inset-0 animate-ping rounded-full [animation-duration:1.6s]" />
        <Icon
          name="loader"
          size={16}
          strokeWidth={2.6}
          className="animate-spin-slow text-primary relative"
        />
      </span>
    )
  }
  if (status === 'error' || failed) {
    return (
      <span className="bg-warning-soft text-warning-ink flex size-6 shrink-0 items-center justify-center rounded-full">
        <Icon name="alert" size={14} lineOnly />
      </span>
    )
  }
  return (
    <span className="bg-success-soft text-success-ink flex size-6 shrink-0 items-center justify-center rounded-full">
      <Icon name="check" size={14} strokeWidth={2.6} />
    </span>
  )
}

/** 工具小方块：同一步的叠在一起表示并行，步与步之间留空 */
function ChipStrip({ steps }: { steps: AgentStep[] }) {
  const all = steps.flatMap((s) => s.tools.map((t) => ({ t, step: s.index })))
  if (all.length === 0) return null
  const hidden = Math.max(0, all.length - MAX_CHIPS)
  const shown = all.slice(hidden)
  // 手机上一行放不下，只保留最近 MOBILE_CHIPS 个方块，其余也折进 +N
  const mobileCut = Math.max(0, shown.length - MOBILE_CHIPS)
  return (
    <span className="flex shrink-0 items-center" aria-label={`调用了 ${all.length} 个工具`}>
      {hidden + mobileCut > 0 && (
        <span className="font-display text-tiny text-muted mr-1 font-semibold sm:hidden">
          +{hidden + mobileCut}
        </span>
      )}
      {hidden > 0 && (
        <span className="font-display text-tiny text-muted mr-1 hidden font-semibold sm:inline">
          +{hidden}
        </span>
      )}
      {shown.map(({ t, step }, i) => {
        const prev = shown[i - 1]
        const sameStep = prev?.step === step
        const meta = getToolMeta(t.toolName)
        return (
          <span
            key={t.id}
            title={`${meta.label}${t.summary ? `：${t.summary}` : ''}`}
            className={cn(
              'ring-surface relative items-center justify-center rounded-lg ring-2',
              i < mobileCut ? 'hidden size-6 sm:flex' : 'flex size-6',
              t.state === 'output-error' ? softToneClass.danger : softToneClass[meta.tone],
              i > 0 && (sameStep ? '-ml-2' : 'ml-1'),
              i === mobileCut && 'max-sm:ml-0',
              isToolRunning(t) && 'animate-pulse',
            )}
          >
            <Icon name={meta.icon} size={13} strokeWidth={2.2} />
            {t.state === 'output-error' && (
              <span className="bg-danger ring-surface absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2" />
            )}
          </span>
        )
      })}
    </span>
  )
}

function StepBlock({ step, last }: { step: AgentStep; last: boolean }) {
  const parallel = step.tools.length > 1
  return (
    <li className="relative pl-6">
      {/* 步骤之间的虚线轨道 */}
      {!last && (
        <span className="border-border absolute top-5 bottom-0 left-[9px] border-l-2 border-dashed" />
      )}
      <span className="bg-surface-sunken font-display text-tiny text-muted ring-surface absolute top-1.5 left-0 flex size-5 items-center justify-center rounded-full font-bold ring-2">
        {step.index}
      </span>
      <div className="flex items-center gap-2 pt-1 pb-1.5">
        <span className="text-tiny text-muted font-semibold">第 {step.index} 步</span>
        {parallel && (
          <span className="bg-surface-sunken text-tiny text-muted rounded-full px-1.5 font-semibold">
            同时 {step.tools.length} 个
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 pb-3">
        {step.reasoning.map((r) => (
          <Thought key={r.id} part={r} />
        ))}
        {step.tools.length > 0 && (
          <ul
            className={cn(
              'flex flex-col overflow-hidden rounded-xl',
              parallel && 'border-border bg-background/60 border',
            )}
          >
            {step.tools.map((t) => (
              <ToolRow key={t.id} tool={t} />
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}

function Thought({ part }: { part: ReasoningPart }) {
  const [expanded, setExpanded] = useState(false)
  const streaming = part.state === 'streaming'
  return (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      className="hover:bg-surface-sunken flex gap-2 rounded-lg px-1.5 py-1 text-left"
    >
      <Icon name="bulb" size={14} className="text-sleep mt-1 shrink-0" lineOnly />
      <span className={cn('text-caption text-muted', !expanded && 'line-clamp-2')}>
        {part.text}
        {streaming && (
          <span className="animate-caret bg-sleep ml-0.5 inline-block h-3.5 w-0.5 translate-y-0.5" />
        )}
      </span>
    </button>
  )
}

function toJson(value: unknown): string {
  if (value === undefined) return '—'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function ToolRow({ tool }: { tool: ToolPart }) {
  const [open, setOpen] = useState(false)
  const meta = getToolMeta(tool.toolName)
  const running = isToolRunning(tool)
  const failed = tool.state === 'output-error'
  return (
    <li className="border-border/70 border-b last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-surface-sunken flex min-h-10 w-full items-center gap-2 px-2 py-1.5 text-left"
      >
        <span
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-lg',
            failed ? softToneClass.danger : softToneClass[meta.tone],
          )}
        >
          <Icon name={meta.icon} size={13} strokeWidth={2.2} />
        </span>
        <span className="text-caption min-w-0 flex-1 truncate">
          <span className="font-semibold">{meta.label}</span>
          {tool.summary && <span className="text-muted ml-1.5">{tool.summary}</span>}
        </span>
        <span
          className={cn(
            'font-display text-tiny shrink-0 tabular-nums',
            failed ? 'text-danger-ink font-semibold' : 'text-muted',
          )}
        >
          {running ? (
            <Icon name="loader" size={13} className="animate-spin-slow text-primary" />
          ) : failed ? (
            '失败'
          ) : tool.durationMs !== undefined ? (
            formatDuration(tool.durationMs)
          ) : null}
        </span>
      </button>
      {failed && tool.errorText && !open && (
        <p className="text-tiny text-danger-ink px-2 pb-2 pl-10">{tool.errorText}</p>
      )}
      {open && (
        <div className="animate-fade-in grid gap-1.5 px-2 pb-2 pl-10 sm:grid-cols-2">
          <Payload title="参数" body={toJson(tool.input)} />
          {failed ? (
            <Payload title="错误" body={tool.errorText ?? '未知错误'} danger />
          ) : (
            <Payload title="结果" body={running ? '等待返回…' : toJson(tool.output)} />
          )}
        </div>
      )}
    </li>
  )
}

function Payload({
  title,
  body,
  danger = false,
}: {
  title: string
  body: string
  danger?: boolean
}) {
  return (
    <div className={cn('min-w-0 rounded-lg p-2', danger ? 'bg-danger-soft' : 'bg-surface-sunken')}>
      <p
        className={cn('text-tiny mb-0.5 font-semibold', danger ? 'text-danger-ink' : 'text-muted')}
      >
        {title}
      </p>
      <pre
        className={cn(
          'text-tiny max-h-40 overflow-auto font-mono break-all whitespace-pre-wrap',
          danger ? 'text-danger-ink' : 'text-foreground',
        )}
      >
        {body}
      </pre>
    </div>
  )
}
