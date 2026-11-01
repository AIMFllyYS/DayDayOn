'use client'

import { useState } from 'react'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import type { RatingValue } from '@/components/ui/rating'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { errorMessage, isApiError, newIdempotencyKey, useQuery, useQueryClient } from '@/lib/api'
import {
  checkinGoalQuery,
  checkinMeQuery,
  checkinTodayQuery,
  useCreateCheckin,
} from '@/lib/api/queries/checkins'
import { usePutRating } from '@/lib/api/queries/metrics'
import { GoalLinkButton } from '@/features/goal/components/goal-link-button'
import { afterCheckinChange } from '@/lib/api'
import type { CheckinToday, CreateCheckinInput, DietMethod, GoalProgress } from '../schemas'
import { CheckinScreen, type CheckinSubmitResult } from './checkin-screen'

/*
 * /goals/[goalId]/checkin 的数据接线：目标详情 + 今天状态 + 时区 → CheckinScreen。
 * 幂等键按"一次用户操作"生成：提交失败后重试复用同一个键，成功后换新键（api-conventions.md 第 9 节）。
 */

export function CheckinPage({
  goalId,
  initialMethod,
}: {
  goalId: string
  initialMethod?: DietMethod
}) {
  const qc = useQueryClient()
  const goal = useQuery(checkinGoalQuery(goalId))
  const today = useQuery(checkinTodayQuery())
  const me = useQuery(checkinMeQuery())
  const create = useCreateCheckin()
  const rate = usePutRating()
  const [rating, setRating] = useState<RatingValue | null>(null)
  const [key, setKey] = useState(newIdempotencyKey)
  const [lastBody, setLastBody] = useState<string | null>(null)

  if (goal.isPending || today.isPending || me.isPending) return <CheckinSkeleton />
  if (goal.isError && isApiError(goal.error) && goal.error.code === 'GOAL_NOT_FOUND') {
    return (
      <EmptyState
        title="找不到这个目标"
        description="可能已经删除了，回目标列表看看"
        mood="sad"
        action={<GoalLinkButton href="/goals">回目标列表</GoalLinkButton>}
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
    return <EmptyState title="这个目标已经归档了" description="恢复后才能继续打卡" />
  }

  const g = goal.data
  const todayDate = today.data.localDate
  const row = today.data.goals.find((x) => x.goalId === goalId)
  // 不在今天计划里的目标弹层不列出，进度从 0 起，提交后以服务端返回为准
  const progress: GoalProgress = row?.progress ?? { value: 0, target: g.target.value, done: false }

  async function submit(input: CreateCheckinInput): Promise<CheckinSubmitResult> {
    // 请求体变了（用户改了表单）就换一个键，否则同键会被判为 IDEMPOTENCY_KEY_REUSED
    const body = JSON.stringify(input)
    let k = key
    if (lastBody !== null && lastBody !== body) {
      k = newIdempotencyKey()
      setKey(k)
    }
    setLastBody(body)
    const result = await create.mutateAsync({ goalId, input, idempotencyKey: k })
    setKey(newIdempotencyKey())
    setLastBody(null)
    return { localDate: result.checkin.localDate, progress: result.progress }
  }

  async function aiConfirmed(): Promise<CheckinSubmitResult> {
    for (const k of afterCheckinChange) await qc.invalidateQueries({ queryKey: k })
    const fresh = qc.getQueryData<CheckinToday>(checkinTodayQuery().queryKey)
    const p = fresh?.goals.find((x) => x.goalId === goalId)?.progress ?? progress
    return { localDate: fresh?.localDate ?? todayDate, progress: p }
  }

  return (
    <CheckinScreen
      goal={g}
      today={today.data.localDate}
      progress={progress}
      clock={{ timeZone: me.data.profile.timeZone, dayStartHour: me.data.preferences.dayStartHour }}
      initialMethod={initialMethod}
      rating={rating}
      onRate={(v) => {
        const prev = rating
        setRating(v)
        rate.mutate(
          { scope: g.module, value: v },
          {
            onError: (e) => {
              setRating(prev)
              toast.error(isApiError(e) ? errorMessage(e) : '出了点小状况，稍后再试试')
            },
          },
        )
      }}
      onSubmit={submit}
      onAiConfirmed={aiConfirmed}
      toFormErrors={(e) => {
        if (isApiError(e) && e.fields) return e.fields
        toast.error(isApiError(e) ? errorMessage(e) : '出了点小状况，稍后再试试')
        return undefined
      }}
    />
  )
}

function CheckinSkeleton() {
  return (
    <div role="status" aria-label="加载中" className="mx-auto grid w-full max-w-xl gap-3 pt-2">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-10 rounded-xl" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-72 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  )
}
