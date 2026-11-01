import { AvatarStack } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ProgressRing } from '@/components/ui/progress'
import { Stamp } from '@/components/ui/stamp'
import type { FeedItem } from '@/features/rank/schemas'
import { completionPercent, stampCaption, summaryTitle } from '../format'

/** 今日总览贴纸卡（PRD 2.8 第 1 项）：完成度环 + 连续天数 + 今天的日期印章 */
export function SummaryCard({
  localDate,
  completion,
  streak,
  feed,
}: {
  localDate: string
  completion: { done: number; planned: number }
  streak: number
  /** 最近在打卡的朋友（去重后叠放头像） */
  feed: readonly FeedItem[]
}) {
  const percent = completionPercent(completion)
  const allDone = completion.planned > 0 && completion.done >= completion.planned
  const friends = uniqueByUser(feed).slice(0, 5)

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
