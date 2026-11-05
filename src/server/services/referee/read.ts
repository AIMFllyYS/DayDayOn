import 'server-only'
import { and, desc, eq, gte } from 'drizzle-orm'
import type { LocalDate } from '@/features/shared/schemas'
import { addDays, localTimeOf } from '@/lib/time'
import { bedtimeAxis } from '@/features/referee/rules/sleep'
import type { DbOrTx } from '@/server/db/client'
import { checkins } from '@/server/db/schema'

/*
 * 裁判工具要读的数据（checkin-modules.md 第 4 节）。只读当前用户、当前目标，结果给模型看，保持精简。
 */

/** 最近几晚的睡眠：入睡本地时刻 + 时长，以及入睡时刻的平均偏差（规律度） */
export async function recentSleep(
  db: DbOrTx,
  userId: string,
  goalId: string,
  today: LocalDate,
  timeZone: string,
) {
  const rows = await db
    .select({
      localDate: checkins.localDate,
      payload: checkins.payload,
      seconds: checkins.durationSeconds,
    })
    .from(checkins)
    .where(
      and(
        eq(checkins.userId, userId),
        eq(checkins.goalId, goalId),
        gte(checkins.localDate, addDays(today, -7)),
      ),
    )
    .orderBy(desc(checkins.localDate))
    .limit(14)
  const nights = rows.flatMap((r) =>
    r.payload.module === 'sleep'
      ? [
          {
            localDate: r.localDate,
            bedLocal: localTimeOf(r.payload.bedAt, timeZone),
            hours: Math.round(((r.seconds ?? 0) / 3600) * 10) / 10,
          },
        ]
      : [],
  )
  const axes = nights.flatMap((n) => {
    const a = bedtimeAxis(n.bedLocal)
    return a === null ? [] : [a]
  })
  const mean = axes.length > 0 ? axes.reduce((s, a) => s + a, 0) / axes.length : null
  const regularityMinutes =
    mean === null || axes.length < 2
      ? null
      : Math.round(axes.reduce((s, a) => s + Math.abs(a - mean), 0) / axes.length)
  return { nights, regularityMinutes }
}

/** 今天这个目标已经记过的学习分钟（碎片累加） */
export async function todayStudyMinutes(
  db: DbOrTx,
  userId: string,
  goalId: string,
  today: LocalDate,
): Promise<number> {
  const rows = await db
    .select({ seconds: checkins.durationSeconds })
    .from(checkins)
    .where(
      and(eq(checkins.userId, userId), eq(checkins.goalId, goalId), eq(checkins.localDate, today)),
    )
    .limit(50)
  return Math.round(rows.reduce((s, r) => s + (r.seconds ?? 0), 0) / 60)
}

/** 这个目标最近的记录：日期、是否达标、一句话结论 */
export async function recentGoalCheckins(db: DbOrTx, userId: string, goalId: string) {
  const rows = await db
    .select({
      localDate: checkins.localDate,
      isValid: checkins.isValid,
      payload: checkins.payload,
      verdict: checkins.verdict,
    })
    .from(checkins)
    .where(and(eq(checkins.userId, userId), eq(checkins.goalId, goalId)))
    .orderBy(desc(checkins.localDate))
    .limit(7)
  return rows.map((r) => ({
    localDate: r.localDate,
    isValid: r.isValid,
    values: r.payload.module === 'custom' ? r.payload.values : null,
    detail: r.verdict?.detail ?? null,
  }))
}
