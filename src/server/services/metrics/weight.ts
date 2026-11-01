import 'server-only'
import { and, asc, desc, eq, gte, lt } from 'drizzle-orm'
import type { PutWeight, WeightEntry, WeightTrend } from '@/features/metric/schemas'
import type { LocalDate } from '@/features/shared/schemas'
import { addDays, localDateOf } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import type { db as Database, DbOrTx, Tx } from '@/server/db/client'
import { bodyMetrics } from '@/server/db/schema'
import { loadClock } from '../checkins/clock'
import { isWeightInRange, needsWeightConfirm, weightSummary } from './rules'

export interface UpsertWeightOptions {
  /** 测量时刻（通常为 now） */
  measuredAt: Date
  /** true 跳过 3 kg 变化确认（PUT 带 confirmLargeChange，或引导首次记录） */
  confirmLargeChange: boolean
}

const entryColumns = {
  localDate: bodyMetrics.localDate,
  weightGrams: bodyMetrics.weightGrams,
  measuredAt: bodyMetrics.measuredAt,
}

function toEntry(row: { localDate: string; weightGrams: number; measuredAt: Date }): WeightEntry {
  return {
    localDate: row.localDate,
    weightGrams: row.weightGrams,
    measuredAt: row.measuredAt.toISOString(),
  }
}

/**
 * 写某个打卡日的体重，已有就覆盖（body_metrics 唯一 (userId, localDate)）。
 * 与上一条（早于 localDate 的最近一条）相差超过 3 kg 且未确认时
 * 抛 ApiError('WEIGHT_CHANGE_UNCONFIRMED', …, { previousWeightGrams })。
 * 签名 F1，实现 D3（PRD 2.5、7.2）；D1 引导在同一事务里调用。
 */
export async function upsertWeight(
  tx: Tx,
  userId: string,
  localDate: LocalDate,
  grams: number,
  opts: UpsertWeightOptions,
): Promise<WeightEntry> {
  if (!isWeightInRange(grams)) {
    throw new ApiError('VALIDATION_FAILED', '体重超出 20–300 kg', {
      fields: { weightGrams: ['体重应在 20–300 千克之间'] },
    })
  }
  if (!opts.confirmLargeChange) {
    const [previous] = await tx
      .select({ weightGrams: bodyMetrics.weightGrams })
      .from(bodyMetrics)
      .where(and(eq(bodyMetrics.userId, userId), lt(bodyMetrics.localDate, localDate)))
      .orderBy(desc(bodyMetrics.localDate))
      .limit(1)
    const prev = previous?.weightGrams ?? null
    if (prev !== null && needsWeightConfirm(prev, grams)) {
      throw new ApiError('WEIGHT_CHANGE_UNCONFIRMED', '与上一条相差超过 3 kg', {
        previousWeightGrams: prev,
      })
    }
  }
  const [row] = await tx
    .insert(bodyMetrics)
    .values({ userId, localDate, weightGrams: grams, measuredAt: opts.measuredAt })
    .onConflictDoUpdate({
      target: [bodyMetrics.userId, bodyMetrics.localDate],
      set: { weightGrams: grams, measuredAt: opts.measuredAt },
    })
    .returning(entryColumns)
  if (!row) throw new Error('upsertWeight：写入没有返回行')
  return toEntry(row)
}

/** PUT /metrics/weight：记今天的体重 */
export async function putWeight(
  db: typeof Database,
  userId: string,
  input: PutWeight,
  now: Date,
): Promise<WeightEntry> {
  return db.transaction(async (tx) => {
    const clock = await loadClock(tx, userId)
    const today = localDateOf(now, clock.timeZone, clock.dayStartHour)
    return upsertWeight(tx, userId, today, input.weightGrams, {
      measuredAt: now,
      confirmLargeChange: input.confirmLargeChange,
    })
  })
}

/** 最近一条体重（运动消耗估算用）；没有返回 null */
export async function latestWeightGrams(db: DbOrTx, userId: string): Promise<number | null> {
  const [row] = await db
    .select({ weightGrams: bodyMetrics.weightGrams })
    .from(bodyMetrics)
    .where(eq(bodyMetrics.userId, userId))
    .orderBy(desc(bodyMetrics.localDate))
    .limit(1)
  return row?.weightGrams ?? null
}

/** GET /metrics/weight?days=N：今天往前 N 天（含今天）的记录 + 最近一条 + 7 天差值 */
export async function weightTrend(
  db: DbOrTx,
  userId: string,
  days: number,
  now: Date,
): Promise<WeightTrend> {
  const clock = await loadClock(db, userId)
  const today = localDateOf(now, clock.timeZone, clock.dayStartHour)
  const windowStart = addDays(today, -(days - 1))
  // 多取 8 天，用来找"7 天前"的那条；窗口内全无记录时 latest 仍要显示最近一次
  const rows = await db
    .select(entryColumns)
    .from(bodyMetrics)
    .where(
      and(eq(bodyMetrics.userId, userId), gte(bodyMetrics.localDate, addDays(windowStart, -8))),
    )
    .orderBy(asc(bodyMetrics.localDate))
    .limit(400)
  const entries = rows.map(toEntry)
  if (entries.length === 0) {
    const [last] = await db
      .select(entryColumns)
      .from(bodyMetrics)
      .where(eq(bodyMetrics.userId, userId))
      .orderBy(desc(bodyMetrics.localDate))
      .limit(1)
    return { entries: [], latest: last ? toEntry(last) : null, deltaGrams7d: null }
  }
  return weightSummary(entries, windowStart)
}
