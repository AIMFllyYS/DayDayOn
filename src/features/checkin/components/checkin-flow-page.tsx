'use client'

import { useRouter } from 'next/navigation'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { GoalLinkButton } from '@/features/goal/components/goal-link-button'
import { daysBetween } from '@/lib/time'
import { errorMessage, isApiError, newIdempotencyKey, useQuery } from '@/lib/api'
import {
  checkinDayQuery,
  checkinGoalQuery,
  checkinMeQuery,
  checkinTodayQuery,
  useCreateCheckin,
} from '@/lib/api/queries/checkins'
import { CheckinFlow } from '../flow/checkin-flow'
import { moduleDef } from '../modules/registry'
import type { Checkin, CreateCheckinInput } from '../schemas'
import type { CheckinInputMode } from './smart-scanner'

/*
 * /goals/[goalId]/checkin 的数据接线：目标详情 + 今天 + 我的偏好 → CheckinFlow（checkin-modules.md 第 5 节）。
 * 每次确认生成新的幂等键：一次 Agent 裁判对应一次入库，重复点击由按钮 loading 拦住。
 */

const MILESTONES = [7, 14, 21, 30, 60, 100, 200, 365]

/** 周期环：设了截止日期按 起始 → 截止；没设就取下一个里程碑（7、14、21、30…天） */
function periodOf(validDays: number, startDate: string, deadline: string | null) {
  if (deadline && deadline >= startDate) {
    return { done: validDays, total: Math.max(1, daysBetween(startDate, deadline) + 1) }
  }
  const total = MILESTONES.find((m) => m > validDays) ?? validDays + 1
  return { done: validDays, total }
}

export function CheckinFlowPage({
  goalId,
  initialMode,
}: {
  goalId: string
  initialMode: CheckinInputMode
}) {
  const router = useRouter()
  const goal = useQuery(checkinGoalQuery(goalId))
  const today = useQuery(checkinTodayQuery())
  const me = useQuery(checkinMeQuery())
  const localDate = today.data?.localDate ?? ''
  const dayCheckins = useQuery({
    ...checkinDayQuery(goalId, localDate),
    enabled: Boolean(localDate),
  })
  const create = useCreateCheckin()

  if (
    goal.isPending ||
    today.isPending ||
    me.isPending ||
    (Boolean(localDate) && dayCheckins.isPending)
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
    dayStartHour: 0,
  }
  const startDate = g.createdAt.slice(0, 10)

  async function confirm(input: CreateCheckinInput): Promise<Checkin> {
    try {
      const result = await create.mutateAsync({
        goalId,
        input,
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
      today={today.data.localDate}
      todayCheckins={dayCheckins.data?.items ?? []}
      tier={me.data.preferences.refereeTier}
      period={periodOf(g.validDays, startDate, g.deadlineDate)}
      initialMode={initialMode}
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
