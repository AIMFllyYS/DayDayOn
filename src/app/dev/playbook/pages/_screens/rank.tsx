'use client'

import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { SegmentedControl } from '@/components/ui/segmented-control'
import type { Tone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'

/*
 * 排行榜（ADR-0002 第 8 节）：只显示公开用户的聚合数据（打卡天数、连续天数），不显示体重等精确指标。
 * 前三名做成领奖台，其余是列表；"我"固定在底部。
 */
const ranges = [
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
] as const

interface Row {
  name: string
  tone: Tone
  days: number
  streak: number
}

const board: Record<(typeof ranges)[number]['value'], Row[]> = {
  week: [
    { name: '阿柚', tone: 'exercise', days: 7, streak: 21 },
    { name: '七七', tone: 'sleep', days: 7, streak: 12 },
    { name: '小满', tone: 'primary', days: 6, streak: 12 },
    { name: '豆豆', tone: 'study', days: 6, streak: 4 },
    { name: '南风', tone: 'diet', days: 5, streak: 5 },
    { name: '一一', tone: 'custom', days: 4, streak: 2 },
  ],
  month: [
    { name: '七七', tone: 'sleep', days: 30, streak: 12 },
    { name: '阿柚', tone: 'exercise', days: 29, streak: 21 },
    { name: '豆豆', tone: 'study', days: 26, streak: 4 },
    { name: '小满', tone: 'primary', days: 25, streak: 12 },
    { name: '南风', tone: 'diet', days: 22, streak: 5 },
    { name: '一一', tone: 'custom', days: 18, streak: 2 },
  ],
}

const ME = '小满'
// 领奖台按 2-1-3 排列，中间最高
const podiumOrder = [1, 0, 2] as const
const podiumHeight = ['h-20', 'h-14', 'h-10'] as const

export function RankScreen() {
  const [range, setRange] = useState<(typeof ranges)[number]['value']>('week')
  const rows = board[range]
  const meIndex = rows.findIndex((r) => r.name === ME)
  const me = rows[meIndex]
  const unit = range === 'week' ? '/ 7 天' : '/ 30 天'

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-3">
      <SegmentedControl options={ranges} value={range} onValueChange={setRange} label="排行范围" />

      <Card variant="sticker" key={range} className="animate-fade-up pt-6">
        <div className="flex items-end justify-center gap-3">
          {podiumOrder.map((i) => {
            const r = rows[i]
            if (!r) return null
            return (
              <div key={r.name} className="flex w-20 flex-col items-center gap-1.5">
                {i === 0 && <Icon name="trophy" size={22} className="text-diet-ink" />}
                <Avatar name={r.name} tone={r.tone} size={i === 0 ? 'lg' : 'md'} ring={i === 0} />
                <span className="text-caption truncate font-semibold">{r.name}</span>
                <div
                  className={cn(
                    'bg-surface-sunken flex w-full items-start justify-center rounded-t-xl pt-1.5',
                    podiumHeight[i],
                  )}
                >
                  <span className="font-display text-heading text-muted font-semibold">
                    {i + 1}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <ul className="bg-surface shadow-soft divide-border divide-y overflow-hidden rounded-2xl">
        {rows.slice(3).map((r, i) => (
          <RankRow key={r.name} row={r} place={i + 4} unit={unit} me={r.name === ME} />
        ))}
      </ul>

      {me && meIndex >= 0 && (
        <div className="bg-primary-soft flex items-center gap-3 rounded-2xl px-4 py-2.5">
          <span className="font-display text-primary-ink w-6 text-center font-semibold">
            {meIndex + 1}
          </span>
          <Avatar name={me.name} tone={me.tone} size="sm" />
          <span className="text-primary-ink min-w-0 flex-1 font-semibold">
            我 · 再打卡 1 天追上前一名
          </span>
          <span className="font-display text-primary-ink text-caption font-semibold tabular-nums">
            {me.days}
          </span>
        </div>
      )}
      <p className="text-tiny text-muted text-center">
        只显示选择公开的朋友 · 体重等数据不参与排行
      </p>
    </div>
  )
}

function RankRow({ row, place, unit, me }: { row: Row; place: number; unit: string; me: boolean }) {
  return (
    <li className={cn('flex min-h-14 items-center gap-3 px-4 py-2', me && 'bg-primary-soft/50')}>
      <span className="font-display text-muted w-6 text-center font-semibold">{place}</span>
      <Avatar name={row.name} tone={row.tone} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{row.name}</span>
        <span className="text-tiny text-muted">连续 {row.streak} 天</span>
      </span>
      {row.streak >= 7 && (
        <Badge tone="primary" icon="flame">
          {row.streak}
        </Badge>
      )}
      <span className="font-display text-caption font-semibold tabular-nums">
        {row.days}
        <span className="text-tiny text-muted ml-0.5 font-normal">{unit}</span>
      </span>
    </li>
  )
}
