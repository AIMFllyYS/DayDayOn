'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { type CalendarMark } from '@/components/ui/calendar'
import { Badge } from '@/components/ui/badge'
import { IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { Tone } from '@/components/ui/tone'
import { gramsToKg } from '@/features/checkin/format'
import { RecordHistoryCard } from '@/features/checkin/components/record-history-card'
import type { MetricHistoryItem, MetricKind } from '@/features/metric/schemas'
import type { LocalDate } from '@/features/shared/schemas'
import { errorMessage, isApiError, keepPreviousData, useInfiniteQuery, useQuery } from '@/lib/api'
import { metricCalendarQuery, metricHistoryQuery, useDeleteMetric } from '@/lib/api/queries/metrics'
import { formatLocalDateLabel } from '@/lib/time'

const Calendar = dynamic(() => import('@/components/ui/calendar').then((m) => m.Calendar), {
  loading: () => <Skeleton className="h-64 w-full rounded-2xl" />,
})

/*
 * /metrics/[metric] Tab 2「详细记录」：
 * 与 /goals/[goalId] 保持一致的 @3xl:grid-cols-[1fr_1.1fr] 双栏布局：
 * - 左栏复用 Calendar 渲染月度记录日历（点击今天或昨天可直接唤起修改 Dock）；
 * - 右栏复用抽离出的 RecordHistoryCard 渲染游标分页详细记录（支持改今日/昨日与任意历史日期删除二次确认）。
 */

const MOOD_LABELS = ['很糟', '不太好', '一般', '不错', '超棒'] as const

const METRIC_TONE: Record<MetricKind, Tone> = {
  weight: 'primary',
  mood: 'custom',
  steps: 'exercise',
}

const METRIC_LABEL: Record<MetricKind, string> = {
  weight: '体重',
  mood: '心情',
  steps: '步数',
}

function formatRecordValue(kind: MetricKind, value: number): string {
  if (kind === 'weight') return `${gramsToKg(value).toFixed(1)} kg`
  if (kind === 'mood') {
    const r = Math.min(5, Math.max(1, Math.round(value)))
    return `${r} 分 · ${MOOD_LABELS[r - 1]}`
  }
  return `${value.toLocaleString('en-US')} 步`
}

export interface MetricRecordsTabProps {
  kind: MetricKind
  todayDate: LocalDate
  yesterdayDate: LocalDate
  dailyStepTarget: number | null
  onEditDate: (localDate: LocalDate) => void
}

export function MetricRecordsTab({
  kind,
  todayDate,
  yesterdayDate,
  dailyStepTarget,
  onEditDate,
}: MetricRecordsTabProps) {
  const [month, setMonth] = useState<string>(todayDate.slice(0, 7))
  const calendar = useQuery({
    ...metricCalendarQuery(kind, month),
    placeholderData: keepPreviousData,
  })
  const history = useInfiniteQuery(metricHistoryQuery(kind, 30))
  const remove = useDeleteMetric(kind)

  const tone = METRIC_TONE[kind]
  const label = METRIC_LABEL[kind]
  const items: MetricHistoryItem[] = history.data ? history.data.pages.flatMap((p) => p.items) : []

  const marks: CalendarMark[] = (calendar.data?.days ?? []).map((d) => {
    const reached =
      kind === 'steps'
        ? dailyStepTarget === null || d.value >= dailyStepTarget
        : kind === 'mood'
          ? d.value >= 4
          : true
    return {
      date: d.localDate,
      tone,
      variant: reached ? 'done' : 'partial',
      label: `${label} ${formatRecordValue(kind, d.value)}`,
    }
  })

  return (
    <div className="grid gap-3 @3xl:grid-cols-[1fr_1.1fr] @3xl:items-start @3xl:gap-4">
      <Card>
        {calendar.isPending ? (
          <div role="status" aria-label="加载月历中" className="flex flex-col gap-3">
            <Skeleton className="mx-auto h-6 w-32" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : calendar.isError ? (
          <ErrorState
            size="compact"
            title="月历没加载出来"
            message={isApiError(calendar.error) ? errorMessage(calendar.error) : undefined}
            onRetry={() => void calendar.refetch()}
            retrying={calendar.isRefetching}
          />
        ) : (
          <Calendar
            label={`${label}月度记录日历`}
            today={todayDate}
            month={month}
            onMonthChange={setMonth}
            marks={marks}
            onDayClick={(date) => {
              if (date === todayDate || date === yesterdayDate) {
                onEditDate(date)
              }
            }}
            footer={
              <div className="text-tiny text-muted flex flex-wrap items-center justify-between gap-2 pt-1">
                <span>
                  {kind === 'steps' && dailyStepTarget !== null
                    ? `实色 ≥ ${dailyStepTarget.toLocaleString('en-US')} 步 · 浅色已记`
                    : kind === 'mood'
                      ? '实色好心情（≥4 分）· 浅色已记'
                      : '高亮日期表示已有记录'}
                </span>
                <span>点今天或昨天可快捷修改</span>
              </div>
            }
          />
        )}
      </Card>

      <RecordHistoryCard
        title={`${label}详细记录`}
        description="支持修改今天与昨天；更早记录可删除"
        items={items}
        getKey={(item) => item.localDate}
        isPending={history.isPending}
        isError={history.isError}
        error={history.error}
        isRefetching={history.isRefetching}
        onRetry={() => void history.refetch()}
        hasNextPage={history.hasNextPage}
        isFetchingNextPage={history.isFetchingNextPage}
        onFetchNextPage={() => void history.fetchNextPage()}
        emptyTitle={`还没有${label}记录`}
        emptyDescription={`点击上方「记今日」记录你的第一条${label}数据`}
        deleteConfig={{
          title: (item) => `删除 ${formatLocalDateLabel(item.localDate)} 的${label}记录？`,
          description: '删除后该日数据将从走势图与统计结果中移除，且不可恢复。',
          onDelete: (item) => remove.mutateAsync(item.localDate),
        }}
        renderItem={(item, { requestDelete }) => {
          const isEditable = item.localDate === todayDate || item.localDate === yesterdayDate
          const stepReached =
            kind === 'steps' && dailyStepTarget !== null && item.value >= dailyStepTarget
          return (
            <div className="flex min-h-14 items-center gap-2 py-1.5 pr-1 pl-3.5">
              <div className="min-w-0 flex-1">
                <p className="font-display text-caption font-semibold tabular-nums">
                  {formatRecordValue(kind, item.value)}
                </p>
                <p className="text-tiny text-muted">
                  {item.localDate}
                  {item.localDate === todayDate
                    ? ' · 今天'
                    : item.localDate === yesterdayDate
                      ? ' · 昨天'
                      : ''}
                </p>
              </div>
              {stepReached && <Badge tone="success">达参考线</Badge>}
              {kind === 'mood' && item.value >= 4 && <Badge tone="custom">好心情</Badge>}
              {isEditable && (
                <IconButton
                  icon="edit"
                  label={`修改 ${item.localDate} 的${label}`}
                  onClick={() => onEditDate(item.localDate)}
                />
              )}
              <IconButton
                icon="trash"
                label={`删除 ${item.localDate} 的${label}`}
                onClick={() => requestDelete(item)}
              />
            </div>
          )
        }}
      />
    </div>
  )
}
