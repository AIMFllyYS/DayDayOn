'use client'

import { useState } from 'react'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { RankBoard } from '@/features/rank/components/rank-board'
import type { RankBoard as RankBoardData, RankEntry, RankRange } from '@/features/rank/schemas'

/*
 * 排行榜（PRD 2.9、ADR-0002 第 8 节）。渲染正式组件 RankBoard，数据是演示用的，不接后端。
 * 只显示公开用户的聚合数据（打卡天数、连续天数）；前三名领奖台，其余列表，"我"固定在底部。
 * 第三个选项演示"我没上榜"时的提示。
 */
const ranges = [
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'hidden', label: '未上榜' },
] as const
type DemoRange = (typeof ranges)[number]['value']

type Row = Omit<RankEntry, 'rank'>
const people: Record<RankRange, Row[]> = {
  week: [
    { userId: 'u1', nickname: '阿柚', avatar: 'mascot:tuan:cheer:exercise', days: 7, streak: 21 },
    { userId: 'u2', nickname: '七七', avatar: 'mascot:dun:sleepy:sleep', days: 7, streak: 12 },
    { userId: 'me', nickname: '小满', avatar: null, days: 6, streak: 12 },
    { userId: 'u3', nickname: '豆豆', avatar: null, days: 6, streak: 4 },
    { userId: 'u4', nickname: '南风', avatar: 'mascot:tuan:happy:diet', days: 5, streak: 5 },
    { userId: 'u5', nickname: '一一', avatar: null, days: 4, streak: 2 },
  ],
  month: [
    { userId: 'u2', nickname: '七七', avatar: 'mascot:dun:sleepy:sleep', days: 30, streak: 12 },
    { userId: 'u1', nickname: '阿柚', avatar: 'mascot:tuan:cheer:exercise', days: 29, streak: 21 },
    { userId: 'u3', nickname: '豆豆', avatar: null, days: 26, streak: 4 },
    { userId: 'me', nickname: '小满', avatar: null, days: 25, streak: 12 },
    { userId: 'u4', nickname: '南风', avatar: 'mascot:tuan:happy:diet', days: 22, streak: 5 },
    { userId: 'u5', nickname: '一一', avatar: null, days: 18, streak: 2 },
  ],
}

function demoBoard(range: DemoRange): RankBoardData {
  const real: RankRange = range === 'month' ? 'month' : 'week'
  const entries = people[real].map((r, i) => ({ ...r, rank: i + 1 }))
  const meIndex = entries.findIndex((e) => e.userId === 'me')
  const me = entries[meIndex]
  const prev = entries[meIndex - 1]
  const visible = range === 'hidden' ? entries.filter((e) => e.userId !== 'me') : entries
  return {
    range: real,
    from: real === 'week' ? '2026-10-26' : '2026-11-01',
    to: real === 'week' ? '2026-11-01' : '2026-11-30',
    entries: visible.map((e, i) => ({ ...e, rank: i + 1 })),
    me:
      range === 'hidden' || !me
        ? { optedIn: false }
        : {
            optedIn: true,
            entry: me,
            daysToNext: prev && prev.days > me.days ? prev.days - me.days : null,
          },
  }
}

export function RankScreen() {
  const [range, setRange] = useState<DemoRange>('week')
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-3">
      <SegmentedControl options={ranges} value={range} onValueChange={setRange} label="排行范围" />
      <RankBoard board={demoBoard(range)} />
    </div>
  )
}
