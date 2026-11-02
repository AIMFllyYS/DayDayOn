'use client'

import { useRef, useState } from 'react'
import { InteractivePet, type PetHandle } from '@/components/mascot/interactive-pet'
import { Mascot } from '@/components/mascot/mascot'
import { characterName, type MascotRegistryCharacter } from '@/components/mascot/mascot-svg'
import { TreatGlyph } from '@/components/mascot/treat-glyph'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { HomeDashboard } from '@/features/dashboard/components/home-dashboard'
import type { DashboardToday } from '@/features/dashboard/schemas'
import { useCheckinLauncher } from '@/features/checkin/launcher-store'
import { friendActions, useFriendStore } from '@/features/friend/friend-store'
import { PLAYBOOK_DEMO_FRIENDS } from './app-shell'

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

const FRIEND_MASCOTS: Record<string, MascotRegistryCharacter> = {
  'u-ayou': 'tuan',
  'u-doudou': 'dun',
  'u-qiqi': 'mian',
}

export function HomeScreen({ thumb = false }: { thumb?: boolean }) {
  const launcher = useCheckinLauncher()
  const { viewingFriendId } = useFriendStore()
  const petRef = useRef<PetHandle>(null)
  const [actionToast, setActionToast] = useState<string | null>(null)
  const activeFriend = PLAYBOOK_DEMO_FRIENDS.find((f) => f.userId === viewingFriendId) ?? null
  const friendMascot: MascotRegistryCharacter = activeFriend
    ? (FRIEND_MASCOTS[activeFriend.userId] ?? 'tuan')
    : 'tuan'

  const currentData: DashboardToday = activeFriend
    ? {
        ...demo,
        completion: { done: activeFriend.todayDone, planned: activeFriend.todayPlanned },
        streak: activeFriend.streak,
        mood: activeFriend.todayMood,
        reminder: null,
      }
    : demo

  return (
    <HomeDashboard
      data={currentData}
      now={DEMO_NOW}
      timeZone="Asia/Shanghai"
      onOpenWeight={() => launcher.open('weight')}
      onOpenMood={() => launcher.open('mood')}
      readOnly={Boolean(activeFriend)}
      friendBanner={
        activeFriend ? (
          <Card
            variant="sticker"
            className="bg-[radial-gradient(ellipse_at_50%_25%,var(--surface)_0%,var(--background)_65%,var(--surface-sunken)_100%)] p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar
                  name={activeFriend.nickname}
                  avatar={activeFriend.avatar}
                  size="sm"
                  ring={activeFriend.streak > 0}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-caption text-foreground truncate font-bold">
                      {activeFriend.nickname} 的小窝
                    </span>
                    <Badge tone="diet" icon="flame">
                      {activeFriend.streak} 天
                    </Badge>
                  </div>
                  <div className="text-tiny text-muted truncate">
                    陪伴伙伴：{characterName(friendMascot)} · 只读小窝模式（已隐藏个人 AI 悬浮团团）
                  </div>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setActionToast(null)
                  friendActions.selectFriend(null)
                }}
                className="shrink-0"
              >
                返回我的主页
              </Button>
            </div>

            <div className="my-3 flex flex-col items-center">
              {thumb ? (
                <Mascot
                  character={friendMascot}
                  mood={activeFriend.todayDone >= activeFriend.todayPlanned ? 'cheer' : 'happy'}
                  size={104}
                />
              ) : (
                <InteractivePet
                  ref={petRef}
                  character={friendMascot}
                  size={128}
                  idleSleepMs={0}
                  speech
                />
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  petRef.current?.play('shy')
                  setActionToast(
                    `已戳了戳 ${activeFriend.nickname} 的${characterName(friendMascot)}～`,
                  )
                }}
                className="border-border bg-surface hover:bg-primary-soft/60 text-tiny flex items-center justify-center gap-1.5 rounded-xl border py-2 font-bold transition-colors"
              >
                <Icon name="hand" size={15} />
                <span>戳戳 (3/3)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  petRef.current?.feed()
                  setActionToast(
                    `给 ${activeFriend.nickname} 的${characterName(friendMascot)}投喂了草莓大福！`,
                  )
                }}
                className="border-border bg-surface hover:bg-primary-soft/60 text-tiny flex items-center justify-center gap-1.5 rounded-xl border py-2 font-bold transition-colors"
              >
                <TreatGlyph id="strawberry" size={16} />
                <span>投喂 (1/1)</span>
              </button>
              <button
                type="button"
                disabled={activeFriend.todayDone >= activeFriend.todayPlanned}
                onClick={() => {
                  petRef.current?.play('wave')
                  setActionToast(
                    `已派${characterName(friendMascot)}温柔提醒 ${activeFriend.nickname} 打卡～`,
                  )
                }}
                className="border-border bg-surface hover:bg-primary-soft/60 disabled:bg-surface-sunken disabled:text-muted text-tiny flex items-center justify-center gap-1.5 rounded-xl border py-2 font-bold transition-colors disabled:cursor-not-allowed"
              >
                <Icon name="megaphone" size={15} />
                <span>
                  {activeFriend.todayDone >= activeFriend.todayPlanned ? '今日已达标' : '提醒打卡'}
                </span>
              </button>
            </div>

            {actionToast && (
              <p className="bg-primary-soft text-primary-ink text-tiny mt-2 rounded-xl px-3 py-1.5 text-center font-semibold">
                {actionToast}
              </p>
            )}
          </Card>
        ) : undefined
      }
    />
  )
}
