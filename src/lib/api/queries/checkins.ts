'use client'

import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import type {
  Checkin,
  CheckinCalendar,
  CheckinHistory,
  CheckinToday,
  CreateCheckinInput,
  CreateCheckinResult,
  UpdateCheckin,
} from '@/features/checkin/schemas'
import type { GoalDetail } from '@/features/goal/schemas'
import type { Me } from '@/features/me/schemas'
import { apiFetch } from '../fetcher'
import { afterCheckinChange, keys } from '../keys'

/*
 * 打卡领域的查询与写操作（client-data-and-forms.md 第 2、5 节），D3。key 只来自 keys.ts。
 */

export const checkinTodayQuery = () =>
  queryOptions({
    queryKey: keys.checkins.today(),
    queryFn: () => apiFetch<CheckinToday>('/checkins/today'),
  })

export const checkinCalendarQuery = (goalId: string, month: string) =>
  queryOptions({
    queryKey: keys.checkins.calendar(goalId, month),
    queryFn: () =>
      apiFetch<CheckinCalendar>(`/goals/${goalId}/calendar?month=${encodeURIComponent(month)}`),
  })

export const checkinHistoryQuery = (goalId: string) =>
  infiniteQueryOptions({
    queryKey: keys.checkins.history(goalId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiFetch<CheckinHistory>(
        `/goals/${goalId}/checkins?limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextCursor,
  })

/** 打卡页需要目标详情（标题、目标量、自定义字段版本）。key 与 D2 的 goals 详情共用 */
export const checkinGoalQuery = (goalId: string) =>
  queryOptions({
    queryKey: keys.goals.detail(goalId),
    queryFn: () => apiFetch<GoalDetail>(`/goals/${goalId}`),
  })

/** 时区与日切换时间：睡眠表单组合时刻用。key 与 D1 的 /me 共用 */
export const checkinMeQuery = () =>
  queryOptions({ queryKey: keys.me.detail(), queryFn: () => apiFetch<Me>('/me') })

function invalidateAfterCheckin(qc: QueryClient) {
  for (const k of afterCheckinChange) void qc.invalidateQueries({ queryKey: k })
}

export interface CreateCheckinVars {
  goalId: string
  input: CreateCheckinInput
  /** 每次用户点击生成一个，重试时复用 */
  idempotencyKey: string
}

export function useCreateCheckin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ goalId, input, idempotencyKey }: CreateCheckinVars) =>
      apiFetch<CreateCheckinResult>(`/goals/${goalId}/checkins`, {
        method: 'POST',
        json: input,
        idempotencyKey,
      }),
    onSuccess: (result, { goalId }) => {
      // 先把弹层里这一行的进度写成最新值，再整体失效刷新
      qc.setQueryData<CheckinToday>(keys.checkins.today(), (old) => {
        if (!old || result.checkin.localDate !== old.localDate) return old
        const goals = old.goals.map((g) =>
          g.goalId === goalId ? { ...g, progress: result.progress } : g,
        )
        return {
          ...old,
          goals,
          completion: { ...old.completion, done: goals.filter((g) => g.progress.done).length },
        }
      })
    },
    onSettled: () => invalidateAfterCheckin(qc),
  })
}

export function useDeleteCheckin(goalId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (checkinId: string) =>
      apiFetch<undefined>(`/checkins/${checkinId}`, { method: 'DELETE' }),
    // 乐观更新：先从历史列表里拿掉，失败回滚
    onMutate: async (checkinId) => {
      const key = keys.checkins.history(goalId)
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData(checkinHistoryQuery(goalId).queryKey)
      qc.setQueryData(checkinHistoryQuery(goalId).queryKey, (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((p) => ({
                ...p,
                items: p.items.filter((c) => c.id !== checkinId),
              })),
            }
          : old,
      )
      return { previous }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(checkinHistoryQuery(goalId).queryKey, ctx.previous)
    },
    onSettled: () => invalidateAfterCheckin(qc),
  })
}

export function useUpdateCheckin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ checkinId, patch }: { checkinId: string; patch: UpdateCheckin }) =>
      apiFetch<Checkin>(`/checkins/${checkinId}`, { method: 'PATCH', json: patch }),
    onSettled: () => invalidateAfterCheckin(qc),
  })
}
