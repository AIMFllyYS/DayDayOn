'use client'

import { useState } from 'react'
import { Calendar, CalendarLegend, type CalendarMark } from '@/components/ui/calendar'
import { Card } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { Module } from '@/features/shared/schemas'
import { errorMessage, isApiError, keepPreviousData, useQuery } from '@/lib/api'
import { checkinCalendarQuery, checkinTodayQuery } from '@/lib/api/queries/checkins'
import type { CalendarDay } from '../schemas'

export interface GoalCheckinCalendarProps {
  goalId: string
  /** 已打卡的日子用板块色标记 */
  module: Module
}

function toMark(day: CalendarDay, module: Module): CalendarMark {
  const variant = day.makeupOnly ? 'makeup' : day.done ? 'done' : 'partial'
  const label = day.makeupOnly
    ? `补卡 ${day.count} 次`
    : day.done
      ? `已完成，打卡 ${day.count} 次`
      : `已打卡 ${day.count} 次，未达成`
  return { date: day.localDate, tone: module, variant, label }
}

/**
 * 目标详情页的打卡日历（PRD 2.4）：GET /goals/{goalId}/calendar，补卡日用描边样式。
 * "今天"取 /checkins/today 的打卡日（服务端按用户时区算），日历不用浏览器时区。
 * props F1 定；实现 D3；D2 的详情页嵌入。
 */
export function GoalCheckinCalendar({ goalId, module }: GoalCheckinCalendarProps) {
  const today = useQuery(checkinTodayQuery())
  const [month, setMonth] = useState<string | null>(null)
  const current = month ?? today.data?.localDate.slice(0, 7) ?? null
  const calendar = useQuery({
    ...checkinCalendarQuery(goalId, current ?? ''),
    enabled: current !== null,
    placeholderData: keepPreviousData,
  })

  if (today.isPending || (calendar.isPending && current !== null)) {
    return (
      <Card role="status" aria-label="加载中" className="flex flex-col gap-3">
        <Skeleton className="mx-auto h-6 w-32" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </Card>
    )
  }
  const err = today.error ?? calendar.error
  if (!today.data || err) {
    return (
      <Card>
        <ErrorState
          size="compact"
          title="日历没加载出来"
          message={isApiError(err) ? errorMessage(err) : undefined}
          onRetry={() => {
            void today.refetch()
            void calendar.refetch()
          }}
        />
      </Card>
    )
  }
  const marks = (calendar.data?.days ?? []).map((d) => toMark(d, module))
  return (
    <Card>
      <Calendar
        label="打卡日历"
        today={today.data.localDate}
        month={current ?? undefined}
        onMonthChange={setMonth}
        marks={marks}
        footer={<CalendarLegend tone={module} />}
      />
    </Card>
  )
}
