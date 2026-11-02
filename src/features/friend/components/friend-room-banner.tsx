'use client'

import { useEffect, useRef, useState } from 'react'
import { InteractivePet, type PetHandle } from '@/components/mascot/interactive-pet'
import {
  characterName,
  type MascotMood,
  type MascotRegistryCharacter,
} from '@/components/mascot/mascot-svg'
import { getTreatDef, TreatGlyph, treats, type TreatId } from '@/components/mascot/treat-glyph'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { Stamp } from '@/components/ui/stamp'
import { toast } from '@/components/ui/toast'
import type { PetActionState, PetInteractionKind } from '@/features/friend/schemas'
import { cn } from '@/lib/cn'
import { errorMessage, isApiError, useHasQueryClient } from '@/lib/api'
import { useInteractWithPet, usePetInteractions } from '@/lib/api/queries/friends'
import type { FriendSummary } from '../schemas'

export interface FriendRoomBannerProps {
  friend: FriendSummary
  onBack: () => void
}

function formatCooldown(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function getInitialSpeech(
  friend: FriendSummary,
  mascotName: string,
): {
  mood: MascotMood
  speech: string
  badgeTone: 'exercise' | 'primary' | 'sleep' | 'neutral'
  badgeText: string
} {
  if (friend.todayPlanned === 0) {
    return {
      mood: 'happy',
      speech: `今天 ${friend.nickname} 休息，${mascotName}陪你晒太阳～`,
      badgeTone: 'neutral',
      badgeText: '今日休息',
    }
  }
  if (friend.todayDone >= friend.todayPlanned) {
    return {
      mood: 'cheer',
      speech: `太棒啦！${friend.nickname}今天目标全部达成！`,
      badgeTone: 'exercise',
      badgeText: `今日 ${friend.todayDone}/${friend.todayPlanned} 已全勤`,
    }
  }
  if (friend.todayDone === 0) {
    return {
      mood: 'sleepy',
      speech: `${friend.nickname}今天还没动静，待会儿再来看看吧～`,
      badgeTone: 'sleep',
      badgeText: `今日 0/${friend.todayPlanned} 待开始`,
    }
  }
  return {
    mood: 'happy',
    speech: `已完成 ${friend.todayDone}/${friend.todayPlanned}，正在稳稳推进～`,
    badgeTone: 'primary',
    badgeText: `今日 ${friend.todayDone}/${friend.todayPlanned} 进行中`,
  }
}

/**
 * 客户端带 API 交互的动态小窝舞台
 */
function FriendRoomStageConnected({ friend, onBack }: FriendRoomBannerProps) {
  const petRef = useRef<PetHandle>(null)
  const mascot: MascotRegistryCharacter = friend.mascot ?? 'tuan'
  const mascotName = characterName(mascot)
  const initial = getInitialSpeech(friend, mascotName)

  const { data: statusData, dataUpdatedAt } = usePetInteractions(friend.userId)
  const interactMutation = useInteractWithPet()

  const [shelfOpen, setShelfOpen] = useState(false)
  const [hoveredTreat, setHoveredTreat] = useState<TreatId | null>(null)
  const [dragTreat, setDragTreat] = useState<{
    id: TreatId
    x: number
    y: number
    over: boolean
  } | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [overrideCooldownEnds, setOverrideCooldownEnds] = useState<
    Partial<Record<PetInteractionKind, number>>
  >({})

  // 每秒刷新墙上时间戳用于倒计时显示
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  // 初始宠物姿态同步
  useEffect(() => {
    if (!petRef.current) return
    if (friend.todayPlanned > 0 && friend.todayDone === 0) {
      petRef.current.play('sleep')
    } else if (friend.todayPlanned > 0 && friend.todayDone >= friend.todayPlanned) {
      petRef.current.play('cheer')
    } else {
      petRef.current.play('wave')
    }
  }, [friend.todayDone, friend.todayPlanned, mascot])

  function getCooldownLeft(k: PetInteractionKind): number {
    const overrideEnd = overrideCooldownEnds[k]
    const overrideLeft = overrideEnd ? Math.max(0, Math.ceil((overrideEnd - nowMs) / 1000)) : 0
    const serverLeft = statusData?.actions?.[k]?.cooldownLeftSec ?? 0
    const serverAgeSec = dataUpdatedAt ? Math.floor((nowMs - dataUpdatedAt) / 1000) : 0
    const currentServerLeft = Math.max(0, serverLeft - serverAgeSec)
    return Math.max(overrideLeft, currentServerLeft)
  }

  const actionStates: Record<PetInteractionKind, PetActionState> = {
    poke: {
      used: statusData?.actions?.poke?.used ?? 0,
      limit: statusData?.actions?.poke?.limit ?? 3,
      cooldownLeftSec: getCooldownLeft('poke'),
      disabledReason: statusData?.actions?.poke?.disabledReason,
    },
    feed: {
      used: statusData?.actions?.feed?.used ?? 0,
      limit: statusData?.actions?.feed?.limit ?? 1,
      cooldownLeftSec: getCooldownLeft('feed'),
      disabledReason: statusData?.actions?.feed?.disabledReason,
    },
    remind: {
      used: statusData?.actions?.remind?.used ?? 0,
      limit: statusData?.actions?.remind?.limit ?? 1,
      cooldownLeftSec: getCooldownLeft('remind'),
      disabledReason:
        statusData?.remindDisabledReason ??
        (friend.todayPlanned === 0
          ? '今日休息'
          : friend.todayDone >= friend.todayPlanned
            ? '今日已达标'
            : statusData?.actions?.remind?.disabledReason),
    },
  }

  function handlePoke() {
    if (interactMutation.isPending) return
    interactMutation.mutate(
      { friendUserId: friend.userId, input: { kind: 'poke' } },
      {
        onSuccess: (data) => {
          petRef.current?.play(
            friend.todayDone === 0 && friend.todayPlanned > 0 ? 'surprise' : 'shy',
          )
          setFeedback(data.feedback)
          setOverrideCooldownEnds((prev) => ({ ...prev, poke: Date.now() + 1800 * 1000 }))
          toast.success('戳戳成功', { description: data.feedback })
        },
        onError: (err) => {
          toast.error(isApiError(err) ? errorMessage(err) : '戳戳失败，请稍后再试')
        },
      },
    )
  }

  function handleFeed(treatId: TreatId) {
    if (interactMutation.isPending) return
    interactMutation.mutate(
      { friendUserId: friend.userId, input: { kind: 'feed', treatId } },
      {
        onSuccess: (data) => {
          petRef.current?.feed(treatId)
          setFeedback(data.feedback)
          setOverrideCooldownEnds((prev) => ({ ...prev, feed: Date.now() + 1800 * 1000 }))
          toast.success('投喂成功', { description: data.feedback })
          window.setTimeout(() => setShelfOpen(false), 650)
        },
        onError: (err) => {
          toast.error(isApiError(err) ? errorMessage(err) : '投喂失败，请稍后再试')
        },
      },
    )
  }

  function handleRemind() {
    if (interactMutation.isPending) return
    interactMutation.mutate(
      { friendUserId: friend.userId, input: { kind: 'remind' } },
      {
        onSuccess: (data) => {
          petRef.current?.play('wave')
          setFeedback(data.feedback)
          setOverrideCooldownEnds((prev) => ({ ...prev, remind: Date.now() + 1800 * 1000 }))
          toast.success('提醒成功', { description: data.feedback })
        },
        onError: (err) => {
          toast.error(isApiError(err) ? errorMessage(err) : '提醒打卡失败，请稍后再试')
        },
      },
    )
  }

  const speechText = dragTreat?.over
    ? `哇！快松手把${getTreatDef(dragTreat.id).label}喂给我～`
    : hoveredTreat
      ? `你拿了${getTreatDef(hoveredTreat).label}（${getTreatDef(hoveredTreat).flavor}）`
      : (feedback ?? initial.speech)

  return (
    <Card
      variant="sticker"
      data-ann="friend-room.stage"
      className="relative flex flex-col justify-between overflow-hidden bg-[radial-gradient(ellipse_at_50%_25%,var(--surface)_0%,var(--background)_65%,var(--surface-sunken)_100%)] p-4 sm:p-5"
    >
      {/* 顶部栏：好友头像 + 昵称 + 连续打卡 + 返回主页 */}
      <div className="relative z-10 flex items-start justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar
            name={friend.nickname}
            avatar={friend.avatar}
            size="md"
            ring={friend.streak > 0}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h3 className="text-caption sm:text-heading truncate font-bold">
                正在串门 {friend.nickname} 的小窝
              </h3>
              <Badge tone="diet" icon="flame">
                连续 {friend.streak} 天
              </Badge>
              <Badge tone={initial.badgeTone} dot>
                {initial.badgeText}
              </Badge>
            </div>
            <p className="text-tiny text-muted mt-0.5 truncate">
              陪伴伙伴：{mascotName} · 串门只读小窝模式
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onBack} className="shrink-0">
          返回我的主页
        </Button>
      </div>

      {/* 中央宠物互动舞台 */}
      <div className="relative my-3 flex min-h-[220px] flex-col items-center justify-end pt-6 pb-2">
        <span className="bg-surface/75 pointer-events-none absolute inset-x-6 bottom-1 h-16 rounded-full blur-md" />

        {/* 说话气泡 */}
        <div className="border-border bg-surface shadow-soft mb-2 max-w-xs rounded-2xl border px-3.5 py-1.5 text-center">
          <p className="text-tiny sm:text-caption font-semibold">{speechText}</p>
        </div>

        {/* 宠物本体与全勤印章 */}
        <div
          className={cn(
            'relative rounded-full transition-transform duration-(--dur-fast)',
            dragTreat?.over && 'ring-primary/40 scale-105 ring-4',
          )}
        >
          <InteractivePet ref={petRef} size={156} character={mascot} idleSleepMs={0} speech />
          {friend.todayPlanned > 0 && friend.todayDone >= friend.todayPlanned && (
            <Stamp
              caption="全勤"
              size={64}
              animate
              className="pointer-events-none absolute -top-2 -right-10"
            />
          )}
        </div>
      </div>

      {/* 底部轻互动区：6-格零食架或 3 大互动按钮 */}
      {shelfOpen ? (
        <div
          data-ann="friend-room.treat-shelf"
          className="border-primary/30 bg-surface shadow-card animate-pop-in origin-center rounded-2xl border p-3"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Badge tone="diet" icon="treat">
                小窝零食架
              </Badge>
              <span className="text-tiny text-muted font-semibold">
                按住食物拖给上方的{mascotName}（或直接点选投喂）
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
                onPointerEnter={() => setHoveredTreat(t.id)}
                onPointerLeave={() => setHoveredTreat((prev) => (prev === t.id ? null : prev))}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId)
                  setHoveredTreat(t.id)
                  setDragTreat({ id: t.id, x: e.clientX, y: e.clientY, over: false })
                }}
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
                    if (hit || dx < 8) {
                      handleFeed(t.id)
                    }
                  }
                  setDragTreat(null)
                }}
                onClick={(e) => {
                  if (e.detail === 0) handleFeed(t.id)
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
        <div data-ann="friend-room.actions" className="grid grid-cols-3 gap-2.5 pt-1">
          {/* 1. 戳戳 Poke */}
          <InteractionButton
            label="戳戳"
            icon={<Icon name="hand" size={18} />}
            state={actionStates.poke}
            onClick={handlePoke}
          />

          {/* 2. 投喂 Feed */}
          <InteractionButton
            label="投喂零食"
            icon={<TreatGlyph id="strawberry" size={20} />}
            state={actionStates.feed}
            hintWhenReady="点击展开零食架"
            onClick={() => setShelfOpen(true)}
          />

          {/* 3. 提醒打卡 Remind */}
          <InteractionButton
            label="提醒打卡"
            icon={<Icon name="megaphone" size={18} />}
            state={actionStates.remind}
            onClick={handleRemind}
          />
        </div>
      )}

      {/* 拖拽浮层 */}
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

      {/* 反馈横幅 */}
      {feedback && (
        <div className="bg-primary-soft text-primary-ink text-tiny mt-3 flex items-center gap-2 rounded-xl px-3 py-2 font-semibold">
          <Icon name="sparkles" size={15} className="shrink-0" />
          <span className="min-w-0 flex-1">{feedback}</span>
        </div>
      )}
    </Card>
  )
}

