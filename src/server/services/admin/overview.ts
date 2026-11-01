import 'server-only'
import { and, count, eq, gte, inArray, isNotNull, lte, sql } from 'drizzle-orm'
import type { AdminOverview, AiSwitchResult } from '@/features/admin/schemas'
import { addDays } from '@/lib/time'
import type { DbOrTx, Tx } from '@/server/db/client'
import { aiDailySpend, aiRuns, profiles, redeemAttempts, user } from '@/server/db/schema'
import { spendDayKey } from '@/server/quota/period'
import { getSettings, updateSettings } from '@/server/settings'
import { writeAudit } from './audit'
import { ANOMALY_THRESHOLDS, detectAnomalies, fillSpendSeries, isCapReached } from './rules'

/*
 * 后台首页（PRD 2.12、7.3）：今日全站花费 / 上限、手动暂停开关、近 30 天曲线、异常列表。
 * 日期键一律北京时间（spendDayKey）。暂停只改 aiPaused；日上限暂停实时判断，不写配置。
 */

const SERIES_DAYS = 30
const DAY_MS = 86_400_000
/** 每类异常最多取多少行（判定在 rules.ts，这里只是少取行） */
const CANDIDATE_LIMIT = 50

async function todaySpent(db: DbOrTx, dayKey: string): Promise<number> {
  const [row] = await db
    .select({ spentMicros: aiDailySpend.spentMicros })
    .from(aiDailySpend)
    .where(eq(aiDailySpend.dayKey, dayKey))
    .limit(1)
  return row?.spentMicros ?? 0
}

/** 异常候选：SQL 只做聚合和粗筛，阈值判定交给 detectAnomalies */
async function anomalyCandidates(db: DbOrTx, dayKey: string, now: Date, redeemThreshold: number) {
  const since = new Date(now.getTime() - DAY_MS)

  const spendSum = sql<string>`sum(${aiRuns.costMicros})`
  const dailySpend = await db
    .select({ userId: aiRuns.userId, spentMicros: spendSum })
    .from(aiRuns)
    .where(and(eq(aiRuns.dayKey, dayKey), isNotNull(aiRuns.userId)))
    .groupBy(aiRuns.userId)
    .having(sql`${spendSum} > ${ANOMALY_THRESHOLDS.userDailySpendMicros}`)
    .limit(CANDIDATE_LIMIT)

  // 整点小时桶：按 epoch 秒整除，与会话时区无关
  const hourBucket = sql`floor(extract(epoch from ${aiRuns.createdAt}) / 3600)`
  const hourlyCalls = await db
    .select({ userId: aiRuns.userId, calls: count() })
    .from(aiRuns)
    .where(and(gte(aiRuns.createdAt, since), isNotNull(aiRuns.userId)))
    .groupBy(aiRuns.userId, hourBucket)
    .having(sql`count(*) > ${ANOMALY_THRESHOLDS.userHourlyCalls}`)
    .limit(CANDIDATE_LIMIT)

  const signupIps = await db
    .select({ ip: profiles.signupIp, accounts: count() })
    .from(profiles)
    .where(isNotNull(profiles.signupIp))
    .groupBy(profiles.signupIp)
    .having(sql`count(*) > ${ANOMALY_THRESHOLDS.accountsPerIp}`)
    .limit(CANDIDATE_LIMIT)

  const redeemFailures = await db
    .select({ userId: redeemAttempts.userId, failures: count() })
    .from(redeemAttempts)
    .where(
      and(
        eq(redeemAttempts.ok, false),
        gte(redeemAttempts.createdAt, since),
        isNotNull(redeemAttempts.userId),
      ),
    )
    .groupBy(redeemAttempts.userId)
    .having(sql`count(*) >= ${redeemThreshold}`)
    .limit(CANDIDATE_LIMIT)

  return {
    dailySpend: dailySpend.flatMap((r) =>
      r.userId ? [{ userId: r.userId, spentMicros: Number(r.spentMicros) }] : [],
    ),
    hourlyCalls: hourlyCalls.flatMap((r) =>
      r.userId ? [{ userId: r.userId, calls: Number(r.calls) }] : [],
    ),
    signupIps: signupIps.flatMap((r) => (r.ip ? [{ ip: r.ip, accounts: Number(r.accounts) }] : [])),
    redeemFailures: redeemFailures.flatMap((r) =>
      r.userId ? [{ userId: r.userId, failures: Number(r.failures) }] : [],
    ),
  }
}

/** userId → 昵称（没有时用邮箱） */
async function userLabels(db: DbOrTx, userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map()
  const rows = await db
    .select({ id: user.id, email: user.email, nickname: profiles.nickname })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(inArray(user.id, userIds))
  return new Map(rows.map((r) => [r.id, r.nickname ?? r.email]))
}

/** GET /admin/overview */
export async function getOverview(db: DbOrTx, now: Date): Promise<AdminOverview> {
  const dayKey = spendDayKey(now)
  const settings = await getSettings()
  const spent = await todaySpent(db, dayKey)

  const seriesRows = await db
    .select({ dayKey: aiDailySpend.dayKey, spentMicros: aiDailySpend.spentMicros })
    .from(aiDailySpend)
    .where(
      and(
        gte(aiDailySpend.dayKey, addDays(dayKey, -(SERIES_DAYS - 1))),
        lte(aiDailySpend.dayKey, dayKey),
      ),
    )
    .limit(SERIES_DAYS)

  const candidates = await anomalyCandidates(db, dayKey, now, settings.redeemFailLockThreshold)
  const ids = new Set<string>()
  for (const r of candidates.dailySpend) ids.add(r.userId)
  for (const r of candidates.hourlyCalls) ids.add(r.userId)
  for (const r of candidates.redeemFailures) ids.add(r.userId)
  const labels = await userLabels(db, [...ids])

  return {
    dayKey,
    todaySpentMicros: spent,
    dailySpendCapMicros: settings.dailySpendCapMicros,
    aiPaused: settings.aiPaused,
    capReached: isCapReached(spent, settings.dailySpendCapMicros),
    spendSeries: fillSpendSeries(seriesRows, dayKey, SERIES_DAYS),
    anomalies: detectAnomalies(candidates, {
      redeemFailThreshold: settings.redeemFailLockThreshold,
      labels,
      now,
    }),
  }
}

/**
 * 暂停 / 恢复全站 AI（PRD 7.3）。恢复只清 aiPaused：今天已达上限时 capReached 仍为 true，
 * 界面提示"先调高今日上限"。
 */
export async function setAiPaused(
  tx: Tx,
  adminId: string,
  paused: boolean,
  now: Date,
): Promise<AiSwitchResult> {
  const settings = await updateSettings(tx, { aiPaused: paused })
  const spent = await todaySpent(tx, spendDayKey(now))
  await writeAudit(tx, adminId, {
    action: paused ? 'ai.pause' : 'ai.resume',
    targetType: 'site',
    now,
  })
  return {
    aiPaused: settings.aiPaused,
    capReached: isCapReached(spent, settings.dailySpendCapMicros),
  }
}
