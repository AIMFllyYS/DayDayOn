'use client'

import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { WelcomeSection } from './welcome-section'

/*
 * "和朋友一起"演示：迷你排行榜，点"我也打一次卡"后"你"的天数 +1，名次往上换。
 * 名单是虚构的演示数据。名次变化用 transform 位移，只动 transform。
 */

interface Row {
  id: string
  name: string
  avatar: string
  days: number
}

const FRIENDS: Row[] = [
  { id: 'a', name: '小满', avatar: 'mascot:tuan:cheer:exercise', days: 6 },
  { id: 'b', name: '阿树', avatar: 'mascot:dun:happy:study', days: 5 },
  { id: 'c', name: '小鹿', avatar: 'mascot:tuan:love:custom', days: 4 },
]
const ME_START = 3
const ROW_PX = 64

export function WelcomeFriends() {
  const [myDays, setMyDays] = useState(ME_START)
  const rows: Row[] = [
    ...FRIENDS,
    { id: 'me', name: '你', avatar: 'mascot:tuan:happy:primary', days: myDays },
  ]
  // 同天数时"你"排在后面
  const ranked = [...rows].sort((x, y) => y.days - x.days || (x.id === 'me' ? 1 : -1))
  const rankOf = new Map(ranked.map((r, i) => [r.id, i]))
  const myRank = (rankOf.get('me') ?? 0) + 1

  return (
    <WelcomeSection
      id="friends"
      ann="welcome.friends"
      eyebrow="和朋友一起"
      title="一个人容易放弃，一群人就不会"
      description="排行榜按本周、本月的打卡天数排。不想公开也可以，随时在「我的」里关掉。"
    >
      <div className="grid gap-4 @2xl:grid-cols-[1fr_auto] @2xl:items-center">
        <ol
          className="bg-surface shadow-card relative overflow-hidden rounded-2xl"
          style={{ height: rows.length * ROW_PX }}
          aria-label="演示排行榜"
        >
          {rows.map((r) => {
            const rank = rankOf.get(r.id) ?? 0
            return (
              <li
                key={r.id}
                className={cn(
                  'ease-spring absolute inset-x-0 flex items-center gap-3 px-4 transition-transform duration-(--dur-slow)',
                  r.id === 'me' && 'bg-primary-soft',
                )}
                style={{ height: ROW_PX, transform: `translateY(${rank * ROW_PX}px)` }}
              >
                <span
                  className={cn(
                    'font-display w-6 text-center font-bold tabular-nums',
                    rank === 0 ? 'text-diet-ink' : 'text-muted',
                  )}
                >
                  {rank + 1}
                </span>
                <Avatar name={r.name} avatar={r.avatar} ring={r.days >= 5} />
                <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                <span className="font-display tabular-nums">
                  {r.days}
                  <span className="text-tiny text-muted ml-0.5">天</span>
                </span>
              </li>
            )
          })}
        </ol>
        <div className="flex flex-col items-center gap-2">
          <p className="text-caption text-muted" aria-live="polite">
            你现在排第 <span className="text-foreground font-bold">{myRank}</span> 名
          </p>
          {myDays < 7 ? (
            <Button icon="flame" onClick={() => setMyDays((d) => d + 1)}>
              我也打一次卡
            </Button>
          ) : (
            <Button variant="soft" icon="undo" onClick={() => setMyDays(ME_START)}>
              再来一遍
            </Button>
          )}
          {myRank === 1 && (
            <p className="text-tiny text-diet-ink animate-pop-in flex items-center gap-1 font-semibold">
              <Icon name="trophy" size={14} />
              本周第一，朋友们要追你啦
            </p>
          )}
        </div>
      </div>
    </WelcomeSection>
  )
}