/**
 * 静态兜底渲染（供服务端与单元测试快照使用，免注入 QueryClient）
 */
function FriendRoomStageStatic({ friend, onBack }: FriendRoomBannerProps) {
  const mascot: MascotRegistryCharacter = friend.mascot ?? 'tuan'
  const mascotName = characterName(mascot)
  const initial = getInitialSpeech(friend, mascotName)

  return (
    <Card
      variant="sticker"
      data-ann="friend-room.stage"
      className="relative flex flex-col justify-between overflow-hidden bg-[radial-gradient(ellipse_at_50%_25%,var(--surface)_0%,var(--background)_65%,var(--surface-sunken)_100%)] p-4 sm:p-5"
    >
      <div className="relative z-10 flex items-start justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar
            name={friend.nickname}
            avatar={friend.avatar}
            size="md"
            ring={friend.streak > 0}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h3 className="text-caption sm:text-heading truncate font-bold">
                正在串门 {friend.nickname} 的小窝
              </h3>
              <Badge tone="diet" icon="flame">
                连续 {friend.streak} 天
              </Badge>
              <Badge tone={initial.badgeTone} dot>
                {initial.badgeText}
              </Badge>
            </div>
            <p className="text-tiny text-muted mt-0.5 truncate">
              陪伴伙伴：{mascotName} · 串门只读小窝模式
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onBack} className="shrink-0">
          返回我的主页
        </Button>
      </div>

      <div className="my-3 flex flex-col items-center justify-center">
        <div className="border-border bg-surface shadow-soft mb-2 max-w-xs rounded-2xl border px-3.5 py-1 text-center">
          <p className="text-tiny text-muted font-semibold">{initial.speech}</p>
        </div>
        <InteractivePet size={156} character={mascot} idleSleepMs={0} speech />
      </div>

      <div data-ann="friend-room.actions" className="grid grid-cols-3 gap-2.5 pt-1">
        <InteractionButton
          label="戳戳"
          icon={<Icon name="hand" size={18} />}
          state={{ used: 0, limit: 3, cooldownLeftSec: 0 }}
          onClick={() => {}}
        />
        <InteractionButton
          label="投喂零食"
          icon={<TreatGlyph id="strawberry" size={20} />}
          state={{ used: 0, limit: 1, cooldownLeftSec: 0 }}
          hintWhenReady="点击展开零食架"
          onClick={() => {}}
        />
        <InteractionButton
          label="提醒打卡"
          icon={<Icon name="megaphone" size={18} />}
          state={{
            used: 0,
            limit: 1,
            cooldownLeftSec: 0,
            disabledReason:
              friend.todayPlanned === 0
                ? '今日休息'
                : friend.todayDone >= friend.todayPlanned
                  ? '今日已达标'
                  : null,
          }}
          onClick={() => {}}
        />
      </div>
    </Card>
  )
}

