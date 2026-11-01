import 'server-only'
import { desc, eq } from 'drizzle-orm'
import type { AiRunList, QuotaView } from '@/features/quota/schemas'
import { db, type DbOrTx, type Tx } from '@/server/db/client'
import { aiDailySpend, aiRuns } from '@/server/db/schema'
import { getBalance } from '@/server/quota/ledger'
import { quotaPeriodEndsAt, spendDayKey } from '@/server/quota/period'
import { getSettings } from '@/server/settings'
import { toAiRunItem, toQuotaView } from './view'

/*
 * 我的额度与使用记录（PRD 2.7，GET /me/quota、GET /me/ai-runs）。实现：D6。
 */

export const AI_RUNS_LIMIT = 20

/** 本周额度视图。getBalance 会锁行并在跨周时先重置，所以放在事务里 */
export async function getQuotaView(userId: string, now: Date = new Date()): Promise<QuotaView> {
  return db.transaction((tx) => quotaViewIn(tx, userId, now))
}

/** 同一事务里读余额（兑换后直接返回最新额度） */
export async function quotaViewIn(tx: Tx, userId: string, now: Date): Promise<QuotaView> {
  const balance = await getBalance(tx, userId, now)
  const settings = await getSettings()
  const [daily] = await tx
    .select({ spent: aiDailySpend.spentMicros })
    .from(aiDailySpend)
    .where(eq(aiDailySpend.dayKey, spendDayKey(now)))
  const aiPaused = settings.aiPaused || (daily?.spent ?? 0) >= settings.dailySpendCapMicros
  return toQuotaView(balance, quotaPeriodEndsAt(now), aiPaused)
}

/** 最近 20 次 AI 调用：用途、状态、花费、时间（不含 tokens、耗时等内部信息） */
export async function listAiRuns(conn: DbOrTx, userId: string): Promise<AiRunList> {
  const rows = await conn
    .select({
      id: aiRuns.id,
      purpose: aiRuns.purpose,
      status: aiRuns.status,
      costMicros: aiRuns.costMicros,
      createdAt: aiRuns.createdAt,
    })
    .from(aiRuns)
    .where(eq(aiRuns.userId, userId))
    .orderBy(desc(aiRuns.createdAt))
    .limit(AI_RUNS_LIMIT)
  return { items: rows.map(toAiRunItem) }
}
