import 'server-only'
import { and, eq, gte, inArray, isNull, lt } from 'drizzle-orm'
import { hmacSha256Hex } from '@/server/crypto'
import type { Tx } from '@/server/db/client'
import { accountTombstones, aiRuns, quotaAccounts, redeemAttempts, user } from '@/server/db/schema'
import { env } from '@/server/env'
import {
  type QuotaSnapshot,
  TOMBSTONE_MAX_REFS,
  TOMBSTONE_REF_WINDOW_MS,
  TOMBSTONE_TTL_MS,
  tombstoneExpired,
} from './tombstone'
import { quotaPeriodKey } from './period'

/*
 * 注销记录的存取（规则见 tombstone.ts）。注销时 writeTombstone，注册时 claimTombstone。
 */

/** 规范化邮箱的 HMAC 摘要。登录前 hooks.before 已规范化（小写、去空格），这里再兜一次 */
async function emailHash(email: string): Promise<string> {
  return hmacSha256Hex(env.BETTER_AUTH_SECRET, `tombstone:${email.trim().toLowerCase()}`)
}

/** 注销前调用（同一事务、删 user 行之前）：留下本周额度快照和最近的风控行 */
export async function writeTombstone(tx: Tx, userId: string, now: Date): Promise<void> {
  const [row] = await tx
    .select({
      email: user.email,
      periodKey: quotaAccounts.periodKey,
      weeklyLimitMicros: quotaAccounts.weeklyLimitMicros,
      weeklyUsedMicros: quotaAccounts.weeklyUsedMicros,
    })
    .from(user)
    .leftJoin(quotaAccounts, eq(quotaAccounts.userId, user.id))
    .where(eq(user.id, userId))
    .limit(1)
  if (!row) return

  const since = new Date(now.getTime() - TOMBSTONE_REF_WINDOW_MS)
  const runs = await tx
    .select({ id: aiRuns.id })
    .from(aiRuns)
    .where(and(eq(aiRuns.userId, userId), gte(aiRuns.createdAt, since)))
    .limit(TOMBSTONE_MAX_REFS)
  const attempts = await tx
    .select({ id: redeemAttempts.id })
    .from(redeemAttempts)
    .where(and(eq(redeemAttempts.userId, userId), gte(redeemAttempts.createdAt, since)))
    .limit(TOMBSTONE_MAX_REFS)

  // 顺手清掉过期的记录：表一直很小
  await tx
    .delete(accountTombstones)
    .where(lt(accountTombstones.deletedAt, new Date(now.getTime() - TOMBSTONE_TTL_MS)))

  const values = {
    emailHash: await emailHash(row.email),
    // 没有额度行（注册钩子失败的老账号）：记一个用光的空额度，重新注册不会多拿
    periodKey: row.periodKey ?? quotaPeriodKey(now),
    weeklyLimitMicros: row.weeklyLimitMicros ?? 0,
    weeklyUsedMicros: row.weeklyUsedMicros ?? 0,
    aiRunIds: runs.map((r) => r.id),
    redeemAttemptIds: attempts.map((a) => a.id),
    deletedAt: now,
    updatedAt: now,
  }
  await tx
    .insert(accountTombstones)
    .values(values)
    .onConflictDoUpdate({ target: accountTombstones.emailHash, set: values })
}

/**
 * 注册时调用（建额度行的同一事务）：找到同一邮箱未过期的注销记录就取走（删除），
 * 把记下的 ai_runs / redeem_attempts 关联到新账号，返回本周额度快照；没有返回 null。
 */
export async function claimTombstone(
  tx: Tx,
  userId: string,
  email: string,
  now: Date,
): Promise<QuotaSnapshot | null> {
  const [found] = await tx
    .delete(accountTombstones)
    .where(eq(accountTombstones.emailHash, await emailHash(email)))
    .returning()
  if (!found || tombstoneExpired(found.deletedAt, now)) return null

  if (found.aiRunIds.length > 0) {
    await tx
      .update(aiRuns)
      .set({ userId })
      .where(and(inArray(aiRuns.id, found.aiRunIds), isNull(aiRuns.userId)))
  }
  if (found.redeemAttemptIds.length > 0) {
    await tx
      .update(redeemAttempts)
      .set({ userId })
      .where(and(inArray(redeemAttempts.id, found.redeemAttemptIds), isNull(redeemAttempts.userId)))
  }
  return {
    periodKey: found.periodKey,
    weeklyLimitMicros: found.weeklyLimitMicros,
    weeklyUsedMicros: found.weeklyUsedMicros,
  }
}
