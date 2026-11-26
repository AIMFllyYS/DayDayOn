'use client'

import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import type { CheckinToday } from '@/features/checkin/schemas'
import type {
  MetricCalendar,
  MetricHistory,
  MetricKind,
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
import type { LocalDate, RatingScope } from '@/features/shared/schemas'
import { apiFetch } from '../fetcher'
import { keys } from '../keys'

/*
 * 每日指标的查询与写操作（PRD 2.5，Issue #104）。
 * 所有写入均同步更新近一年走势缓存并失效 metrics / dashboard / checkins.today。
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

function upsertStepTrendCache(
  old: StepTrend | undefined,
  entry: StepEntry,
  todayDate?: string,
): StepTrend | undefined {
  if (!old) return old
  const nextEntries = [...old.entries.filter((e) => e.localDate !== entry.localDate), entry].sort(
    (a, b) => (a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : 0),
  )
  const isToday = todayDate
    ? entry.localDate === todayDate
    : entry.localDate >= (old.latest?.localDate ?? '')
  return {
    ...old,
    todaySteps: isToday ? entry.steps : old.todaySteps,
    entries: nextEntries,
    latest: nextEntries.at(-1) ?? entry,
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

export const stepTrendQuery = (days = 30) =>
  queryOptions({
    queryKey: keys.metrics.steps(days),
    queryFn: () => apiFetch<StepTrend>(`/metrics/steps?days=${days}`),
  })

/** GET /metrics/{kind}/history：游标分页历史记录，供 /metrics/[metric]「详细记录」Tab 使用 */
export const metricHistoryQuery = (kind: MetricKind, limit = 30) =>
  infiniteQueryOptions({
    queryKey: keys.metrics.history(kind),
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({ limit: String(limit) })
      if (pageParam) qs.set('cursor', pageParam)
      return apiFetch<MetricHistory>(`/metrics/${kind}/history?${qs.toString()}`)
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })

/** GET /metrics/{kind}/calendar?month=YYYY-MM：指标月度日历 */
export const metricCalendarQuery = (kind: MetricKind, month: string) =>
  queryOptions({
    queryKey: keys.metrics.calendar(kind, month),
    queryFn: () => apiFetch<MetricCalendar>(`/metrics/${kind}/calendar?month=${month}`),
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
    // 乐观更新今日/昨日心情与近一年走势图：评分点下去立刻落点
    onMutate: async (input) => {
      const ratingTrendKey = keys.metrics.ratings(input.scope, 365)
      await Promise.all([
        qc.cancelQueries({ queryKey: keys.checkins.today() }),
        qc.cancelQueries({ queryKey: ratingTrendKey }),
      ])
      const previousToday = qc.getQueryData<CheckinToday>(keys.checkins.today())
      const previousTrend = qc.getQueryData<RatingTrend>(ratingTrendKey)
      const targetDate = input.localDate ?? previousToday?.localDate
      if (
        input.scope === 'overall' &&
        previousToday &&
        (!input.localDate || input.localDate === previousToday.localDate)
      ) {
        qc.setQueryData<CheckinToday>(keys.checkins.today(), {
          ...previousToday,
          mood: input.value,
        })
      }
      if (targetDate) {
        qc.setQueryData<RatingTrend>(ratingTrendKey, (old) =>
          upsertRatingTrendCache(old, targetDate, input.value),
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

export function usePutSteps() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PutSteps) =>
      apiFetch<StepEntry>('/metrics/steps', { method: 'PUT', json: input }),
    onSuccess: (entry) => {
      const todayData = qc.getQueryData<CheckinToday>(keys.checkins.today())
      qc.setQueryData<CheckinToday>(keys.checkins.today(), (old) =>
        old && old.localDate === entry.localDate ? { ...old, steps: entry.steps } : old,
      )
      qc.setQueryData<StepTrend>(keys.metrics.steps(365), (old) =>
        upsertStepTrendCache(old, entry, todayData?.localDate),
      )
      qc.setQueryData<StepTrend>(keys.metrics.steps(30), (old) =>
        upsertStepTrendCache(old, entry, todayData?.localDate),
      )
      qc.setQueryData<StepTrend>(keys.metrics.steps(7), (old) =>
        upsertStepTrendCache(old, entry, todayData?.localDate),
      )
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.metrics.all })
      void qc.invalidateQueries({ queryKey: keys.dashboard.all })
      void qc.invalidateQueries({ queryKey: keys.checkins.today() })
    },
  })
}

/** DELETE /metrics/{weight|steps}/{localDate} 或 DELETE /ratings/{localDate}?scope=overall */
export function useDeleteMetric(kind: MetricKind) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (localDate: LocalDate) => {
      const url =
        kind === 'mood'
          ? `/ratings/${localDate}?scope=overall&origin=manual`
          : `/metrics/${kind}/${localDate}?origin=manual`
      return apiFetch<void>(url, { method: 'DELETE' })
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.metrics.all })
      void qc.invalidateQueries({ queryKey: keys.dashboard.all })
      void qc.invalidateQueries({ queryKey: keys.checkins.today() })
    },
  })
}
