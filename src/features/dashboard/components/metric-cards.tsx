import type { KeyboardEvent, ReactNode } from 'react'
import { Sparkline } from '@/components/charts/sparkline'
import { Card } from '@/components/ui/card'
import type { StepTrend, WeightTrend } from '@/features/metric/schemas'
import { cn } from '@/lib/cn'
import {
  formatKg,
  formatKgDelta,
  formatSteps,
  formatStepsDelta,
  moodLabel,
  stepTrendLabel,
  weightTrendLabel,
} from '../format'

/*
 * 体重卡、今日心情卡（PRD 2.8 第 3 项）。点卡片打开打卡弹层的对应视图（不另开弹层）。
 * 查看好友仪表盘时传入 readOnly，展示好友数据但不触发编辑弹窗（ADR-0026）。
 */

/** 可点的指标卡：Card 本身做成按钮（role=button + 键盘 Enter / 空格）；只读时为静态卡片 */
function MetricCard({
  title,
  onOpen,
  ariaLabel,
  readOnly = false,
  className,
  children,
}: {
  title: string
  onOpen: () => void
  ariaLabel: string
  readOnly?: boolean
  className?: string
  children: ReactNode
}) {
  if (readOnly) {
    return (
      <Card aria-label={ariaLabel} className={cn('flex min-h-28 flex-col gap-1', className)}>
        <span className="text-tiny text-muted font-semibold">{title}</span>
        {children}
      </Card>
    )
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    onOpen()
  }
  return (
    <Card
      interactive
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={onOpen}
      onKeyDown={onKeyDown}
      className={cn('flex min-h-28 flex-col gap-1', className)}
    >
      <span className="text-tiny text-muted font-semibold">{title}</span>
      {children}
    </Card>
  )
}

export function WeightCard({
  weight,
  onOpen,
  readOnly = false,
}: {
  weight: WeightTrend
  onOpen: () => void
  readOnly?: boolean
}) {
  const latest = weight.latest
  if (!latest) {
    return (
      <MetricCard
        title="今日体重"
        onOpen={onOpen}
        readOnly={readOnly}
        ariaLabel={readOnly ? '今日体重还没记' : '今日体重还没记，记一下'}
      >
        <span className="font-display text-title text-subtle font-semibold">—</span>
        <span
          className={cn('text-tiny font-semibold', readOnly ? 'text-muted' : 'text-primary-ink')}
        >
          {readOnly ? '暂未记录' : '记一下'}
        </span>
      </MetricCard>
    )
  }
  const delta = weight.deltaGrams7d
  const grams = weight.entries.map((e) => e.weightGrams)
  return (
    <MetricCard
      title="今日体重"
      onOpen={onOpen}
      readOnly={readOnly}
      ariaLabel={`体重 ${formatKg(latest.weightGrams)} 千克${readOnly ? '' : '，点开重新记录'}`}
    >
      <span className="flex items-end justify-between gap-2">
        <span className="font-display text-title font-semibold tabular-nums">
          {formatKg(latest.weightGrams)}
          <span className="text-caption text-muted ml-0.5">kg</span>
        </span>
        {grams.length > 1 && (
          <Sparkline
            values={grams}
            label={weightTrendLabel(grams)}
            width={64}
            height={28}
            className="mb-1.5"
          />
        )}
      </span>
      <span
        className={cn(
          'text-tiny tabular-nums',
          delta !== null && delta < 0 ? 'text-success-ink' : 'text-muted',
        )}
      >
        {delta === null ? '和上周还没得比' : `比上周 ${formatKgDelta(delta)}`}
      </span>
    </MetricCard>
  )
}

export function MoodCard({
  mood,
  onOpen,
  readOnly = false,
}: {
  mood: number | null
  onOpen: () => void
  readOnly?: boolean
}) {
  if (mood === null) {
    return (
      <MetricCard
        title="今日心情"
        onOpen={onOpen}
        readOnly={readOnly}
        ariaLabel={readOnly ? '今日心情还没记' : '今日心情还没记，记一下'}
      >
        <span className="font-display text-title text-subtle font-semibold">—</span>
        <span
          className={cn('text-tiny font-semibold', readOnly ? 'text-muted' : 'text-primary-ink')}
        >
          {readOnly ? '暂未记录' : '记一下'}
        </span>
      </MetricCard>
    )
  }
  return (
    <MetricCard
      title="今日心情"
      onOpen={onOpen}
      readOnly={readOnly}
      ariaLabel={`今日心情 ${moodLabel(mood)}${readOnly ? '' : '，点开重新评'}`}
    >
      <span className="font-display text-title font-semibold">{moodLabel(mood)}</span>
      <span className="text-tiny text-muted tabular-nums">{mood} / 5 · 已记录</span>
    </MetricCard>
  )
}

/**
 * 今日步数卡：位于「今日体重 / 今日心情」下方，高度与体重卡一致（min-h-28），宽度横跨两张小卡（col-span-2）。
 * 支持手机端计步同步与全端点击手动录入，消除原布局右下角留白。
 */
export function StepsCard({
  steps,
  onOpen,
  readOnly = false,
  className,
}: {
  steps?: StepTrend
  onOpen?: () => void
  readOnly?: boolean
  className?: string
}) {
  const todaySteps = steps?.todaySteps ?? 0
  const delta = steps?.deltaSteps7d ?? null
  const values = steps?.entries.map((e) => e.steps) ?? []
  const handleOpen = onOpen ?? (() => {})

  return (
    <MetricCard
      title="今日步数"
      onOpen={handleOpen}
      readOnly={readOnly || !onOpen}
      className={className}
      ariaLabel={`今日步数 ${formatSteps(todaySteps)} 步${readOnly ? '' : '，点开记录或同步步数'}`}
    >
      <span className="flex items-end justify-between gap-3">
        <span className="font-display text-title font-semibold tabular-nums">
          {formatSteps(todaySteps)}
          <span className="text-caption text-muted ml-1">步</span>
        </span>
        {values.length > 1 ? (
          <Sparkline
            values={values}
            label={stepTrendLabel(values)}
            width={128}
            height={28}
            className="mb-1 shrink-0"
          />
        ) : (
          !readOnly && (
            <span className="bg-primary-soft text-primary-ink text-tiny mb-1 shrink-0 rounded-full px-2.5 py-0.5 font-semibold">
              记录 / 同步
            </span>
          )
        )}
      </span>
      <span
        className={cn(
          'text-tiny tabular-nums',
          delta !== null && delta > 0
            ? 'text-success-ink'
            : todaySteps === 0 && !readOnly
              ? 'text-primary-ink font-semibold'
              : 'text-muted',
        )}
      >
        {delta !== null
          ? `比上周 ${formatStepsDelta(delta)} 步`
          : todaySteps > 0
            ? '点击更新或同步今日步数'
            : readOnly
              ? '今日 0 步'
              : '点击同步或记录今日步数'}
      </span>
    </MetricCard>
  )
}
