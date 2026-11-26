import 'server-only'
import { and, asc, desc, eq, gte, lt } from 'drizzle-orm'
import type {
  MetricCalendar,
  MetricHistory,
  MetricHistoryItem,
  MetricHistoryQuery,
  MetricKind,
} from '@/features/metric/schemas'
import type { DbOrTx } from '@/server/db/client'
import { bodyMetrics, dailyRatings, stepMetrics } from '@/server/db/schema'
import { monthBounds } from '../checkins/rules'

/*
 * 体重 / 心情 / 步数三类每日指标的统一分页历史与月度日历查询。
 * 三张表均按 (userId, localDate) 唯一（daily_ratings 取 scope = 'overall'），
 * 因此 localDate 本身就是严格递增/递减的无冲突游标。
 */

/** GET /metrics/{kind}/history：按日期倒序游标分页 */
export async function listMetricHistory(
  db: DbOrTx,
  userId: string,
  kind: MetricKind,
  query: MetricHistoryQuery,
): Promise<MetricHistory> {
  const limit = query.limit
  if (kind === 'weight') {
    const rows = await db
      .select({
        localDate: bodyMetrics.localDate,
        value: bodyMetrics.weightGrams,
        measuredAt: bodyMetrics.measuredAt,
      })
      .from(bodyMetrics)
      .where(
        and(
          eq(bodyMetrics.userId, userId),
          query.cursor === undefined ? undefined : lt(bodyMetrics.localDate, query.cursor),
        ),
      )
      .orderBy(desc(bodyMetrics.localDate))
      .limit(limit + 1)
    return buildHistoryPage('weight', rows, limit)
  }

  if (kind === 'mood') {
    const rows = await db
      .select({
        localDate: dailyRatings.localDate,
        value: dailyRatings.value,
      })
      .from(dailyRatings)
      .where(
        and(
          eq(dailyRatings.userId, userId),
          eq(dailyRatings.scope, 'overall'),
          query.cursor === undefined ? undefined : lt(dailyRatings.localDate, query.cursor),
        ),
      )
      .orderBy(desc(dailyRatings.localDate))
      .limit(limit + 1)
    return buildHistoryPage(
      'mood',
      rows.map((r) => ({ ...r, measuredAt: null })),
      limit,
    )
  }

  const rows = await db
    .select({
      localDate: stepMetrics.localDate,
      value: stepMetrics.steps,
      measuredAt: stepMetrics.measuredAt,
    })
    .from(stepMetrics)
    .where(
      and(
        eq(stepMetrics.userId, userId),
        query.cursor === undefined ? undefined : lt(stepMetrics.localDate, query.cursor),
      ),
    )
    .orderBy(desc(stepMetrics.localDate))
    .limit(limit + 1)
  return buildHistoryPage('steps', rows, limit)
}

function buildHistoryPage(
  kind: MetricKind,
  rows: readonly { localDate: string; value: number; measuredAt: Date | null }[],
  limit: number,
): MetricHistory {
  const page = rows.slice(0, limit)
  const items: MetricHistoryItem[] = page.map((r) => ({
    kind,
    localDate: r.localDate,
    value: r.value,
    measuredAt: r.measuredAt ? r.measuredAt.toISOString() : null,
  }))
  const last = page.at(-1)
  return {
    items,
    nextCursor: rows.length > limit && last ? last.localDate : null,
  }
}

/** GET /metrics/{kind}/calendar?month=YYYY-MM：按日期升序返回当月已记录日期与数值 */
export async function metricCalendar(
  db: DbOrTx,
  userId: string,
  kind: MetricKind,
  month: string,
): Promise<MetricCalendar> {
  const { from, until } = monthBounds(month)
  if (kind === 'weight') {
    const days = await db
      .select({ localDate: bodyMetrics.localDate, value: bodyMetrics.weightGrams })
      .from(bodyMetrics)
      .where(
        and(
          eq(bodyMetrics.userId, userId),
          gte(bodyMetrics.localDate, from),
          lt(bodyMetrics.localDate, until),
        ),
      )
      .orderBy(asc(bodyMetrics.localDate))
      .limit(40)
    return { kind, month, days }
  }

  if (kind === 'mood') {
    const days = await db
      .select({ localDate: dailyRatings.localDate, value: dailyRatings.value })
      .from(dailyRatings)
      .where(
        and(
          eq(dailyRatings.userId, userId),
          eq(dailyRatings.scope, 'overall'),
          gte(dailyRatings.localDate, from),
          lt(dailyRatings.localDate, until),
        ),
      )
      .orderBy(asc(dailyRatings.localDate))
      .limit(40)
    return { kind, month, days }
  }

  const days = await db
    .select({ localDate: stepMetrics.localDate, value: stepMetrics.steps })
    .from(stepMetrics)
    .where(
      and(
        eq(stepMetrics.userId, userId),
        gte(stepMetrics.localDate, from),
        lt(stepMetrics.localDate, until),
      ),
    )
    .orderBy(asc(stepMetrics.localDate))
    .limit(40)
  return { kind, month, days }
}
