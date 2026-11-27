import Link from 'next/link'
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
 * 体重卡、今日心情卡、今日步数卡（PRD 2.8 第 3 项）：
 * - 本人视角：点击打开打卡弹层的对应指标 Dock；
 * - 好友视角（readOnly + href）：外观与本人保持一致，点击直达好友只读指标详情页（ADR-0026）。
 */

/** 可点的指标卡：传 href 走 next/link 直达详情页；本人模式为按钮弹起 Dock；无 href 的只读态为静态卡片 */
function MetricCard({
  title,
  onOpen,
  href,
  ariaLabel,
  readOnly = false,
  className,
  children,
}: {
  title: string
  onOpen: () => void
  href?: string
  ariaLabel: string
  readOnly?: boolean
  className?: string
  children: ReactNode
}) {
  if (href) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel}
        className={cn(
          'focus-visible:ring-primary/50 block rounded-2xl focus-visible:ring-2 focus-visible:outline-none',
          className,
        )}
      >
        <Card interactive className="flex h-full min-h-28 flex-col gap-1">
          <span className="text-tiny text-muted font-semibold">{title}</span>
          {children}
        </Card>
      </Link>
    )
  }

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
  href,
  readOnly = false,
}: {
  weight: WeightTrend
  onOpen: () => void
  href?: string
  readOnly?: boolean
}) {
  const latest = weight.latest
  if (!latest) {
    return (
      <MetricCard
        title="今日体重"
        onOpen={onOpen}
        href={href}
        readOnly={readOnly}
        ariaLabel={
          href
            ? '今日体重还没记，点开查看好友体重详情'
            : readOnly
              ? '今日体重还没记'
              : '今日体重还没记，记一下'
        }
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
      href={href}
      readOnly={readOnly}
      ariaLabel={`体重 ${formatKg(latest.weightGrams)} 千克${href ? '，点开查看好友体重详情' : readOnly ? '' : '，点开重新记录'}`}
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
  href,
  readOnly = false,
}: {
  mood: number | null
  onOpen: () => void
  href?: string
  readOnly?: boolean
}) {
  if (mood === null) {
    return (
      <MetricCard
        title="今日心情"
        onOpen={onOpen}
        href={href}
        readOnly={readOnly}
        ariaLabel={
          href
            ? '今日心情还没记，点开查看好友心情详情'
            : readOnly
              ? '今日心情还没记'
              : '今日心情还没记，记一下'
        }
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
      href={href}
      readOnly={readOnly}
      ariaLabel={`今日心情 ${moodLabel(mood)}${href ? '，点开查看好友心情详情' : readOnly ? '' : '，点开重新评'}`}
    >
      <span className="font-display text-title font-semibold">{moodLabel(mood)}</span>
      <span className="text-tiny text-muted tabular-nums">{mood} / 5 · 已记录</span>
    </MetricCard>
  )
}

/**
 * 今日步数卡：位于「今日体重 / 今日心情」下方，高度与体重卡一致（min-h-28），宽度横跨两张小卡（col-span-2）。
 * 支持手机端计步同步与全端点击手动录入；好友视角点击直达好友步数详情页。
 */
export function StepsCard({
  steps,
  onOpen,
  href,
  readOnly = false,
  className,
}: {
  steps?: StepTrend
  onOpen?: () => void
  href?: string
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
      href={href}
      readOnly={readOnly || (!onOpen && !href)}
      className={className}
      ariaLabel={`今日步数 ${formatSteps(todaySteps)} 步${href ? '，点开查看好友步数详情' : readOnly ? '' : '，点开记录或同步步数'}`}
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
            ? readOnly
              ? '已记录今日步数'
              : '点击更新或同步今日步数'
            : readOnly
              ? '今日 0 步'
              : '点击同步或记录今日步数'}
      </span>
    </MetricCard>
  )
}
