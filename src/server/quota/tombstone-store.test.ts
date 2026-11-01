import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { reconcileStaleRuns } from '@/server/ai/run'
import { db, type Tx } from '@/server/db/client'
import { aiRuns, quotaAccounts, quotaLedger, redeemAttempts, user } from '@/server/db/schema'
import { getBalance, openAccount, reserve } from './ledger'
import { quotaPeriodKey } from './period'
import { restoredOpening } from './tombstone'
import { claimTombstone, writeTombstone } from './tombstone-store'

try {
  process.loadEnvFile?.('.env.local')
} catch {
  // CI 无 .env.local，跳过真实 PG 集成块
}

const hasDb = Boolean(process.env.DATABASE_URL)

class RollbackTestTx extends Error {}

async function inRolledBackTx(fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await fn(tx)
      throw new RollbackTestTx()
    })
  } catch (error) {
    if (!(error instanceof RollbackTestTx)) throw error
  }
}

describe.runIf(hasDb)('PostgreSQL 集成验证：注销重注册拦截与 AI 卡死对账恢复', () => {
  it('注销后同邮箱重注册：沿用本周已用额度并重关联 24h 内风控记录', async () => {
    await inRolledBackTx(async (tx) => {
      const now = new Date('2026-11-01T08:00:00.000Z')
      const periodKey = quotaPeriodKey(now)
      const oldUserId = 'test_tombstone_old_u1'
      const newUserId = 'test_tombstone_new_u2'
      const email = 'tombstone-int-test@daydayon.local'

      await tx.insert(user).values({
        id: oldUserId,
        name: 'Old',
        email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      })
      await tx.insert(quotaAccounts).values({
        userId: oldUserId,
        periodKey,
        weeklyLimitMicros: 2_000_000,
        weeklyUsedMicros: 1_500_000,
        bonusMicros: 0,
        reservedMicros: 0,
        createdAt: now,
        updatedAt: now,
      })
      const [runRow] = await tx
        .insert(aiRuns)
        .values({
          userId: oldUserId,
          ip: '127.0.0.1',
          purpose: 'diet-recognition',
          promptVersion: 1,
          status: 'succeeded',
          costMicros: 7_000,
          dayKey: '2026-11-01',
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: aiRuns.id })
      const [attemptRow] = await tx
        .insert(redeemAttempts)
        .values({
          userId: oldUserId,
          ip: '127.0.0.1',
          ok: false,
          createdAt: now,
        })
        .returning({ id: redeemAttempts.id })

      await writeTombstone(tx, oldUserId, now)
      await tx.delete(user).where(eq(user.id, oldUserId))

      await tx.insert(user).values({
        id: newUserId,
        name: 'New',
        email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      })
      const snapshot = await claimTombstone(tx, newUserId, email, now)
      expect(snapshot).toEqual({
        periodKey,
        weeklyLimitMicros: 2_000_000,
        weeklyUsedMicros: 1_500_000,
      })

      const opening = restoredOpening(snapshot, periodKey, 2_000_000)
      const balance = await openAccount(tx, newUserId, opening.weeklyLimitMicros, now, opening)
      expect(balance.weeklyLimitMicros).toBe(2_000_000)
      expect(balance.weeklyUsedMicros).toBe(1_500_000)

      const [relinkedRun] = await tx
        .select({ userId: aiRuns.userId })
        .from(aiRuns)
        .where(eq(aiRuns.id, runRow.id))
      const [relinkedAttempt] = await tx
        .select({ userId: redeemAttempts.userId })
        .from(redeemAttempts)
        .where(eq(redeemAttempts.id, attemptRow.id))
      expect(relinkedRun?.userId).toBe(newUserId)
      expect(relinkedAttempt?.userId).toBe(newUserId)
    })
  })

  it('AI 结算失败留下的卡死 running 行：reconcileStaleRuns 按已记费用结算并退回多预占部分，重复执行幂等', async () => {
    await inRolledBackTx(async (tx) => {
      const createdAt = new Date('2026-11-01T08:00:00.000Z')
      const now = new Date(createdAt.getTime() + 6 * 60_000)
      const userId = 'test_reconcile_u1'

      await tx.insert(user).values({
        id: userId,
        name: 'Reconcile',
        email: 'reconcile-int-test@daydayon.local',
        emailVerified: true,
        createdAt,
        updatedAt: createdAt,
      })
      await openAccount(tx, userId, 2_000_000, createdAt)

      const [runRow] = await tx
        .insert(aiRuns)
        .values({
          userId,
          ip: '127.0.0.1',
          purpose: 'diet-recognition',
          promptVersion: 1,
          status: 'running',
          idempotencyKey: 'idem-stale-1',
          // 模拟 recordPendingUsage 已记下实际花费 4,000 微元，但结算事务失败
          costMicros: 4_000,
          inputMissTokens: 500,
          outputTokens: 100,
          latencyMs: 1200,
          dayKey: '2026-11-01',
          createdAt,
          updatedAt: createdAt,
        })
        .returning({ id: aiRuns.id })

      await reserve(
        tx,
        userId,
        10_000,
        { aiRunId: runRow.id, idempotencyKey: 'idem-stale-1' },
        createdAt,
      )

      await reconcileStaleRuns(tx, userId, now)

      const afterFirst = await getBalance(tx, userId, now)
      expect(afterFirst.reservedMicros).toBe(0)
      expect(afterFirst.weeklyUsedMicros).toBe(4_000)

      const [updatedRun] = await tx
        .select({ status: aiRuns.status, costMicros: aiRuns.costMicros })
        .from(aiRuns)
        .where(eq(aiRuns.id, runRow.id))
      expect(updatedRun).toEqual({ status: 'failed', costMicros: 4_000 })

      // 再次对账幂等，不会二次退款
      await reconcileStaleRuns(tx, userId, now)
      const afterSecond = await getBalance(tx, userId, now)
      expect(afterSecond.weeklyUsedMicros).toBe(4_000)

      const ledgerRows = await tx
        .select({ kind: quotaLedger.kind, amountMicros: quotaLedger.amountMicros })
        .from(quotaLedger)
        .where(eq(quotaLedger.aiRunId, runRow.id))
      expect(ledgerRows).toEqual([
        { kind: 'reserve', amountMicros: -10_000 },
        { kind: 'settle', amountMicros: 6_000 },
      ])
    })
  })
})
