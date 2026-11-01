'use client'

import { HomeDashboard } from '@/features/dashboard/components/home-dashboard'
import type { DashboardToday } from '@/features/dashboard/schemas'
import { useCheckinLauncher } from '@/features/checkin/launcher-store'

/*
 * 主页（仪表盘，固定布局，PRD 2.8）。渲染正式组件 HomeDashboard，数据是演示用的，不接后端。
 * 区块顺序：提醒 → 今日总览（贴纸卡）→ 今日进度 → 本周热力图；右栏 体重 / 心情 → 榜单动态。
 */

const DEMO_NOW = Date.parse('2026-11-01T13:20:00Z')
const id = (n: number) => `0193f6b2-0000-7000-8000-${String(n).padStart(12, '0')}`

const demo: DashboardToday = {
  localDate: '2026-11-01',
  timeZone: 'Asia/Shanghai',
  completion: { done: 3, planned: 4 },
  streak: 12,
  hasGoals: true,
  goals: [
    {
      goalId: id(1),
      module: 'exercise',
      title: '动一动',
      target: { kind: 'duration', value: 1800 },
      planned: true,
      progress: { value: 1920, target: 1800, done: true },
      sortOrder: 0,
    },
    {
      goalId: id(2),
      module: 'diet',
      title: '好好吃饭',
      target: { kind: 'count', value: 3 },
      planned: true,
      progress: { value: 2, target: 3, done: false },
      sortOrder: 1,
    },
    {
      goalId: id(3),
      module: 'sleep',
      title: '早点睡',
      target: { kind: 'duration', value: 28_800 },
      planned: true,
      progress: { value: 29_100, target: 28_800, done: true },
      sortOrder: 2,
    },
    {
      goalId: id(4),
      module: 'study',
      title: '学一点',
      target: { kind: 'count', value: 2 },
      planned: true,
      progress: { value: 2, target: 2, done: true },
      sortOrder: 3,
    },
  ],
  weight: {
    entries: [53_000, 52_900, 52_950, 52_700, 52_600, 52_500, 52_400].map((g, i) => ({
      localDate: `2026-10-${String(26 + i).padStart(2, '0')}`,
      weightGrams: g,
      measuredAt: `2026-10-${String(26 + i).padStart(2, '0')}T00:00:00.000Z`,
    })),
    latest: {
      localDate: '2026-11-01',
      weightGrams: 52_400,
      measuredAt: '2026-11-01T00:10:00.000Z',
    },
    deltaGrams7d: -600,
  },
  mood: 4,
  heatmap: {
    days: [
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ],
    rows: [
      { module: 'exercise', cells: [1, 1, 0, 1, 0.5, 1, 1] },
      { module: 'diet', cells: [1, 0.67, 1, 1, 0.33, 0.67, 0.67] },
      { module: 'sleep', cells: [1, 1, 1, 0, 1, 1, 1] },
      { module: 'study', cells: [0.5, 1, 1, 0.5, 0, 0, 1] },
      { module: 'custom', cells: [0, 0, 0, 0, 0, 0, 0] },
    ],
  },
  feed: [
    {
      id: id(11),
      userId: 'u-ayou',
      nickname: '阿柚',
      avatar: 'mascot:tuan:cheer:exercise',
      module: 'exercise',
      occurredAt: '2026-10-31T23:42:00.000Z',
    },
    {
      id: id(12),
      userId: 'u-doudou',
      nickname: '豆豆',
      avatar: null,
      module: 'study',
      occurredAt: '2026-11-01T01:15:00.000Z',
    },
    {
      id: id(13),
      userId: 'u-qiqi',
      nickname: '七七',
      avatar: 'mascot:dun:sleepy:sleep',
      module: 'sleep',
      occurredAt: '2026-10-31T15:05:00.000Z',
    },
  ],
  reminder: { remaining: 1 },
}

export function HomeScreen() {
  const launcher = useCheckinLauncher()
  return (
    <HomeDashboard
      data={demo}
      now={DEMO_NOW}
      timeZone="Asia/Shanghai"
      onOpenWeight={() => launcher.open('weight')}
      onOpenMood={() => launcher.open('mood')}
    />
  )
}
