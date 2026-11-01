import { Avatar } from '@/components/ui/avatar'
import { IconTile } from '@/components/ui/badge'
import { moduleMeta } from '@/components/ui/tone'
import type { FeedItem } from '../schemas'
import { feedTimeLabel } from '../format'

/*
 * 榜单动态列表（PRD 2.8 第 5 项）："阿柚 · 完成了运动 · 07:42"。
 * 只有昵称、头像、板块和时间，不含数值和备注；不做点赞评论。
 */
export function FeedList({
  items,
  now,
  timeZone,
}: {
  items: readonly FeedItem[]
  /** 渲染时刻（区分"今天 / 昨天"） */
  now: number
  /** 显示时间用的时区：当前用户的时区 */
  timeZone: string
}) {
  return (
    <ul className="grid gap-2.5">
      {items.map((f) => {
        const meta = moduleMeta[f.module]
        const time = feedTimeLabel(f.occurredAt, now, timeZone)
        return (
          <li key={f.id} className="flex items-center gap-2.5">
            <Avatar name={f.nickname} avatar={f.avatar} tone={f.module} size="sm" />
            <span className="text-caption min-w-0 flex-1 truncate">
              <span className="font-semibold">{f.nickname}</span>
              <span className="text-muted"> · 完成了{meta.label}</span>
            </span>
            <IconTile icon={meta.icon} tone={f.module} size="sm" />
            <time dateTime={f.occurredAt} className="text-tiny text-muted w-16 shrink-0 text-right">
              {time}
            </time>
          </li>
        )
      })}
    </ul>
  )
}
