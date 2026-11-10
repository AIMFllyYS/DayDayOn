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

/** 某目标今日已入库的打卡记录（凌晨 0 点前重进页面或切换餐次时直接读取恢复状态） */
export const checkinDayQuery = (goalId: string, localDate: string) =>
  queryOptions({
    queryKey: keys.checkins.history(goalId, { from: localDate, to: localDate }),
    queryFn: () =>
      apiFetch<CheckinHistory>(
        `/goals/${goalId}/checkins?from=${encodeURIComponent(localDate)}&to=${encodeURIComponent(localDate)}&limit=20`,
      ),
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
      // 先把弹层、当日打卡与目标有效天数写成最新值，消除跨页返回时的旧缓存闪烁
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

      const dayKey = checkinDayQuery(goalId, result.checkin.localDate).queryKey
      const prevDay = qc.getQueryData<CheckinHistory>(dayKey)
      if (prevDay) {
        const wasValidToday = prevDay.items.some((c) => c.isValid)
        const idx = prevDay.items.findIndex(
          (c) =>
            c.id === result.checkin.id ||
            (c.payload.module === 'diet' &&
              result.checkin.payload.module === 'diet' &&
              c.payload.mealType === result.checkin.payload.mealType),
        )
        const rawItems =
          idx >= 0
            ? prevDay.items.map((c, i) => (i === idx ? result.checkin : c))
            : [result.checkin, ...prevDay.items]
        const nextItems =
          result.checkin.payload.module === 'diet' &&
          result.checkin.verdict?.settlement === 'settled'
            ? rawItems.map((c) =>
                c.payload.module === 'diet'
                  ? { ...c, isValid: result.checkin.isValid, score: result.checkin.score }
                  : c,
              )
            : rawItems
        const nowValidToday = nextItems.some((c) => c.isValid)
        qc.setQueryData<CheckinHistory>(dayKey, { ...prevDay, items: nextItems })
        if (wasValidToday !== nowValidToday) {
          qc.setQueryData<GoalDetail>(keys.goals.detail(goalId), (oldGoal) =>
            oldGoal
              ? {
                  ...oldGoal,
                  validDays: Math.max(0, oldGoal.validDays + (nowValidToday ? 1 : -1)),
                }
              : oldGoal,
          )
        }
      }
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
