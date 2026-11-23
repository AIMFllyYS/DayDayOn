import Link from 'next/link'
import { AvatarStack } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { ProgressBar, ProgressRing } from '@/components/ui/progress'
import { Stamp } from '@/components/ui/stamp'
import type { FeedItem } from '@/features/rank/schemas'
import { daysBetween } from '@/lib/time'
import { completionPercent, stampCaption } from '../format'
import type { OverallProgress } from '../schemas'

/**
 * 今日与周期进度贴纸卡：
 * - 上半区明确聚焦「今日打卡」（圆形百分比环内标明「今日」+ 今日已完成项数 + 连续天数 + 日期印章），不再混入鸡汤标题；
 * - 下半区聚焦「总打卡进度」（横向进度条 + 已打卡天数 / 目标天数），与上方今日百分比环视觉区分、彻底消除歧义。
 */
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
    <Card variant="sticker" className="relative overflow-hidden p-4">
      {/* 上半区：今日打卡进度 */}
      <div className="flex items-center gap-3.5">
        <ProgressRing
          value={completion.done}
          max={Math.max(1, completion.planned)}
          size={72}
          thickness={7.5}
          label={`今日完成度：${completion.done} / ${completion.planned}`}
          className="shrink-0"
        >
          <span className="flex flex-col items-center leading-none tabular-nums">
            <span className="font-display text-subhead font-bold">
              {percent === null ? '—' : `${percent}%`}
            </span>
            <span className="text-tiny text-muted mt-0.5">今日</span>
          </span>
        </ProgressRing>

        <div className="min-w-0 flex-1 pr-14">
          <p className="text-tiny text-muted font-semibold">今日打卡</p>
          <h2 className="text-subhead mt-0.5 font-bold tabular-nums">
            {completion.planned > 0
              ? `已完成 ${completion.done} / ${completion.planned} 项`
              : '今日暂无安排'}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone="primary" icon="flame" size="sm">
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

      {/* 下半区：总打卡进度（横向进度条 + 天数，与上方今日百分比环清晰区分） */}
      {overall && (
        <div className="bg-surface-sunken/75 mt-3 flex flex-col gap-1.5 rounded-2xl px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="text-caption font-bold">总打卡进度</span>
              <Badge tone={overall.hasDeadline ? 'success' : 'neutral'} size="sm">
                {overall.hasDeadline ? `${overall.targetDays} 天周期` : '阶段里程碑'}
              </Badge>
            </div>
            <span className="font-display text-caption text-foreground shrink-0 font-bold tabular-nums">
              已打卡 {overall.checkedDays} / {overall.targetDays} 天
            </span>
          </div>

          <ProgressBar
            value={overall.checkedDays}
            max={Math.max(1, overall.targetDays)}
            tone="success"
            label={`总坚持进度：已打卡 ${overall.checkedDays} 天，目标 ${overall.targetDays} 天`}
          />

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <p className="text-tiny text-muted truncate tabular-nums">
              {overall.deadlineDate
                ? `截止 ${stampCaption(overall.deadlineDate)}${remainingDays !== null ? ` · ${remainingDays === 0 ? '今天到期' : `剩 ${remainingDays} 天`}` : ''}`
                : '可在目标设置里定总周期'}
            </p>
            {!readOnly && (
              <Link
                href="/goals"
                className="text-tiny text-primary-ink inline-flex shrink-0 items-center gap-0.5 font-semibold hover:underline"
              >
                <span>{overall.hasDeadline ? '调整周期' : '去设周期'}</span>
                <Icon name="chevron-right" size={12} lineOnly />
              </Link>
            )}
          </div>
        </div>
      )}

      <Stamp
        text={allDone ? '全完成' : '今天'}
        caption={stampCaption(localDate)}
        size={58}
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
