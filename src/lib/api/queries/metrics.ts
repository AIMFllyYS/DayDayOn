'use client'

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CheckinToday } from '@/features/checkin/schemas'
import type {
  PutRating,
  PutSteps,
  PutWeight,
  Rating,
  RatingTrend,
  StepEntry,
  StepTrend,
  WeightEntry,
  WeightTrend,
} from '@/features/metric/schemas'
import type { RatingScope } from '@/features/shared/schemas'
import { apiFetch } from '../fetcher'
import { keys } from '../keys'

/*
 * 每日指标的查询与写操作（PRD 2.5，Issue #104），D3。
 */

function upsertWeightTrendCache(
  old: WeightTrend | undefined,
  entry: WeightEntry,
): WeightTrend | undefined {
  if (!old) return old
  const nextEntries = [...old.entries.filter((e) => e.localDate !== entry.localDate), entry].sort(
    (a, b) => (a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : 0),
  )
  return {
    ...old,
    entries: nextEntries,
    latest: nextEntries.at(-1) ?? entry,
  }
}

function upsertRatingTrendCache(
  old: RatingTrend | undefined,
  localDate: string,
  value: Rating['value'],
): RatingTrend | undefined {
  if (!old) return old
  const nextEntries = [
    ...old.entries.filter((e) => e.localDate !== localDate),
    { localDate, value },
  ].sort((a, b) => (a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : 0))
  const count = nextEntries.length
  const sum = nextEntries.reduce((acc, e) => acc + e.value, 0)
  return {
    ...old,
    entries: nextEntries,
    latest: nextEntries.at(-1) ?? null,
    average: count > 0 ? Math.round((sum / count) * 10) / 10 : null,
    count,
  }
}

export const weightTrendQuery = (days = 30) =>
  queryOptions({
    queryKey: keys.metrics.weight(days),
    queryFn: () => apiFetch<WeightTrend>(`/metrics/weight?days=${days}`),
  })

export const ratingTrendQuery = (scope: RatingScope = 'overall', days = 365) =>
  queryOptions({
    queryKey: keys.metrics.ratings(scope, days),
    queryFn: () => apiFetch<RatingTrend>(`/ratings?scope=${scope}&days=${days}`),
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
      qc.setQueryData<WeightTrend>(keys.metrics.weight(365), (old) =>
        upsertWeightTrendCache(old, entry),
      )
      qc.setQueryData<WeightTrend>(keys.metrics.weight(30), (old) =>
        upsertWeightTrendCache(old, entry),
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
    // 乐观更新今日心情与近一年走势图：评分点下去立刻落点
    onMutate: async (input) => {
      const ratingTrendKey = keys.metrics.ratings(input.scope, 365)
      await Promise.all([
        qc.cancelQueries({ queryKey: keys.checkins.today() }),
        qc.cancelQueries({ queryKey: ratingTrendKey }),
      ])
      const previousToday = qc.getQueryData<CheckinToday>(keys.checkins.today())
      const previousTrend = qc.getQueryData<RatingTrend>(ratingTrendKey)
      if (input.scope === 'overall' && previousToday) {
        qc.setQueryData<CheckinToday>(keys.checkins.today(), {
          ...previousToday,
          mood: input.value,
        })
      }
      if (previousToday) {
        qc.setQueryData<RatingTrend>(ratingTrendKey, (old) =>
          upsertRatingTrendCache(old, previousToday.localDate, input.value),
        )
      }
      return { previousToday, previousTrend, ratingTrendKey }
    },
    onSuccess: (saved) => {
      qc.setQueryData<RatingTrend>(keys.metrics.ratings(saved.scope, 365), (old) =>
        upsertRatingTrendCache(old, saved.localDate, saved.value),
      )
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previousToday) qc.setQueryData(keys.checkins.today(), ctx.previousToday)
      if (ctx?.previousTrend) qc.setQueryData(ctx.ratingTrendKey, ctx.previousTrend)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.metrics.all })
      void qc.invalidateQueries({ queryKey: keys.dashboard.all })
      void qc.invalidateQueries({ queryKey: keys.checkins.today() })
    },
  })
}

export const stepTrendQuery = (days = 30) =>
  queryOptions({
    queryKey: keys.metrics.steps(days),
    queryFn: () => apiFetch<StepTrend>(`/metrics/steps?days=${days}`),
  })

export function usePutSteps() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PutSteps) =>
      apiFetch<StepEntry>('/metrics/steps', { method: 'PUT', json: input }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.metrics.all })
      void qc.invalidateQueries({ queryKey: keys.dashboard.all })
    },
  })
}
