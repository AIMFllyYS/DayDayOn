'use client'

import { useState } from 'react'
import { Calendar, CalendarLegend, type CalendarMark } from '@/components/ui/calendar'
import { Card } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { Module } from '@/features/shared/schemas'
import { errorMessage, isApiError, keepPreviousData, useQuery } from '@/lib/api'
import { checkinCalendarQuery, checkinTodayQuery } from '@/lib/api/queries/checkins'
import { friendGoalCalendarQuery } from '@/lib/api/queries/friends'
import type { CalendarDay } from '../schemas'

export interface GoalCheckinCalendarProps {
  goalId: string
  /** 已打卡的日子用板块色标记 */
  module: Module
  /** 好友只读模式：传入好友 userId 改走 /friends/{friendUserId}/goals/{goalId}/calendar */
  friendUserId?: string
  /** 好友时区对应的“今天”打卡日（YYYY-MM-DD）；传入时不再请求本人 /checkins/today */
  todayLocalDate?: string
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
 * 目标详情页的打卡日历（PRD 2.4）：支持本人与好友只读模式，补卡日用描边样式。
 * "今天"取服务端按用户时区算出的打卡日，日历不用浏览器时区。
 */
export function GoalCheckinCalendar({
  goalId,
  module,
  friendUserId,
  todayLocalDate,
}: GoalCheckinCalendarProps) {
  const today = useQuery({
    ...checkinTodayQuery(),
    enabled: !todayLocalDate,
  })
  const resolvedToday = todayLocalDate ?? today.data?.localDate ?? null
  const [month, setMonth] = useState<string | null>(null)
  const current = month ?? resolvedToday?.slice(0, 7) ?? null

  const ownCalendar = useQuery({
    ...checkinCalendarQuery(goalId, current ?? ''),
    enabled: !friendUserId && current !== null,
    placeholderData: keepPreviousData,
  })
  const friendCalendar = useQuery({
    ...friendGoalCalendarQuery(friendUserId ?? '', goalId, current ?? ''),
    enabled: Boolean(friendUserId) && current !== null,
    placeholderData: keepPreviousData,
  })
  const calendar = friendUserId ? friendCalendar : ownCalendar

  if ((!todayLocalDate && today.isPending) || (calendar.isPending && current !== null)) {
    return (
      <Card role="status" aria-label="加载中" className="flex flex-col gap-3">
        <Skeleton className="mx-auto h-6 w-32" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </Card>
    )
  }
  const err = (!todayLocalDate ? today.error : null) ?? calendar.error
  if (!resolvedToday || err) {
    return (
      <Card>
        <ErrorState
          size="compact"
          title="日历没加载出来"
          message={isApiError(err) ? errorMessage(err) : undefined}
          onRetry={() => {
            if (!todayLocalDate) void today.refetch()
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
        today={resolvedToday}
        month={current ?? undefined}
        onMonthChange={setMonth}
        marks={marks}
        footer={<CalendarLegend tone={module} />}
      />
    </Card>
  )
}
