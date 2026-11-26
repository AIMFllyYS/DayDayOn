'use client'

import { useState } from 'react'
import { TrendLineChart } from '@/components/charts/trend-line-chart'
import { ErrorState } from '@/components/ui/error-state'
import { Rating, type RatingValue } from '@/components/ui/rating'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { moodLabel } from '@/features/dashboard/format'
import type { LocalDate } from '@/features/shared/schemas'
import { errorMessage, isApiError, useQuery } from '@/lib/api'
import { ratingTrendQuery, usePutRating } from '@/lib/api/queries/metrics'

/*
 * 今日心情（PRD 2.5，Issue #104）：
 * - 上方按需懒加载展示近一年心情走势（纵轴固定 1–5 档与手账语义文案，严禁 Unicode emoji）；
 * - 点击下方评分即乐观更新并实时落点到折线图，不再使用延迟跳转定时器（避免卸载后误触回弹）。
 */

const MOOD_Y_TICKS = [
  { value: 5, label: '超棒' },
  { value: 3, label: '一般' },
  { value: 1, label: '很糟' },
] as const

export function MoodPanel({
  open,
  localDate,
  value,
}: {
  open: boolean
  localDate: LocalDate
  value: number | null
}) {
  const [picked, setPicked] = useState<RatingValue | null>((value as RatingValue | null) ?? null)
  const put = usePutRating()
  const trend = useQuery({ ...ratingTrendQuery('overall', 365), enabled: open })

  function pick(v: RatingValue) {
    setPicked(v)
    put.mutate(
      { scope: 'overall', value: v },
      {
        onSuccess: () => toast.success('今日心情已记录'),
        onError: (e) => {
          setPicked((value as RatingValue | null) ?? null)
          toast.error(isApiError(e) ? errorMessage(e) : '出了点小状况，稍后再试试')
        },
      },
    )
  }

  const points = (trend.data?.entries ?? []).map((e) => ({
    date: e.localDate,
    value: e.value,
  }))

  const defaultSummary =
    trend.data && trend.data.count > 0 && trend.data.average !== null
      ? `近一年 · 均分 ${trend.data.average.toFixed(1)} · 记录 ${trend.data.count} 天`
      : undefined

  return (
    <div className="flex flex-col gap-3.5 py-1">
      {trend.isPending ? (
        <Skeleton className="h-[188px] w-full rounded-2xl" />
      ) : trend.isError ? (
        <ErrorState
          size="compact"
          title="近一年心情走势没加载出来"
          message={isApiError(trend.error) ? errorMessage(trend.error) : undefined}
          onRetry={() => void trend.refetch()}
          retrying={trend.isRefetching}
        />
      ) : (
        <TrendLineChart
          chartId="mood"
          data={points}
          endDate={localDate}
          days={365}
          label="近一年心情变化"
          tone="primary"
          yDomain={[1, 5]}
          yTicks={MOOD_Y_TICKS}
          formatPointValue={(v) => `${v} 分 · ${moodLabel(v)}`}
          defaultSummary={defaultSummary}
          emptyText="近一年还没有心情记录，点下方表情记下今天吧"
        />
      )}

      <Rating
        value={picked}
        onValueChange={pick}
        label="今日心情"
        tone="primary"
        className="justify-between"
      />
      <p className="text-tiny text-muted">只能评今天，再评一次会覆盖</p>
    </div>
  )
}
