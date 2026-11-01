import 'server-only'
import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import type { DashboardToday } from '@/features/dashboard/schemas'
import type { WeightEntry } from '@/features/metric/schemas'
import type { LocalDate } from '@/features/shared/schemas'
import { addDays, localDateOf, localTimeOf, weekDates } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import type { DbOrTx } from '@/server/db/client'
import {
  bodyMetrics,
  checkins,
  dailyRatings,
  goals,
  goalTargets,
  profiles,
} from '@/server/db/schema'
import { getRankFeed } from '@/server/services/rank'
import { loadStreak } from '@/server/services/rank/streaks'
import type { TargetVersion } from '@/server/services/stats'
import {
  buildHeatmap,
  buildReminder,
  buildToday,
  buildWeightTrend,
  indexCheckins,
  weightReferenceDate,
  type DashboardGoal,
  type GoalCheckin,
} from './compute'

/*
 * GET /dashboard/today（PRD 2.8、7.1、7.2）：一次取齐主页全部数据。读操作，接收 db 或 tx。
 * 每条查询都带 userId 条件；榜单动态是公开数据，只含昵称、头像、板块和时间。
 */

/** 进行中目标上限 20（GOAL_ACTIVE_LIMIT）；查询留余量 */
const GOALS_LIMIT = 100
const WEIGHT_DAYS = 30

/** payload.mealType：饮食计次用（stats.goalDayProgress）；其余板块为 null */
function mealTypeOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const v = (payload as { mealType?: unknown }).mealType
  return typeof v === 'string' ? v : null
}

function weightDto(r: { localDate: string; weightGrams: number; measuredAt: Date }): WeightEntry {
  return {
    localDate: r.localDate,
    weightGrams: r.weightGrams,
    measuredAt: r.measuredAt.toISOString(),
  }
}

interface ProfileZone {
  timeZone: string
  dayStartHour: number
}

async function loadGoals(db: DbOrTx, userId: string, zone: ProfileZone): Promise<DashboardGoal[]> {
  const rows = await db
    .select({
      id: goals.id,
      module: goals.module,
      title: goals.title,
      sortOrder: goals.sortOrder,
      targetKind: goals.targetKind,
      targetValue: goals.targetValue,
      weekdays: goals.weekdays,
      createdAt: goals.createdAt,
    })
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.status, 'active')))
    .orderBy(asc(goals.sortOrder), asc(goals.id))
    .limit(GOALS_LIMIT)
  if (rows.length === 0) return []

  // goal_targets 没有 userId 列：goalId 来自上面按 userId 过滤过的目标
  const history = await db
    .select({
      goalId: goalTargets.goalId,
      effectiveFrom: goalTargets.effectiveFrom,
      targetKind: goalTargets.targetKind,
      targetValue: goalTargets.targetValue,
      weekdays: goalTargets.weekdays,
    })
    .from(goalTargets)
    .where(
      inArray(
        goalTargets.goalId,
        rows.map((r) => r.id),
      ),
    )
    .limit(rows.length * 400)

  const byGoal = new Map<string, TargetVersion[]>()
  for (const h of history) {
    const v: TargetVersion = {
      effectiveFrom: h.effectiveFrom,
      kind: h.targetKind,
      value: h.targetValue,
      weekdays: h.weekdays,
    }
    const list = byGoal.get(h.goalId)
    if (list) list.push(v)
    else byGoal.set(h.goalId, [v])
  }

  return rows.map((r) => ({
    id: r.id,
    module: r.module,
    title: r.title,
    sortOrder: r.sortOrder,
    // 正常情况下每个目标至少有一行 goal_targets；缺失时用 goals 上的冗余副本兜底（从建目标那天起生效）
    history: byGoal.get(r.id) ?? [
      {
        effectiveFrom: localDateOf(r.createdAt, zone.timeZone, zone.dayStartHour),
        kind: r.targetKind,
        value: r.targetValue,
        weekdays: r.weekdays,
      },
    ],
  }))
}

