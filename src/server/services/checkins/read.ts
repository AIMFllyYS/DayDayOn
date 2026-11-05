import 'server-only'
import { and, desc, eq, gte, inArray, lt, lte, or } from 'drizzle-orm'
import type {
  CheckinCalendar,
  CheckinHistory,
  CheckinHistoryQuery,
  CheckinToday,
  TodayGoal,
} from '@/features/checkin/schemas'
import type { RatingValueSchema } from '@/features/shared/schemas'
import { localDateOf } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import type { DbOrTx } from '@/server/db/client'
import { bodyMetrics, checkins, dailyRatings } from '@/server/db/schema'
import { dayCompletion, goalDayProgress, isPlannedOn } from '@/server/services/stats'
import type * as z from 'zod'
import { loadClock } from './clock'
import {
  checkinColumns,
  loadActiveGoals,
  loadGoal,
  loadTargetHistory,
  targetFor,
  toCheckinDto,
} from './goal'
import { calendarDays, decodeCursor, encodeCursor, monthBounds, toStatCheckin } from './rules'

const statColumns = {
  goalId: checkins.goalId,
  localDate: checkins.localDate,
  isMakeup: checkins.isMakeup,
  durationSeconds: checkins.durationSeconds,
  count: checkins.count,
  payload: checkins.payload,
  occurredAt: checkins.occurredAt,
  isValid: checkins.isValid,
}

/** GET /goals/{goalId}/checkins：按打卡日、id 倒序的游标分页 */
export async function listCheckins(
  db: DbOrTx,
  userId: string,
  goalId: string,
  query: CheckinHistoryQuery,
): Promise<CheckinHistory> {
  await loadGoal(db, userId, goalId)
  const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor)
  if (query.cursor !== undefined && cursor === null) {
    throw new ApiError('VALIDATION_FAILED', '游标无效', { fields: { cursor: ['游标无效'] } })
  }
  const rows = await db
    .select(checkinColumns)
    .from(checkins)
    .where(
      and(
        eq(checkins.userId, userId),
        eq(checkins.goalId, goalId),
        query.from === undefined ? undefined : gte(checkins.localDate, query.from),
        query.to === undefined ? undefined : lte(checkins.localDate, query.to),
        cursor === null
          ? undefined
          : or(
              lt(checkins.localDate, cursor.localDate),
              and(eq(checkins.localDate, cursor.localDate), lt(checkins.id, cursor.id)),
            ),
      ),
    )
    .orderBy(desc(checkins.localDate), desc(checkins.id))
    .limit(query.limit + 1)
  const page = rows.slice(0, query.limit)
  const last = page.at(-1)
  return {
    items: page.map(toCheckinDto),
    nextCursor:
      rows.length > query.limit && last
        ? encodeCursor({ localDate: last.localDate, id: last.id })
        : null,
  }
}

/** GET /goals/{goalId}/calendar?month=YYYY-MM */
export async function goalCalendar(
  db: DbOrTx,
  userId: string,
  goalId: string,
  month: string,
): Promise<CheckinCalendar> {
  const goal = await loadGoal(db, userId, goalId)
  const { from, until } = monthBounds(month)
  const [rows, history] = await Promise.all([
    db
      .select(statColumns)
      .from(checkins)
      .where(
        and(
          eq(checkins.userId, userId),
          eq(checkins.goalId, goalId),
          gte(checkins.localDate, from),
          lt(checkins.localDate, until),
        ),
      )
      .limit(5000),
    loadTargetHistory(db, [goalId]),
  ])
  const versions = history.get(goalId)
  return {
    month,
    days: calendarDays(rows.map(toStatCheckin), goal.module, (d) => targetFor(goal, versions, d)),
  }
}

type RatingValue = z.infer<typeof RatingValueSchema>

/** GET /checkins/today：打卡弹层（PRD 2.4、7.2） */
export async function checkinToday(db: DbOrTx, userId: string, now: Date): Promise<CheckinToday> {
  const clock = await loadClock(db, userId)
  const today = localDateOf(now, clock.timeZone, clock.dayStartHour)
  const goals = await loadActiveGoals(db, userId)
  const ids = goals.map((g) => g.id)
  const [rows, history, weight, mood] = await Promise.all([
    ids.length === 0
      ? Promise.resolve([])
      : db
          .select(statColumns)
          .from(checkins)
          .where(
            and(
              eq(checkins.userId, userId),
              eq(checkins.localDate, today),
              inArray(checkins.goalId, ids),
            ),
          )
          .limit(2000),
    loadTargetHistory(db, ids),
    db
      .select({ weightGrams: bodyMetrics.weightGrams })
      .from(bodyMetrics)
      .where(and(eq(bodyMetrics.userId, userId), eq(bodyMetrics.localDate, today)))
      .limit(1),
    db
      .select({ value: dailyRatings.value })
      .from(dailyRatings)
      .where(
        and(
          eq(dailyRatings.userId, userId),
          eq(dailyRatings.localDate, today),
          eq(dailyRatings.scope, 'overall'),
        ),
      )
      .limit(1),
  ])

  const all: TodayGoal[] = goals.map((g) => {
    const target = targetFor(g, history.get(g.id), today)
    const ofGoal = rows.filter((r) => r.goalId === g.id).map(toStatCheckin)
    return {
      goalId: g.id,
      module: g.module,
      title: g.title,
      target: { kind: target.kind, value: target.value },
      planned: isPlannedOn(target, today),
      progress: goalDayProgress(target, g.module, ofGoal),
      sortOrder: g.sortOrder,
    }
  })
  const diet = goals.find((g) => g.module === 'diet')
  return {
    localDate: today,
    // 弹层的行 = 今天计划内的进行中目标（PRD 7.2）
    goals: all.filter((g) => g.planned),
    completion: dayCompletion(all),
    weightGrams: weight[0]?.weightGrams ?? null,
    mood: (mood[0]?.value as RatingValue | undefined) ?? null,
    // goals 已按 sortOrder 排序，第一个饮食目标就是 sortOrder 最小的
    dietPhotoGoalId: diet?.id ?? null,
  }
}
