import Link from 'next/link'
import { AvatarStack } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ProgressRing } from '@/components/ui/progress'
import { Stamp } from '@/components/ui/stamp'
import type { FeedItem } from '@/features/rank/schemas'
import { daysBetween } from '@/lib/time'
import { completionPercent, stampCaption, summaryTitle } from '../format'
import type { OverallProgress } from '../schemas'

/** 今日总览贴纸卡（PRD 2.8 第 1 项）：今日完成度环 + 连续天数 + 总坚持进度环 + 日期印章 */
export function SummaryCard({
  localDate,
  completion,
  streak,
  feed,
  overall,
  readOnly = false,
}: {
  localDate: string
  completion: { done: number; planned: number }
  streak: number
  /** 最近在打卡的朋友（去重后叠放头像） */
  feed: readonly FeedItem[]
  /** 总打卡进度（已打卡天数 / 目标坚持天数） */
  overall?: OverallProgress
  readOnly?: boolean
}) {
  const percent = completionPercent(completion)
  const allDone = completion.planned > 0 && completion.done >= completion.planned
  const friends = uniqueByUser(feed).slice(0, 5)
  const remainingDays =
    overall?.deadlineDate && overall.deadlineDate >= localDate
      ? daysBetween(localDate, overall.deadlineDate)
      : overall?.deadlineDate
        ? 0
        : null

  return (
    <Card variant="sticker" className="relative overflow-hidden">
      <div className="flex items-start gap-4">
        <ProgressRing
          value={completion.done}
          max={Math.max(1, completion.planned)}
          size={84}
          thickness={9}
          label={`今日完成度：${completion.done} / ${completion.planned}`}
        >
          <span className="font-display text-heading font-semibold tabular-nums">
            {percent === null ? '—' : `${percent}%`}
          </span>
        </ProgressRing>
        <div className="min-w-0 flex-1 pr-14">
          <h2 className="text-heading font-bold">{summaryTitle(completion)}</h2>
          <p className="text-caption text-muted mt-0.5 tabular-nums">
            完成了 {completion.done} / {completion.planned} 个目标
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone="primary" icon="flame">
              连续 {streak} 天
            </Badge>
            {friends.length > 0 && (
              <AvatarStack
                names={friends.map((f) => f.nickname)}
                avatars={friends.map((f) => f.avatar)}
                max={3}
              />
            )}
          </div>
        </div>
      </div>

      {overall && (
        <div className="bg-surface-sunken/75 mt-3.5 flex items-center gap-3 rounded-2xl px-3 py-2.5">
          <ProgressRing
            value={overall.checkedDays}
            max={Math.max(1, overall.targetDays)}
            tone="success"
            size={60}
            thickness={6}
            label={`总坚持进度：已打卡 ${overall.checkedDays} 天，目标 ${overall.targetDays} 天`}
          >
            <span className="flex flex-col items-center leading-none tabular-nums">
              <span className="font-display text-caption font-bold">{overall.checkedDays}</span>
              <span className="text-tiny text-muted">/{overall.targetDays}</span>
            </span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-caption font-bold">总打卡进度</span>
              <Badge tone={overall.hasDeadline ? 'success' : 'neutral'}>
                {overall.hasDeadline ? `${overall.targetDays} 天周期` : '阶段里程碑'}
              </Badge>
            </div>
            <p className="text-tiny text-muted mt-0.5 tabular-nums">
              已打卡 {overall.checkedDays} / {overall.targetDays} 天
              {overall.deadlineDate
                ? ` · 截止 ${stampCaption(overall.deadlineDate)}${remainingDays !== null ? `（${remainingDays === 0 ? '今天到期' : `剩 ${remainingDays} 天`}）` : ''}`
                : ' · 可在目标设置里定总周期'}
            </p>
          </div>
          {!readOnly && (
            <Link
              href="/goals"
              className="text-tiny text-primary-ink hover:bg-primary-soft shrink-0 rounded-full px-3 py-1.5 font-semibold transition-colors"
            >
              {overall.hasDeadline ? '调整周期' : '去设周期'}
            </Link>
          )}
        </div>
      )}

      <Stamp
        text={allDone ? '全完成' : '今天'}
        caption={stampCaption(localDate)}
        size={64}
        className="absolute top-3 right-3"
      />
    </Card>
  )
}

function uniqueByUser(feed: readonly FeedItem[]): FeedItem[] {
  const seen = new Set<string>()
  return feed.filter((f) => {
    if (seen.has(f.userId)) return false
    seen.add(f.userId)
    return true
  })
}
