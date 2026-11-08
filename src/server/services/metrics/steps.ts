import 'server-only'
import { and, asc, desc, eq, gte } from 'drizzle-orm'
import type { PutSteps, StepEntry, StepTrend } from '@/features/metric/schemas'
import type { LocalDate } from '@/features/shared/schemas'
import { addDays, localDateOf } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import type { db as Database, DbOrTx, Tx } from '@/server/db/client'
import { stepMetrics } from '@/server/db/schema'
import { loadClock } from '../checkins/clock'
import { isStepsInRange, stepSummary } from './rules'

const entryColumns = {
  localDate: stepMetrics.localDate,
  steps: stepMetrics.steps,
  measuredAt: stepMetrics.measuredAt,
}

function toEntry(row: { localDate: string; steps: number; measuredAt: Date }): StepEntry {
  return {
    localDate: row.localDate,
    steps: row.steps,
    measuredAt: row.measuredAt.toISOString(),
  }
}

/**
 * 写某个打卡日的步数，已有就覆盖（step_metrics 唯一 (userId, localDate)）。
 */
export async function upsertSteps(
  tx: Tx,
  userId: string,
  localDate: LocalDate,
  steps: number,
  measuredAt: Date,
): Promise<StepEntry> {
  if (!isStepsInRange(steps)) {
    throw new ApiError('VALIDATION_FAILED', '步数超出 0–200000 步', {
      fields: { steps: ['步数应在 0–200000 步之间'] },
    })
  }
  const [row] = await tx
    .insert(stepMetrics)
    .values({ userId, localDate, steps, measuredAt })
    .onConflictDoUpdate({
      target: [stepMetrics.userId, stepMetrics.localDate],
      set: { steps, measuredAt },
    })
    .returning(entryColumns)
  if (!row) throw new Error('upsertSteps：写入没有返回行')
  return toEntry(row)
}

/** PUT /metrics/steps：记今天的步数 */
export async function putSteps(
  db: typeof Database,
  userId: string,
  input: PutSteps,
  now: Date,
): Promise<StepEntry> {
  return db.transaction(async (tx) => {
    const clock = await loadClock(tx, userId)
    const today = localDateOf(now, clock.timeZone, clock.dayStartHour)
    return upsertSteps(tx, userId, today, input.steps, now)
  })
}

/** GET /metrics/steps?days=N：今天往前 N 天（含今天）的记录 + 今日步数（无记录恒为 0） */
export async function stepTrend(
  db: DbOrTx,
  userId: string,
  days: number,
  now: Date,
): Promise<StepTrend> {
  const clock = await loadClock(db, userId)
  const today = localDateOf(now, clock.timeZone, clock.dayStartHour)
  const windowStart = addDays(today, -(days - 1))
  const rows = await db
    .select(entryColumns)
    .from(stepMetrics)
    .where(
      and(eq(stepMetrics.userId, userId), gte(stepMetrics.localDate, addDays(windowStart, -8))),
    )
    .orderBy(asc(stepMetrics.localDate))
    .limit(400)
  const entries = rows.map(toEntry)
  if (entries.length === 0) {
    const [last] = await db
      .select(entryColumns)
      .from(stepMetrics)
      .where(eq(stepMetrics.userId, userId))
      .orderBy(desc(stepMetrics.localDate))
      .limit(1)
    return {
      todaySteps: 0,
      entries: [],
      latest: last ? toEntry(last) : null,
      deltaSteps7d: null,
    }
  }
  return stepSummary(entries, windowStart, today)
}
