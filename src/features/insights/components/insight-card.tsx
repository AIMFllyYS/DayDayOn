import Link from 'next/link'
import { BarChart } from '@/components/charts/bar-chart'
import { Sparkline } from '@/components/charts/sparkline'
import { Badge, IconTile } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { moduleMeta } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
import { insightView } from '../format'
import type { GoalInsight } from '../schemas'

/*
 * 板块近况卡：主页小组件、目标详情、对话里 showStats 的结果都用它（一份组件，三处用）。
 * - compact：主页两列网格里的小卡（主数字 + 达标率 + 迷你走势）
 * - full：整宽（主数字 + 每日柱状图 + 门槛线 + 最常卡住的规则 + 期限）
 * 传 href 时整张卡可点（进目标详情）。
 */

export function InsightCard({
  insight,
  days,
  size = 'compact',
  href,
  className,
}: {
  insight: GoalInsight
  days: number
  size?: 'compact' | 'full'
  href?: string
  className?: string
}) {
  const meta = moduleMeta[insight.module]
  const view = insightView(insight, days)
  const full = size === 'full'

  const body = (
    <Card
      interactive={href !== undefined}
      className={cn('flex h-full flex-col gap-2', full ? 'p-4' : 'p-3.5 md:p-4', className)}
    >
      <div className="flex min-w-0 items-center gap-2">
        <IconTile icon={meta.icon} tone={insight.module} size="sm" />
        <span className="text-caption min-w-0 flex-1 truncate font-bold">{insight.title}</span>
        {view.rate && full && (
          <Badge tone={view.rateTone} size="sm">
            {view.rate}
          </Badge>
        )}
      </div>

      <div className="flex items-end justify-between gap-2">
        <span className="flex min-w-0 flex-col">
          <span
            className={cn(
              'font-display leading-tight font-semibold whitespace-nowrap tabular-nums',
              full ? 'text-title' : 'text-heading',
            )}
          >
            {view.value}
            {view.unit && <span className="text-caption text-muted ml-0.5">{view.unit}</span>}
          </span>
          {!full && (
            <span className={cn('text-tiny truncate', view.rate ? 'text-muted' : 'text-subtle')}>
              {view.rate ?? `近 ${days} 天还没打卡`}
            </span>
          )}
        </span>
        {!full && view.bars.some((v) => v !== null) && (
          <Sparkline
            values={view.bars}
            label={view.chartLabel}
            tone={insight.module}
            width={64}
            height={28}
            className="mb-1 shrink-0"
          />
        )}
      </div>

      {full && (
        <>
          <p className="text-tiny text-muted">{view.note}</p>
          <BarChart
            values={view.bars}
            label={view.chartLabel}
            tone={insight.module}
            threshold={view.threshold}
          />
          <div className="text-tiny text-subtle flex justify-between">
            <span>{days} 天前</span>
            <span>今天</span>
          </div>
          {view.failure && (
            <p className="text-tiny text-warning-ink flex items-start gap-1.5">
              <Icon name="alert" size={13} className="mt-px shrink-0" />
              {view.failure}
            </p>
          )}
          {view.deadline && (
            <p className="text-tiny text-muted flex items-center gap-1.5">
              <Icon name="clock" size={13} className="shrink-0" />
              {view.deadline}
            </p>
          )}
          {view.empty && (
            <p className="text-tiny text-subtle">近 {days} 天还没打卡，记一次就有走势了</p>
          )}
        </>
      )}
    </Card>
  )

  if (!href) return body
  return (
    <Link
      href={href}
      aria-label={`${insight.title}：${view.value}${view.unit}，${view.rate ?? '还没打卡'}`}
      className="block h-full rounded-2xl"
    >
      {body}
    </Link>
  )
}

/** 多个目标的近况：手机两列小卡，宽屏三列 */
export function InsightGrid({
  items,
  days,
  linkToGoal = true,
}: {
  items: readonly GoalInsight[]
  days: number
  linkToGoal?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-3">
      {items.map((i) => (
        <InsightCard
          key={i.goalId}
          insight={i}
          days={days}
          href={linkToGoal ? `/goals/${i.goalId}` : undefined}
        />
      ))}
    </div>
  )
}
