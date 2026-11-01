'use client'

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  PutRating,
  PutWeight,
  Rating,
  WeightEntry,
  WeightTrend,
} from '@/features/metric/schemas'
import type { CheckinToday } from '@/features/checkin/schemas'
import { apiFetch } from '../fetcher'
import { keys } from '../keys'

/*
 * 每日指标的查询与写操作（PRD 2.5），D3。
 */

export const weightTrendQuery = (days = 30) =>
  queryOptions({
    queryKey: keys.metrics.weight(days),
    queryFn: () => apiFetch<WeightTrend>(`/metrics/weight?days=${days}`),
  })

export function usePutWeight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PutWeight) =>
      apiFetch<WeightEntry>('/metrics/weight', { method: 'PUT', json: input }),
    onSuccess: (entry) => {
      qc.setQueryData<CheckinToday>(keys.checkins.today(), (old) =>
        old && old.localDate === entry.localDate ? { ...old, weightGrams: entry.weightGrams } : old,
      )
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.metrics.all })
      void qc.invalidateQueries({ queryKey: keys.dashboard.all })
      void qc.invalidateQueries({ queryKey: keys.checkins.today() })
    },
  })
}

export function usePutRating() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PutRating) => apiFetch<Rating>('/ratings', { method: 'PUT', json: input }),
    // 乐观更新今日心情：评分点下去立刻生效
    onMutate: async (input) => {
      if (input.scope !== 'overall') return { previous: undefined }
      await qc.cancelQueries({ queryKey: keys.checkins.today() })
      const previous = qc.getQueryData<CheckinToday>(keys.checkins.today())
      if (previous)
        qc.setQueryData<CheckinToday>(keys.checkins.today(), { ...previous, mood: input.value })
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(keys.checkins.today(), ctx.previous)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.dashboard.all })
      void qc.invalidateQueries({ queryKey: keys.checkins.today() })
    },
  })
}
