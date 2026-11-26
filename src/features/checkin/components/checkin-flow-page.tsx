'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { goalPeriodProgress } from '@/features/goal/period'
import { GoalLinkButton } from '@/features/goal/components/goal-link-button'
import { errorMessage, isApiError, newIdempotencyKey, useQuery } from '@/lib/api'
import {
  checkinDayQuery,
  checkinGoalQuery,
  checkinMeQuery,
  checkinTodayQuery,
  useCreateCheckin,
  useUpdateCheckin,
} from '@/lib/api/queries/checkins'
import { addDays } from '@/lib/time'
import { CheckinFlow } from '../flow/checkin-flow'
import { moduleDef } from '../modules/registry'
import type { Checkin, CreateCheckinInput, MealType } from '../schemas'
import type { CheckinInputMode } from './smart-scanner'

/*
 * /goals/[goalId]/checkin 的数据接线：目标详情 + 今天（或补卡时的昨天）+ 我的偏好 → CheckinFlow（checkin-modules.md 第 5 节）。
 * 每次确认生成新的幂等键：一次 Agent 裁判对应一次入库，重复点击由按钮 loading 拦住。
 * 切换补卡只读昨日记录、不卸载骨架；学习板块已达标回显后修改走 PATCH replace 原地覆盖并重算当日达标态。
 */

/** 周期环：设了截止日期按 起始 → 截止；没设就取下一个里程碑（7、14、21、30…天） */
export function periodOf(validDays: number, startDate: string, deadline: string | null) {
  return goalPeriodProgress(validDays, startDate, deadline)
}

export function CheckinFlowPage({
  goalId,
  initialMode,
  initialMeal,
}: {
  goalId: string
  initialMode: CheckinInputMode
  initialMeal?: MealType
}) {
  const router = useRouter()
  const [isMakeup, setIsMakeup] = useState(false)
  const goal = useQuery(checkinGoalQuery(goalId))
  const today = useQuery(checkinTodayQuery())
  const me = useQuery(checkinMeQuery())
  const localDate = today.data?.localDate ?? ''
  const yesterday = localDate ? addDays(localDate, -1) : ''
  const activeDate = isMakeup && yesterday ? yesterday : localDate
  const dayCheckins = useQuery({
    ...checkinDayQuery(goalId, activeDate),
    enabled: Boolean(activeDate),
  })
  const create = useCreateCheckin()
  const update = useUpdateCheckin()

  if (
    goal.isPending ||
    today.isPending ||
    me.isPending ||
    (!isMakeup && Boolean(localDate) && dayCheckins.isPending)
  ) {
    return <FlowSkeleton />
  }
  if (goal.isError && isApiError(goal.error) && goal.error.code === 'GOAL_NOT_FOUND') {
    return (
      <EmptyState
        title="找不到这个目标"
        description="可能已经删除了，回目标设置看看"
        mood="sad"
        action={<GoalLinkButton href="/goals">去目标设置</GoalLinkButton>}
      />
    )
  }
  const error = goal.error ?? today.error ?? me.error
  if (error || !goal.data || !today.data || !me.data) {
    return (
      <ErrorState
        title="打卡页没加载出来"
        message={isApiError(error) ? errorMessage(error) : undefined}
        retrying={goal.isRefetching || today.isRefetching || me.isRefetching}
        onRetry={() => {
          void goal.refetch()
          void today.refetch()
          void me.refetch()
        }}
      />
    )
  }
  if (goal.data.status === 'archived') {
    return (
      <EmptyState
        title="这个目标已经归档了"
        description="在目标设置里恢复后才能继续打卡"
        action={<GoalLinkButton href="/goals">去目标设置</GoalLinkButton>}
      />
    )
  }

  const g = goal.data
  const def = moduleDef(g.module)
  const clock = {
    timeZone: me.data.profile.timeZone,
    dayStartHour: me.data.preferences.dayStartHour ?? 4,
  }
  const startDate = g.createdAt.slice(0, 10)

  async function confirm(
    input: CreateCheckinInput,
    options?: { replaceCheckinId?: string },
  ): Promise<Checkin> {
    try {
      if (options?.replaceCheckinId) {
        return await update.mutateAsync({
          checkinId: options.replaceCheckinId,
          patch: {
            replace: input,
            ...(input.note !== undefined ? { note: input.note } : {}),
            origin: 'manual',
            reason: isMakeup ? '补卡覆盖更新记录' : '覆盖更新记录',
          },
        })
      }
      const result = await create.mutateAsync({
        goalId,
        input: isMakeup ? { ...input, isMakeup: true } : input,
        idempotencyKey: newIdempotencyKey(),
      })
      return result.checkin
    } catch (e) {
      if (isApiError(e) && e.fields) {
        const first = Object.values(e.fields).flat().find(Boolean)
        toast.error(first ?? errorMessage(e))
      } else {
        toast.error(isApiError(e) ? errorMessage(e) : '出了点小状况，稍后再试试')
      }
      throw e
    }
  }

  return (
    <CheckinFlow
      key={g.id}
      def={def}
      goal={g}
      clock={clock}
      today={activeDate}
      todayCheckins={dayCheckins.data?.items ?? []}
      isMakeup={isMakeup}
      dayLoading={dayCheckins.isFetching && !dayCheckins.data}
      dayError={dayCheckins.isError}
      onRetryDay={() => void dayCheckins.refetch()}
      onToggleMakeup={() => setIsMakeup((v) => !v)}
      tier={me.data.preferences.refereeTier}
      period={periodOf(g.validDays, startDate, g.deadlineDate)}
      initialMode={initialMode}
      initialMeal={initialMeal}
      onConfirm={confirm}
      onBack={() => (window.history.length > 1 ? router.back() : router.push('/'))}
    />
  )
}

function FlowSkeleton() {
  return (
    <div
      role="status"
      aria-label="加载中"
      className="mx-auto grid w-full max-w-xl gap-3 px-3.5 pt-16"
    >
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-10 w-full rounded-full" />
      <Skeleton className="h-14 w-full rounded-2xl" />
      <Skeleton className="h-14 w-full rounded-2xl" />
    </div>
  )
}