async function loadWeekCheckins(
  db: DbOrTx,
  userId: string,
  goalIds: readonly string[],
  from: LocalDate,
  to: LocalDate,
): Promise<GoalCheckin[]> {
  if (goalIds.length === 0) return []
  const rows = await db
    .select({
      goalId: checkins.goalId,
      localDate: checkins.localDate,
      isMakeup: checkins.isMakeup,
      durationSeconds: checkins.durationSeconds,
      count: checkins.count,
      payload: checkins.payload,
      occurredAt: checkins.occurredAt,
    })
    .from(checkins)
    .where(
      and(
        eq(checkins.userId, userId),
        inArray(checkins.goalId, [...goalIds]),
        gte(checkins.localDate, from),
        lte(checkins.localDate, to),
      ),
    )
    // 一周的打卡：20 个目标 × 7 天，每天几条，留足余量
    .limit(5000)
  return rows.map((r) => ({
    goalId: r.goalId,
    localDate: r.localDate,
    isMakeup: r.isMakeup,
    durationSeconds: r.durationSeconds,
    count: r.count,
    mealType: mealTypeOf(r.payload),
    occurredAt: r.occurredAt.toISOString(),
  }))
}

async function loadWeight(db: DbOrTx, userId: string, today: LocalDate) {
  const columns = {
    localDate: bodyMetrics.localDate,
    weightGrams: bodyMetrics.weightGrams,
    measuredAt: bodyMetrics.measuredAt,
  }
  const recent = await db
    .select(columns)
    .from(bodyMetrics)
    .where(
      and(
        eq(bodyMetrics.userId, userId),
        gte(bodyMetrics.localDate, addDays(today, -(WEIGHT_DAYS - 1))),
        lte(bodyMetrics.localDate, today),
      ),
    )
    .orderBy(asc(bodyMetrics.localDate))
    .limit(WEIGHT_DAYS)

  // 最近一次可能早于 30 天
  const [latestRow] =
    recent.length > 0
      ? recent.slice(-1)
      : await db
          .select(columns)
          .from(bodyMetrics)
          .where(and(eq(bodyMetrics.userId, userId), lte(bodyMetrics.localDate, today)))
          .orderBy(desc(bodyMetrics.localDate))
          .limit(1)
  const latest = latestRow ? weightDto(latestRow) : null

  let reference: WeightEntry | null = null
  if (latest) {
    const [ref] = await db
      .select(columns)
      .from(bodyMetrics)
      .where(
        and(
          eq(bodyMetrics.userId, userId),
          lte(bodyMetrics.localDate, weightReferenceDate(latest.localDate)),
        ),
      )
      .orderBy(desc(bodyMetrics.localDate))
      .limit(1)
    reference = ref ? weightDto(ref) : null
  }
  return buildWeightTrend(recent.map(weightDto), latest, reference)
}

async function loadMood(db: DbOrTx, userId: string, today: LocalDate): Promise<number | null> {
  const [row] = await db
    .select({ value: dailyRatings.value })
    .from(dailyRatings)
    .where(
      and(
        eq(dailyRatings.userId, userId),
        eq(dailyRatings.localDate, today),
        eq(dailyRatings.scope, 'overall'),
      ),
    )
    .limit(1)
  return row?.value ?? null
}

export async function getDashboardToday(
  db: DbOrTx,
  userId: string,
  now: Date,
): Promise<DashboardToday> {
  const [profile] = await db
    .select({
      timeZone: profiles.timeZone,
      dayStartHour: profiles.dayStartHour,
      remindAt: profiles.remindAt,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1)
  // requireOnboarded 已保证 profile 行存在
  if (!profile) throw new ApiError('USER_NOT_FOUND', '找不到用户资料')

  const today = localDateOf(now, profile.timeZone, profile.dayStartHour)
  const days = weekDates(today)
  const monday = days[0] ?? today

  const userGoals = await loadGoals(db, userId, profile)
  const [weekRows, weight, mood, streak, feed] = await Promise.all([
    loadWeekCheckins(
      db,
      userId,
      userGoals.map((g) => g.id),
      monday,
      today,
    ),
    loadWeight(db, userId, today),
    loadMood(db, userId, today),
    loadStreak(db, userId, today),
    getRankFeed(db, now),
  ])

  const index = indexCheckins(weekRows)
  const todaySection = buildToday(userGoals, index, today)
  return {
    localDate: today,
    completion: todaySection.completion,
    streak,
    hasGoals: userGoals.length > 0,
    goals: todaySection.goals,
    weight,
    mood,
    heatmap: buildHeatmap(userGoals, index, days, today),
    feed: feed.items,
    reminder: buildReminder(
      profile.remindAt,
      localTimeOf(now, profile.timeZone),
      profile.dayStartHour,
      todaySection.completion,
    ),
  }
}
