'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { InteractivePet, type PetHandle } from '@/components/mascot/interactive-pet'
import {
  characterName,
  mascotRegistryCharacters,
  type MascotMood,
  type MascotRegistryCharacter,
} from '@/components/mascot/mascot-svg'
import { getTreatDef, TreatGlyph, treats, type TreatId } from '@/components/mascot/treat-glyph'
import { Avatar } from '@/components/ui/avatar'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Icon } from '@/components/ui/icon'
import { Menu } from '@/components/ui/menu'
import { ProgressBar } from '@/components/ui/progress'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Stamp } from '@/components/ui/stamp'
import { toast } from '@/components/ui/toast'
import { moduleMeta, type ModuleTone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'

interface FriendGoalItem {
  module: ModuleTone
  title: string
  progressText: string
  pct: number
  done: boolean
}

interface FriendRoomProfile {
  id: string
  name: string
  /** 独立于陪伴宠物的预设头像（Decision #3：换宠物不覆盖头像） */
  avatar: string
  mascot: MascotRegistryCharacter
  streakDays: number
  todayDone: number
  todayPlanned: number
  timeZoneLabel: string
  dayStartHour: number
  statusNote: string
  moodLabel: string
  weightText: string
  goals: readonly FriendGoalItem[]
}

const DEMO_FRIENDS: readonly FriendRoomProfile[] = [
  {
    id: 'ayou',
    name: '阿柚',
    avatar: 'mascot:tuan:cheer:diet',
    mascot: 'tuan',
    streakDays: 14,
    todayDone: 3,
    todayPlanned: 3,
    timeZoneLabel: 'Asia/Shanghai',
    dayStartHour: 4,
    statusNote: '100% 全勤达标 · 欢呼 + 盖章',
    moodLabel: '超棒 (5/5)',
    weightText: '52.4 kg (7日 -0.6kg)',
    goals: [
      { module: 'exercise', title: '晨间慢跑', progressText: '32 / 30 分钟', pct: 100, done: true },
      { module: 'diet', title: '三餐规律记录', progressText: '3 / 3 餐', pct: 100, done: true },
      { module: 'study', title: '背核心单词', progressText: '50 / 50 词', pct: 100, done: true },
    ],
  },
  {
    id: 'doudou',
    name: '豆豆',
    avatar: 'mascot:dun:happy:study',
    mascot: 'dun',
    streakDays: 6,
    todayDone: 2,
    todayPlanned: 3,
    timeZoneLabel: 'Asia/Shanghai',
    dayStartHour: 4,
    statusNote: '66% 进行中 · 元气陪伴',
    moodLabel: '不错 (4/5)',
    weightText: '64.1 kg (7日 -0.3kg)',
    goals: [
      {
        module: 'exercise',
        title: '晚间核心训练',
        progressText: '20 / 20 分钟',
        pct: 100,
        done: true,
      },
      {
        module: 'sleep',
        title: '23:30 前入睡',
        progressText: '7.5 / 8 小时',
        pct: 100,
        done: true,
      },
      { module: 'study', title: '专业文献精读', progressText: '1 / 2 篇', pct: 50, done: false },
    ],
  },
  {
    id: 'qiqi',
    name: '七七',
    avatar: 'mascot:mian:sleepy:sleep',
    mascot: 'mian',
    streakDays: 3,
    todayDone: 0,
    todayPlanned: 3,
    timeZoneLabel: 'Asia/Tokyo',
    dayStartHour: 4,
    statusNote: '0% 待开始 · 犯困打瞌睡（可温柔提醒）',
    moodLabel: '待记录',
    weightText: '48.8 kg',
    goals: [
      { module: 'diet', title: '少糖轻食打卡', progressText: '0 / 3 餐', pct: 0, done: false },
      { module: 'sleep', title: '睡前冥想放松', progressText: '0 / 15 分钟', pct: 0, done: false },
      { module: 'custom', title: '手账日结', progressText: '0 / 1 次', pct: 0, done: false },
    ],
  },
  {
    id: 'nanfeng',
    name: '南风',
    avatar: 'mascot:you:happy:exercise',
    mascot: 'you',
    streakDays: 9,
    todayDone: 0,
    todayPlanned: 0,
    timeZoneLabel: 'Asia/Shanghai',
    dayStartHour: 0,
    statusNote: '0/0 今日休息日 · 悠闲放松（禁提醒）',
    moodLabel: '超棒 (5/5)',
    weightText: '58.0 kg',
    goals: [],
  },
]

type InteractionKind = 'poke' | 'feed' | 'remind'

interface ActionState {
  used: number
  limit: number
  cooldownLeftSec: number
}

type FriendActionMap = Record<string, Record<InteractionKind, ActionState>>

function createInitialActionMap(): FriendActionMap {
  const map: FriendActionMap = {}
  for (const f of DEMO_FRIENDS) {
    map[f.id] = {
      poke: { used: 0, limit: 3, cooldownLeftSec: 0 },
      feed: { used: 0, limit: 1, cooldownLeftSec: 0 },
      remind: { used: 0, limit: 1, cooldownLeftSec: 0 },
    }
  }
  return map
}

function deriveRoomPetState(
  friend: FriendRoomProfile,
  petName: string,
): {
  mood: MascotMood
  speech: string
  badgeTone: 'exercise' | 'primary' | 'sleep' | 'neutral'
  badgeText: string
} {
  if (friend.todayPlanned === 0) {
    return {
      mood: 'happy',
      speech: `今天${friend.name}休息，${petName}陪你晒太阳～`,
      badgeTone: 'neutral',
      badgeText: '今日休息',
    }
  }
  if (friend.todayDone === 0) {
    return {
      mood: 'sleepy',
      speech: `${friend.name}今天还没动静，戳戳我叫醒ta？`,
      badgeTone: 'sleep',
      badgeText: `今日 0/${friend.todayPlanned} 待开始`,
    }
  }
  if (friend.todayDone >= friend.todayPlanned) {
    return {
      mood: 'cheer',
      speech: `太棒啦！${friend.name}今天目标全部达成！`,
      badgeTone: 'exercise',
      badgeText: `今日 ${friend.todayDone}/${friend.todayPlanned} 已全勤`,
    }
  }
  return {
    mood: 'happy',
    speech: `已完成 ${friend.todayDone}/${friend.todayPlanned}，正在稳稳推进～`,
    badgeTone: 'primary',
    badgeText: `今日 ${friend.todayDone}/${friend.todayPlanned} 进行中`,
  }
}

function formatCooldown(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * 好友小窝宠物舞台与轻互动原型（对应 Issue #21 + #22）
 * 包含：
 * 1. 上方宠物舞台 + 下滑查看对方今日打卡仪表盘和状态追踪
 * 2. 点击「投喂零食」向左右直线横向展开为「6 种零食架子」，支持手指/鼠标拖拽不同食物给宠物，触发不同动作与特效
 * 3. 戳戳 / 投喂 / 提醒打卡 30 分钟冷却与按好友时区重置
 * 4. 头像（avatar）与陪伴宠物（mascot）独立验证
 */
export function FriendRoomStageDemo() {
  const petRef = useRef<PetHandle>(null)
  const [selectedId, setSelectedId] = useState<string>('qiqi')
  const [overrideMascot, setOverrideMascot] = useState<MascotRegistryCharacter | null>(null)
  const [actionsByFriend, setActionsByFriend] = useState<FriendActionMap>(createInitialActionMap)
  const [shelfOpen, setShelfOpen] = useState(false)
  const [hoveredTreat, setHoveredTreat] = useState<TreatId | null>(null)
  const [dragTreat, setDragTreat] = useState<{
    id: TreatId
    x: number
    y: number
    over: boolean
  } | null>(null)
  const [feedback, setFeedback] = useState<string | null>(
    '点「投喂零食」可展开 6 格零食架，把不同食物拖到宠物身上会有不同动作反应～',
  )
  const [unfriendDialogOpen, setUnfriendDialogOpen] = useState(false)
  const [unfriendedIds, setUnfriendedIds] = useState<string[]>([])

  const friend = DEMO_FRIENDS.find((f) => f.id === selectedId) ?? DEMO_FRIENDS[0]
  const activeMascot = overrideMascot ?? friend.mascot
  const petName = characterName(activeMascot)
  const roomState = deriveRoomPetState(friend, petName)
  const friendActions = actionsByFriend[friend.id]
  const isUnfriended = unfriendedIds.includes(friend.id)

  // 根据好友打卡完成度同步初始睡眠/欢呼姿态
  useEffect(() => {
    if (!petRef.current) return
    if (friend.todayPlanned > 0 && friend.todayDone === 0) {
      petRef.current.play('sleep')
    } else if (friend.todayPlanned > 0 && friend.todayDone >= friend.todayPlanned) {
      petRef.current.play('cheer')
    } else {
      petRef.current.play('wave')
    }
  }, [friend.id, friend.todayDone, friend.todayPlanned, activeMascot])

  // 演示冷却倒计时每秒递减
  useEffect(() => {
    const timer = window.setInterval(() => {
      setActionsByFriend((prev) => {
        let changed = false
        const next: FriendActionMap = { ...prev }
        for (const fId of Object.keys(next)) {
          const group = next[fId]
          if (!group) continue
          const updatedGroup = { ...group }
          for (const k of ['poke', 'feed', 'remind'] as const) {
            if (updatedGroup[k].cooldownLeftSec > 0) {
              changed = true
              updatedGroup[k] = {
                ...updatedGroup[k],
                cooldownLeftSec: Math.max(0, updatedGroup[k].cooldownLeftSec - 1),
              }
            }
          }
          next[fId] = updatedGroup
        }
        return changed ? next : prev
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  function triggerInteraction(kind: Exclude<InteractionKind, 'feed'>) {
    const current = friendActions[kind]
    if (!current || current.used >= current.limit || current.cooldownLeftSec > 0) return

    if (kind === 'poke') {
      petRef.current?.play(friend.todayDone === 0 && friend.todayPlanned > 0 ? 'surprise' : 'shy')
      setFeedback(`已戳了戳 ${friend.name} 的${petName}～对方将收到一条互动通知`)
    } else {
      if (friend.todayPlanned === 0 || friend.todayDone >= friend.todayPlanned) return
      petRef.current?.play('wave')
      const remaining = friend.todayPlanned - friend.todayDone
      setFeedback(
        `已派${petName}温柔提醒 ${friend.name}：「今天的小目标还差 ${remaining} 个就圆满啦，一起加油～」`,
      )
    }

    setActionsByFriend((prev) => ({
      ...prev,
      [friend.id]: {
        ...prev[friend.id],
        [kind]: {
          ...prev[friend.id][kind],
          used: prev[friend.id][kind].used + 1,
          cooldownLeftSec: 30 * 60,
        },
      },
    }))
  }

  function completeFeedTreat(treatId: TreatId) {
    const treat = getTreatDef(treatId)
    petRef.current?.feed(treatId)
    setFeedback(
      `给 ${friend.name} 的${petName}投喂了「${treat.label}」→ 触发【${treat.flavor}】专属反应！`,
    )
    setActionsByFriend((prev) => ({
      ...prev,
      [friend.id]: {
        ...prev[friend.id],
        feed: {
          ...prev[friend.id].feed,
          used: prev[friend.id].feed.used + 1,
          cooldownLeftSec: 30 * 60,
        },
      },
    }))
    // 投喂完成后延迟收起零食架，让用户看清投喂反馈
    window.setTimeout(() => setShelfOpen(false), 650)
  }

  function notifyTreatHover(id: TreatId) {
    const treat = getTreatDef(id)
    setHoveredTreat(id)
    toast.info(`你拿了${treat.label}`, {
      id: 'treat-shelf-hover',
      description: `${treat.flavor} · 按住拖给${petName}或点击投喂`,
      timeout: 1800,
    })
  }

  function startTreatDrag(id: TreatId, e: ReactPointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    notifyTreatHover(id)
    setDragTreat({ id, x: e.clientX, y: e.clientY, over: false })
  }

  function resetDemoCooldowns() {
    setActionsByFriend(createInitialActionMap())
    setUnfriendedIds([])
    setOverrideMascot(null)
    setShelfOpen(false)
    setFeedback('已重置所有好友的今日互动次数、30 分钟冷却与零食架状态')
  }

  const remindDisabledReason =
    friend.todayPlanned === 0
      ? '今日休息'
      : friend.todayDone >= friend.todayPlanned
        ? '今日已达标'
        : null

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      {/* 左侧：好友房间完整纵览（上方宠物互动舞台 + 下滑好友打卡仪表盘与状态追踪） */}
      <div className="space-y-3">
        <Card
          variant="sticker"
          data-ann="playbook.pet.friend-room.stage"
          className="relative flex flex-col justify-between overflow-hidden bg-[radial-gradient(ellipse_at_50%_28%,var(--surface)_0%,var(--background)_62%,var(--surface-sunken)_100%)] p-5"
        >
          {/* 顶部栏：好友头像 + 昵称 + 连续打卡 + 右上角更多菜单 */}
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar name={friend.name} avatar={friend.avatar} size="md" ring />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-heading font-bold">{friend.name} 的小窝</h3>
                  <Badge tone="diet" icon="flame">
                    连续 {friend.streakDays} 天
                  </Badge>
                  <Badge tone={roomState.badgeTone} dot>
                    {roomState.badgeText}
                  </Badge>
                </div>
                <p className="text-tiny text-muted mt-0.5">
                  陪伴伙伴：{petName} · 好友时区 {friend.timeZoneLabel}（每日{' '}
                  {String(friend.dayStartHour).padStart(2, '0')}:00 刷新互动次数）
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Menu
                trigger={<IconButton icon="menu" label="好友房间更多操作" size="sm" />}
                items={[
                  {
                    label: '查看造访记录',
                    icon: 'footprints',
                    onSelect: () =>
                      setFeedback(
                        `今日首次进入 ${friend.name} 的房间已静默登记，24h 内反复切换不刷屏`,
                      ),
                  },
                  null,
                  {
                    label: '解除好友',
                    icon: 'user-x',
                    danger: true,
                    disabled: isUnfriended,
                    onSelect: () => setUnfriendDialogOpen(true),
                  },
                ]}
              />
            </div>
          </div>

          {/* 舞台中央：好友的陪伴宠物 + 状态气泡 + 全勤盖章 */}
          <div className="relative my-3 flex min-h-[240px] flex-col items-center justify-end pt-8 pb-2">
            <span className="bg-surface/75 pointer-events-none absolute inset-x-6 bottom-1 h-16 rounded-full blur-md" />

            {/* 常驻状态小气泡 */}
            <div className="border-border bg-surface shadow-soft mb-2 max-w-xs rounded-2xl border px-3.5 py-1.5 text-center">
              <p className="text-caption font-semibold">
                {dragTreat?.over
                  ? `哇！快松手把${getTreatDef(dragTreat.id).label}喂给我～`
                  : hoveredTreat
                    ? `你拿了${getTreatDef(hoveredTreat).label}（${getTreatDef(hoveredTreat).flavor}）`
                    : roomState.speech}
              </p>
            </div>

            <div
              className={cn(
                'relative rounded-full transition-transform duration-(--dur-fast)',
                dragTreat?.over && 'ring-primary/40 scale-105 ring-4',
              )}
            >
              <InteractivePet
                ref={petRef}
                size={172}
                character={activeMascot}
                idleSleepMs={0}
                speech
              />
              {friend.todayPlanned > 0 && friend.todayDone >= friend.todayPlanned && (
                <Stamp
                  caption="全勤"
                  size={68}
                  animate
                  className="pointer-events-none absolute -top-2 -right-12"
                />
              )}
            </div>
          </div>

          {/* 底部互动区：点击「投喂零食」向左右直线横向展开为 6 格零食架子 */}
          {isUnfriended ? (
            <div className="border-border bg-surface-sunken text-caption text-muted flex items-center justify-between gap-3 rounded-2xl border px-4 py-3">
              <span>已与 {friend.name} 解除好友关系，已自动切回「我的空间」</span>
              <Button size="sm" variant="secondary" onClick={resetDemoCooldowns}>
                恢复演示状态
              </Button>
            </div>
          ) : shelfOpen ? (
            <div
              data-ann="playbook.pet.friend-room.actions"
              className="border-primary/30 bg-surface shadow-card animate-pop-in origin-center rounded-2xl border p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Badge tone="diet" icon="treat">
                    小窝零食架
                  </Badge>
                  <span className="text-tiny text-muted font-semibold">
                    按住食物拖给上方的{petName}（或直接点选），不同食物反应不同
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShelfOpen(false)}
                  className="text-tiny text-muted hover:text-foreground shrink-0 px-1.5 py-0.5 font-semibold"
                >
                  收起 ×
                </button>
              </div>

              <div className="grid grid-cols-6 gap-2">
                {treats.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-label={`你拿了${t.label}（${t.flavor}）`}
                    onPointerEnter={() => notifyTreatHover(t.id)}
                    onPointerLeave={() => setHoveredTreat((prev) => (prev === t.id ? null : prev))}
                    onFocus={() => notifyTreatHover(t.id)}
                    onBlur={() => setHoveredTreat((prev) => (prev === t.id ? null : prev))}
                    onPointerDown={(e) => startTreatDrag(t.id, e)}
                    onPointerMove={(e) => {
                      if (!dragTreat) return
                      setDragTreat({
                        ...dragTreat,
                        x: e.clientX,
                        y: e.clientY,
                        over: !!petRef.current?.hitTest(e.clientX, e.clientY),
                      })
                    }}
                    onPointerUp={(e) => {
                      if (dragTreat) {
                        const hit = petRef.current?.hitTest(e.clientX, e.clientY)
                        const dx = Math.hypot(e.clientX - dragTreat.x, e.clientY - dragTreat.y)
                        // 拖到宠物身上松手，或轻点一下零食，均触发投喂
                        if (hit || dx < 8) {
                          completeFeedTreat(t.id)
                        }
                      }
                      setDragTreat(null)
                    }}
                    onClick={(e) => {
                      if (e.detail === 0) completeFeedTreat(t.id)
                    }}
                    className={cn(
                      'border-border bg-paper hover:border-primary/40 hover:bg-primary-soft/50 ease-spring flex h-13 touch-none items-center justify-center rounded-xl border transition-transform duration-(--dur-fast) hover:-translate-y-0.5 active:scale-95',
                      dragTreat?.id === t.id && 'opacity-35',
                    )}
                  >
                    <TreatGlyph id={t.id} size={34} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div
              data-ann="playbook.pet.friend-room.actions"
              className="grid grid-cols-3 gap-2.5 pt-1"
            >
              {/* 1. 戳戳 Poke */}
              <InteractionButton
                label="戳戳"
                icon={<Icon name="hand" size={18} />}
                state={friendActions.poke}
                onClick={() => triggerInteraction('poke')}
              />

              {/* 2. 投喂 Feed（点击向左右展开零食架） */}
              <InteractionButton
                label="投喂零食"
                icon={<TreatGlyph id="strawberry" size={20} />}
                state={friendActions.feed}
                hintWhenReady="点击展开零食架"
                onClick={() => setShelfOpen(true)}
              />

              {/* 3. 提醒打卡 Remind */}
              <InteractionButton
                label="提醒打卡"
                icon={<Icon name="megaphone" size={18} />}
                state={friendActions.remind}
                disabledReason={remindDisabledReason}
                onClick={() => triggerInteraction('remind')}
              />
            </div>
          )}

          {/* 拖拽中的零食浮层 */}
          {dragTreat && (
            <span
              aria-hidden
              className={cn(
                'pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 transition-transform duration-(--dur-fast)',
                dragTreat.over && 'scale-125',
              )}
              style={{ left: dragTreat.x, top: dragTreat.y }}
            >
              <TreatGlyph id={dragTreat.id} size={46} />
            </span>
          )}

          {/* 互动即时反馈横幅 */}
          {feedback && (
            <div className="bg-primary-soft text-primary-ink text-tiny mt-3 flex items-center gap-2 rounded-xl px-3 py-2 font-semibold">
              <Icon name="sparkles" size={15} className="shrink-0" />
              <span className="min-w-0 flex-1">{feedback}</span>
            </div>
          )}

          <ConfirmDialog
            open={unfriendDialogOpen}
            onOpenChange={setUnfriendDialogOpen}
            title={`确定与 ${friend.name} 解除好友吗？`}
            description="解除后将从彼此的顶栏好友栏移除，历史私聊会话将保留为只读状态，无法继续发送新消息。"
            confirmLabel="确认解除"
            cancelLabel="留在小窝"
            tone="danger"
            buttonLayout="split"
            centered
            onConfirm={() => {
              setUnfriendedIds((prev) => [...prev, friend.id])
              setShelfOpen(false)
              setFeedback(`已与 ${friend.name} 解除好友，历史私聊已冻结为只读状态`)
            }}
          />
        </Card>

        {/* 下方紧接：下滑查看该好友的今日打卡仪表盘与状态追踪 */}
        <Card
          variant="outline"
          data-ann="playbook.pet.friend-room.dashboard"
          className="bg-surface space-y-3 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge tone="primary" icon="chart">
                下滑区域 · 好友今日打卡与状态追踪
              </Badge>
              <span className="text-tiny text-muted">只读透明展示</span>
            </div>
            <div className="text-tiny text-muted flex items-center gap-3 font-semibold">
              <span>今日心情：{friend.moodLabel}</span>
              <span>体重趋势：{friend.weightText}</span>
            </div>
          </div>

          {friend.goals.length === 0 ? (
            <div className="bg-surface-sunken text-caption text-muted rounded-xl p-3.5 text-center">
              {friend.name} 今天是计划休息日，没有排期打卡目标～
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-3">
              {friend.goals.map((g) => (
                <li
                  key={g.title}
                  className="border-border bg-paper flex flex-col justify-between gap-2 rounded-xl border p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <IconTile icon={moduleMeta[g.module].icon} tone={g.module} size="sm" />
                      <span className="text-caption font-bold">{g.title}</span>
                    </div>
                    {g.done && (
                      <Icon name="check" size={16} className="text-success-ink shrink-0" />
                    )}
                  </div>
                  <div>
                    <ProgressBar value={g.pct} tone={g.module} size="sm" label={`${g.title}进度`} />
                    <span className="text-tiny text-muted mt-1 block text-right font-mono">
                      {g.progressText}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* 右侧：边界条件控制台（供开发者与后续 Agent 对照验收） */}
      <div className="flex flex-col gap-3">
        <div
          data-ann="playbook.pet.friend-room.switcher"
          className="border-border bg-surface rounded-2xl border p-3.5"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-tiny text-muted font-semibold">切换好友房间（4 种状态 × 4 角色）</p>
            <button
              type="button"
              onClick={resetDemoCooldowns}
              className="text-tiny text-primary-ink font-semibold hover:underline"
            >
              重置次数与冷却
            </button>
          </div>
          <div className="grid gap-1.5">
            {DEMO_FRIENDS.map((f) => {
              const active = f.id === friend.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(f.id)
                    setOverrideMascot(null)
                    setShelfOpen(false)
                    setFeedback(
                      `进入 ${f.name} 的小窝 · 上方宠物舞台 + 下方打卡状态追踪（${f.statusNote}）`,
                    )
                  }}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors',
                    active
                      ? 'bg-primary-soft text-primary-ink font-semibold'
                      : 'hover:bg-surface-sunken text-foreground',
                  )}
                >
                  <Avatar name={f.name} avatar={f.avatar} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-caption truncate font-bold">
                        {f.name} · {characterName(f.mascot)}
                      </span>
                      <span className="text-tiny font-mono">
                        {f.todayPlanned === 0 ? '休息' : `${f.todayDone}/${f.todayPlanned}`}
                      </span>
                    </div>
                    <p className="text-tiny text-muted truncate">{f.statusNote}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 边界条件验证：头像与陪伴宠物独立（Decision #3） */}
        <div
          data-ann="playbook.pet.friend-room.avatar-independence"
          className="border-border bg-surface rounded-2xl border p-3.5"
        >
          <p className="text-tiny text-muted mb-1.5 font-semibold">
            边界验证：换陪伴宠物不改头像（Decision #3）
          </p>
          <p className="text-tiny text-muted mb-2.5">
            试试切换下方宠物：舞台上的伙伴会立刻换新形象，但左上角 {friend.name}{' '}
            的预设头像保持创建时的模样不变。
          </p>
          <SegmentedControl
            options={mascotRegistryCharacters.map((c) => ({ value: c.id, label: c.name }))}
            value={activeMascot}
            onValueChange={(val) => setOverrideMascot(val)}
            label="切换房间陪伴宠物"
            size="sm"
          />
        </div>

        {/* 边界条件验证：隐藏右下角 Agent 悬浮宠物（Decision #1） */}
        <div
          data-ann="playbook.pet.friend-room.floating-pet-rule"
          className="border-border bg-surface rounded-2xl border p-3.5"
        >
          <div className="flex items-center gap-2">
            <Badge tone="study" icon="sparkles">
              界面守则
            </Badge>
            <p className="text-caption font-bold">一屏不放两只互动宠物</p>
          </div>
          <p className="text-tiny text-muted mt-1.5 leading-relaxed">
            右下角小弹窗是个人 AI 助手入口（<code className="font-mono">FloatingPet</code>
            ）。当切入好友房间（<code className="font-mono">viewingFriendId !== null</code>
            ）时，自动隐藏右下角悬浮宠物，只展示上方好友小窝大舞台；切回「我」时恢复。
          </p>
        </div>
      </div>
    </div>
  )
}

function InteractionButton({
  label,
  icon,
  state,
  disabledReason,
  hintWhenReady,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  state: ActionState
  disabledReason?: string | null
  hintWhenReady?: string
  onClick: () => void
}) {
  const remaining = Math.max(0, state.limit - state.used)
  const exhausted = remaining === 0
  const cooling = state.cooldownLeftSec > 0 && !exhausted
  const disabled = Boolean(disabledReason) || exhausted || cooling

  let subText = hintWhenReady
    ? `${hintWhenReady} (${remaining}/${state.limit})`
    : `今日余 ${remaining}/${state.limit}`
  if (disabledReason) {
    subText = disabledReason
  } else if (exhausted) {
    subText = '今日已用完'
  } else if (cooling) {
    subText = `冷却 ${formatCooldown(state.cooldownLeftSec)}`
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'border-border bg-surface ease-spring flex flex-col items-center justify-center gap-1 rounded-2xl border px-2.5 py-2.5 text-center transition-[transform,background-color,opacity] duration-(--dur-fast)',
        disabled
          ? 'bg-surface-sunken text-muted cursor-not-allowed opacity-65'
          : 'hover:bg-primary-soft/60 hover:border-primary/40 shadow-soft cursor-pointer hover:-translate-y-0.5 active:scale-95',
      )}
    >
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-caption font-bold">{label}</span>
      </div>
      <span className="text-tiny text-muted font-mono">{subText}</span>
    </button>
  )
}
