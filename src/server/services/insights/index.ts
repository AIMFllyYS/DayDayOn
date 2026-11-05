import 'server-only'
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm'
import type { InsightDays, Insights } from '@/features/insights/schemas'
import { localDateOf } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import type { DbOrTx } from '@/server/db/client'
import { checkins, goals, profiles } from '@/server/db/schema'
import { computeGoalInsight, insightRange, type InsightRow } from './compute'

/*
 * GET /insights：每个进行中目标最近 7 / 30 天的近况。读操作，每条查询都带 userId 条件。
 * 主页「各板块近况」、目标详情和 Agent 的 showStats 工具都调这里，口径只有一份。
 */

const GOALS_LIMIT = 100
// 30 天 × 20 个目标 × 每天几条，留足余量
const ROWS_LIMIT = 6000

export async function getInsights(
  db: DbOrTx,
  userId: string,
  now: Date,
  options: { days: InsightDays; goalId?: string },
): Promise<Insights> {
  const [profile] = await db
    .select({ timeZone: profiles.timeZone, dayStartHour: profiles.dayStartHour })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1)
  if (!profile) throw new ApiError('USER_NOT_FOUND', '找不到用户资料')
  const today = localDateOf(now, profile.timeZone, profile.dayStartHour)

  const goalRows = await db
    .select({
      id: goals.id,
      module: goals.module,
      title: goals.title,
      refereeRules: goals.refereeRules,
      deadlineDate: goals.deadlineDate,
    })
    .from(goals)
    .where(
      and(
        eq(goals.userId, userId),
        eq(goals.status, 'active'),
        options.goalId ? eq(goals.id, options.goalId) : undefined,
      ),
    )
    .orderBy(asc(goals.sortOrder), asc(goals.id))
    .limit(GOALS_LIMIT)
  if (options.goalId && goalRows.length === 0) {
    throw new ApiError('GOAL_NOT_FOUND', '目标不存在')
  }

  const { from, to } = insightRange(today, options.days)
  const rows =
    goalRows.length === 0
      ? []
      : await db
          .select({
            goalId: checkins.goalId,
            localDate: checkins.localDate,
            isValid: checkins.isValid,
            score: checkins.score,
            durationSeconds: checkins.durationSeconds,
            intakeKcal: checkins.intakeKcal,
            burnKcal: checkins.burnKcal,
            payload: checkins.payload,
            verdict: checkins.verdict,
          })
          .from(checkins)
          .where(
            and(
              eq(checkins.userId, userId),
              inArray(
                checkins.goalId,
                goalRows.map((g) => g.id),
              ),
              gte(checkins.localDate, from),
              lte(checkins.localDate, to),
            ),
          )
          .limit(ROWS_LIMIT)

  const byGoal = new Map<string, InsightRow[]>()
  for (const r of rows) {
    const list = byGoal.get(r.goalId)
    const row: InsightRow = { ...r, verdict: r.verdict ?? null }
    if (list) list.push(row)
    else byGoal.set(r.goalId, [row])
  }

  return {
    localDate: today,
    days: options.days,
    items: goalRows.map((g) =>
      computeGoalInsight({
        goal: { ...g, deadlineDate: g.deadlineDate ?? null },
        rows: byGoal.get(g.id) ?? [],
        today,
        days: options.days,
        timeZone: profile.timeZone,
      }),
    ),
  }
}
