import Link from 'next/link'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import type { RankBoard as RankBoardData, RankEntry } from '../schemas'
import { myRankNote, rangeLength } from '../format'

/*
 * 排行榜的展示部分（PRD 2.9，原型 RankScreen）：领奖台 → 列表 → "我"固定在底部 → 说明。
 * 只显示昵称、头像、打卡天数、连续天数。正式页面和 Playbook 共用。
 */

// 领奖台按 2-1-3 排列，中间最高
const PODIUM_ORDER = [1, 0, 2] as const
const PODIUM_HEIGHT = ['h-20', 'h-14', 'h-10'] as const

export function RankBoard({ board }: { board: RankBoardData }) {
  const unit = `/ ${rangeLength(board.from, board.to)} 天`
  const meId = board.me.optedIn ? board.me.entry.userId : null
  const podium = board.entries.slice(0, 3)
  const rest = board.entries.slice(3)

  return (
    <div className="grid gap-3">
      {board.entries.length === 0 ? (
        <Card variant="sticker">
          <EmptyState
            mood="sleepy"
            title={board.range === 'week' ? '这周还没有人上榜' : '这个月还没有人上榜'}
            description="打一次卡就能出现在这里"
          />
        </Card>
      ) : (
        <Card variant="sticker" key={board.range} className="animate-fade-up pt-6">
          <ol className="flex items-end justify-center gap-3" aria-label="前三名">
            {PODIUM_ORDER.map((i) => {
              const e = podium[i]
              if (!e) return null
              return (
                <li key={e.userId} className="flex w-20 flex-col items-center gap-1.5">
                  {i === 0 && <Icon name="trophy" size={22} className="text-diet-ink" />}
                  <Avatar
                    name={e.nickname}
                    avatar={e.avatar}
                    size={i === 0 ? 'lg' : 'md'}
                    ring={i === 0}
                  />
                  <span className="text-caption w-full truncate text-center font-semibold">
                    {e.nickname}
                    {e.userId === meId && <span className="text-primary-ink">（我）</span>}
                  </span>
                  <span className="font-display text-tiny text-muted tabular-nums">
                    {e.days} 天
                  </span>
                  <div
                    className={cn(
                      'bg-surface-sunken flex w-full items-start justify-center rounded-t-xl pt-1.5',
                      PODIUM_HEIGHT[i],
                    )}
                  >
                    <span className="font-display text-heading text-muted font-semibold">
                      <span className="sr-only">第</span>
                      {e.rank}
                      <span className="sr-only">名</span>
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
        </Card>
      )}

      {rest.length > 0 && (
        <ol
          start={4}
          className="bg-surface shadow-soft divide-border divide-y overflow-hidden rounded-2xl"
        >
          {rest.map((e) => (
            <RankRow key={e.userId} entry={e} unit={unit} me={e.userId === meId} />
          ))}
        </ol>
      )}

      {board.me.optedIn ? (
        <div className="bg-primary-soft sticky bottom-[calc(var(--safe-bottom)+6.5rem)] z-10 flex min-h-14 items-center gap-3 rounded-2xl px-4 py-2.5 md:bottom-4">
          <span className="font-display text-primary-ink w-6 text-center font-semibold tabular-nums">
            {board.me.entry.rank}
          </span>
          <Avatar name={board.me.entry.nickname} avatar={board.me.entry.avatar} size="sm" />
          <span className="text-primary-ink min-w-0 flex-1 font-semibold">
            {myRankNote(board.me)}
          </span>
          <span className="font-display text-primary-ink text-caption font-semibold tabular-nums">
            {board.me.entry.days}
            <span className="text-tiny ml-0.5 font-normal">{unit}</span>
          </span>
        </div>
      ) : (
        <div className="bg-surface-sunken flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
          <Icon name="trophy" size={20} className="text-muted shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">你还没加入排行榜</span>
            <span className="text-tiny text-muted">加入后朋友能看到你的打卡天数和连续天数</span>
          </span>
          <Link
            href="/me"
            className="bg-primary-soft text-primary-ink text-caption inline-flex h-11 items-center gap-1 rounded-full px-4 font-semibold"
          >
            去「我的」打开
            <Icon name="chevron-right" size={16} />
          </Link>
        </div>
      )}

      <p className="text-tiny text-muted text-center">
        只显示选择公开的朋友 · 补卡不计入 · 体重等数据不参与排行（北京时间）
      </p>
    </div>
  )
}

function RankRow({ entry, unit, me }: { entry: RankEntry; unit: string; me: boolean }) {
  return (
    <li className={cn('flex min-h-14 items-center gap-3 px-4 py-2', me && 'bg-primary-soft/50')}>
      <span className="font-display text-muted w-6 text-center font-semibold tabular-nums">
        {entry.rank}
      </span>
      <Avatar name={entry.nickname} avatar={entry.avatar} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">
          {entry.nickname}
          {me && <span className="text-primary-ink">（我）</span>}
        </span>
        <span className="text-tiny text-muted">连续 {entry.streak} 天</span>
      </span>
      {entry.streak >= 7 && (
        <Badge tone="primary" icon="flame">
          {entry.streak}
        </Badge>
      )}
      <span className="font-display text-caption font-semibold tabular-nums">
        {entry.days}
        <span className="text-tiny text-muted ml-0.5 font-normal">{unit}</span>
      </span>
    </li>
  )
}