function InteractionButton({
  label,
  icon,
  state,
  hintWhenReady,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  state: PetActionState
  hintWhenReady?: string
  onClick: () => void
}) {
  const remaining = Math.max(0, state.limit - state.used)
  const exhausted = remaining === 0
  const cooling = state.cooldownLeftSec > 0 && !exhausted
  const disabled = Boolean(state.disabledReason) || exhausted || cooling

  let subText = hintWhenReady
    ? `${hintWhenReady} (${remaining}/${state.limit})`
    : `今日余 ${remaining}/${state.limit}`
  if (state.disabledReason) {
    subText = state.disabledReason
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

/**
 * 好友小窝宠物舞台与轻互动横幅（Issue #21 + #22 · M4）：
 * - 串门小窝模式顶栏与返回按钮
 * - 陪伴宠物动态神态（睡眠/欢呼/开心）与全勤印章
 * - 6 格展开式零食架与投喂拖拽/点击动作
 * - 戳戳 / 投喂 / 提醒打卡 30 分钟冷却与好友时区每日重置
 */
export function FriendRoomBanner(props: FriendRoomBannerProps) {
  const hasClient = useHasQueryClient()
  if (!hasClient) {
    return <FriendRoomStageStatic {...props} />
  }
  return <FriendRoomStageConnected {...props} />
}
