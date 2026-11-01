import type { KeyboardEvent, ReactNode } from 'react'
import { Sparkline } from '@/components/charts/sparkline'
import { Card } from '@/components/ui/card'
import type { WeightTrend } from '@/features/metric/schemas'
import { cn } from '@/lib/cn'
import { formatKg, formatKgDelta, moodLabel, weightTrendLabel } from '../format'

/*
 * 体重卡、今日心情卡（PRD 2.8 第 3 项）。点卡片打开打卡弹层的对应视图（不另开弹层）。
 * 体重只给自己看，永不公开。
 */

/** 可点的指标卡：Card 本身做成按钮（role=button + 键盘 Enter / 空格） */
function MetricCard({
  title,
  onOpen,
  ariaLabel,
  children,
}: {
  title: string
  onOpen: () => void
  ariaLabel: string
  children: ReactNode
}) {
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
      className="flex min-h-28 flex-col gap-1"
    >
      <span className="text-tiny text-muted font-semibold">{title}</span>
      {children}
    </Card>
  )
}

export function WeightCard({ weight, onOpen }: { weight: WeightTrend; onOpen: () => void }) {
  const latest = weight.latest
  if (!latest) {
    return (
      <MetricCard title="今日体重" onOpen={onOpen} ariaLabel="今日体重还没记，记一下">
        <span className="font-display text-title text-subtle font-semibold">—</span>
        <span className="text-tiny text-primary-ink font-semibold">记一下</span>
      </MetricCard>
    )
  }
  const delta = weight.deltaGrams7d
  const grams = weight.entries.map((e) => e.weightGrams)
  return (
    <MetricCard
      title="今日体重"
      onOpen={onOpen}
      ariaLabel={`体重 ${formatKg(latest.weightGrams)} 千克，点开重新记录`}
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

export function MoodCard({ mood, onOpen }: { mood: number | null; onOpen: () => void }) {
  if (mood === null) {
    return (
      <MetricCard title="今日心情" onOpen={onOpen} ariaLabel="今日心情还没记，记一下">
        <span className="font-display text-title text-subtle font-semibold">—</span>
        <span className="text-tiny text-primary-ink font-semibold">记一下</span>
      </MetricCard>
    )
  }
  return (
    <MetricCard
      title="今日心情"
      onOpen={onOpen}
      ariaLabel={`今日心情 ${moodLabel(mood)}，点开重新评`}
    >
      <span className="font-display text-title font-semibold">{moodLabel(mood)}</span>
      <span className="text-tiny text-muted tabular-nums">{mood} / 5 · 已记录</span>
    </MetricCard>
  )
}
