import 'server-only'
import { and, asc, desc, eq, gte, lte } from 'drizzle-orm'
import type { LocalDate } from '@/features/shared/schemas'
import { addDays, localDateOf } from '@/lib/time'
import { db } from '@/server/db/client'
import { bodyMetrics, checkins, goals, profiles } from '@/server/db/schema'
import { checkinToday } from '@/server/services/checkins/read'
import { loadClock } from '@/server/services/checkins/clock'
import { weightTrend } from '@/server/services/metrics/weight'
import { listTodos } from '@/server/services/todos'

/*
 * Agent 读工具的数据来源。每个函数都是只读查询、带 userId 条件，返回可直接 JSON 序列化的结果。
 * 只给模型看必要字段，不返回整行（database.md 第 5 节）。
 */

export async function getProfile(userId: string) {
  const [row] = await db
    .select({
      nickname: profiles.nickname,
      gender: profiles.gender,
      birthYear: profiles.birthYear,
      heightCm: profiles.heightCm,
      mascot: profiles.mascot,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1)
  return row ?? null
}

const goalsColumns = {
  id: goals.id,
  module: goals.module,
  title: goals.title,
  targetKind: goals.targetKind,
  targetValue: goals.targetValue,
  weekdays: goals.weekdays,
  plannedTime: goals.plannedTime,
}

/** 进行中的目标（供模型选 goalId 打卡），按 sortOrder */
export async function listGoals(userId: string) {
  return db
    .select(goalsColumns)
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.status, 'active')))
    .orderBy(asc(goals.sortOrder), asc(goals.id))
    .limit(100)
}

/** 今天（含体重、心情、各目标进度、完成度） */
export async function getTodaySummary(userId: string, now: Date) {
  return checkinToday(db, userId, now)
}

/** 待办（进行中） */
export async function getOpenTodos(userId: string, now: Date) {
  return listTodos(db, userId, { status: 'open', limit: 50 }, now)
}

/** 最近 days 天体重 + 最近一条 + 7 天差值 */
export async function getWeight(userId: string, now: Date, days = 30) {
  return weightTrend(db, userId, days, now)
}

/** 某段打卡日（含两端）内的打卡记录，跨目标。from/to 缺省为最近 7 天 */
export async function listCheckinsInRange(
  userId: string,
  now: Date,
  range: { from?: LocalDate; to?: LocalDate },
) {
  const clock = await loadClock(db, userId)
  const today = localDateOf(now, clock.timeZone, clock.dayStartHour)
  const from = range.from ?? addDays(today, -6)
  const to = range.to ?? today
  return db
    .select({
      goalId: checkins.goalId,
      module: checkins.module,
      localDate: checkins.localDate,
      durationSeconds: checkins.durationSeconds,
      count: checkins.count,
      intakeKcal: checkins.intakeKcal,
      note: checkins.note,
    })
    .from(checkins)
    .where(
      and(eq(checkins.userId, userId), gte(checkins.localDate, from), lte(checkins.localDate, to)),
    )
    .orderBy(asc(checkins.localDate))
    .limit(2000)
}

/** 最近的体重记录（运动消耗估算用） */
export async function latestWeight(userId: string) {
  const [row] = await db
    .select({ weightGrams: bodyMetrics.weightGrams, localDate: bodyMetrics.localDate })
    .from(bodyMetrics)
    .where(eq(bodyMetrics.userId, userId))
    .orderBy(desc(bodyMetrics.localDate))
    .limit(1)
  return row ?? null
}
