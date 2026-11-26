import 'server-only'
import { and, asc, eq, gte, lte } from 'drizzle-orm'
import type { MetricOrigin, PutRating, Rating, RatingTrend } from '@/features/metric/schemas'
import type { LocalDate, RatingScope } from '@/features/shared/schemas'
import { addDays, localDateOf } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import type { DbOrTx } from '@/server/db/client'
import { dailyRatings } from '@/server/db/schema'
import { loadClock } from '../checkins/clock'
import { assertMetricDeleteAllowed, ratingSummary, resolveMetricTargetDate } from './rules'

/**
 * PUT /ratings（PRD 2.5、7.2）：支持记录或覆盖今天/昨天的评分；
 * 同一天同一 scope 再评就覆盖。scope = overall（今日心情）或板块。
 */
export async function putRating(
  db: DbOrTx,
  userId: string,
  input: PutRating,
  now: Date,
): Promise<Rating> {
  const clock = await loadClock(db, userId)
  const { localDate } = resolveMetricTargetDate(clock, now, input.localDate)
  const [row] = await db
    .insert(dailyRatings)
    .values({ userId, localDate, scope: input.scope, value: input.value })
    .onConflictDoUpdate({
      target: [dailyRatings.userId, dailyRatings.localDate, dailyRatings.scope],
      set: { value: input.value },
    })
    .returning({
      localDate: dailyRatings.localDate,
      scope: dailyRatings.scope,
      value: dailyRatings.value,
    })
  if (!row) throw new Error('putRating：写入没有返回行')
  return row
}

/** DELETE /ratings/{localDate}?scope=overall：删除指定日期评分（origin=agent 时限制今日/昨日） */
export async function deleteRating(
  db: DbOrTx,
  userId: string,
  localDate: LocalDate,
  scope: RatingScope,
  origin: MetricOrigin,
  now: Date,
): Promise<void> {
  const clock = await loadClock(db, userId)
  assertMetricDeleteAllowed(clock, now, localDate, origin)
  const deleted = await db
    .delete(dailyRatings)
    .where(
      and(
        eq(dailyRatings.userId, userId),
        eq(dailyRatings.localDate, localDate),
        eq(dailyRatings.scope, scope),
      ),
    )
    .returning({ id: dailyRatings.id })
  if (deleted.length === 0) {
    throw new ApiError('NOT_FOUND', '该日期没有心情记录')
  }
}

/**
 * GET /ratings?scope=overall&days=365（Issue #104）：
 * 按用户时区和日切换时间查询今天往前 N 天（含今天）的历史评分走势，升序返回。
 */
export async function ratingTrend(
  db: DbOrTx,
  userId: string,
  scope: RatingScope,
  days: number,
  now: Date,
): Promise<RatingTrend> {
  const clock = await loadClock(db, userId)
  const today = localDateOf(now, clock.timeZone, clock.dayStartHour)
  const windowStart = addDays(today, -(days - 1))
  const rows = await db
    .select({
      localDate: dailyRatings.localDate,
      value: dailyRatings.value,
    })
    .from(dailyRatings)
    .where(
      and(
        eq(dailyRatings.userId, userId),
        eq(dailyRatings.scope, scope),
        gte(dailyRatings.localDate, windowStart),
        lte(dailyRatings.localDate, today),
      ),
    )
    .orderBy(asc(dailyRatings.localDate))
    .limit(400)
  return ratingSummary(scope, rows)
}
