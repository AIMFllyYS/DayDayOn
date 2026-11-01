import 'server-only'
import { and, desc, eq, gt } from 'drizzle-orm'
import type { Redeem, RedeemResult } from '@/features/quota/schemas'
import { dayKey } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import { db } from '@/server/db/client'
import { redeemAttempts, redeemCodes } from '@/server/db/schema'
import { maybeAlert } from '@/server/quota/alerts'
import { redeem as ledgerRedeem } from '@/server/quota/ledger'
import { hashCode, normalizeCode } from '@/server/quota/redeem-code'
import { getSettings } from '@/server/settings'
import { quotaViewIn } from '../quota-view'
import { classifyUnavailable, REDEEM_LOCK_WINDOW_SECONDS, redeemLockState } from './rules'

/*
 * 兑换码兑换（PRD 2.7、7.3，POST /redeem-codes/redeem）。实现：D6。
 * - 每次尝试写一条只增的 redeem_attempts(userId, ip, ok)；
 * - 近 1 小时失败达到 redeemFailLockThreshold 次后锁定：429 REDEEM_LOCKED + Retry-After；
 * - 码的状态用带条件的原子 UPDATE（status = 'unused'）切换，再在同一事务里 ledger.redeem 入账。
 * 明文码不进日志、不进数据库（只用 SHA-256 查找）。
 */

export interface RedeemInput {
  userId: string
  ip: string
  idempotencyKey: string
  body: Redeem
  now?: Date
}

async function recordAttempt(userId: string, ip: string, ok: boolean, now: Date): Promise<void> {
  await db.insert(redeemAttempts).values({ userId, ip, ok, createdAt: now })
}

async function checkLock(userId: string, threshold: number, now: Date): Promise<void> {
  const since = new Date(now.getTime() - REDEEM_LOCK_WINDOW_SECONDS * 1000)
  const rows = await db
    .select({ createdAt: redeemAttempts.createdAt })
    .from(redeemAttempts)
    .where(
      and(
        eq(redeemAttempts.userId, userId),
        eq(redeemAttempts.ok, false),
        gt(redeemAttempts.createdAt, since),
      ),
    )
    .orderBy(desc(redeemAttempts.createdAt))
    .limit(threshold)
  const state = redeemLockState(
    rows.map((r) => r.createdAt),
    threshold,
    now,
  )
  if (state.locked) {
    throw new ApiError('REDEEM_LOCKED', '兑换失败次数过多，暂时锁定', {
      retryAfterSeconds: state.retryAfterSeconds,
    })
  }
}

/** 失败：记一次尝试，达到阈值时告警，再抛对应错误 */
async function fail(
  input: RedeemInput,
  kind: 'invalid' | 'used',
  threshold: number,
  now: Date,
): Promise<never> {
  await recordAttempt(input.userId, input.ip, false, now)
  try {
    await checkLock(input.userId, threshold, now)
  } catch (error) {
    // 这一次刚好触发锁定：告警（每天每种一次）；本次仍返回码本身的错误
    if (error instanceof ApiError) {
      void maybeAlert('redeem-failures', dayKey(now), { userId: input.userId })
    } else throw error
  }
  if (kind === 'used') throw new ApiError('REDEEM_CODE_USED', '兑换码已使用')
  throw new ApiError('REDEEM_CODE_INVALID', '兑换码不存在或已作废')
}

export async function redeemCode(input: RedeemInput): Promise<RedeemResult> {
  const now = input.now ?? new Date()
  const { redeemFailLockThreshold: threshold } = await getSettings()
  await checkLock(input.userId, threshold, now)

  const normalized = normalizeCode(input.body.code)
  if (!normalized) return fail(input, 'invalid', threshold, now)
  const codeHash = await hashCode(normalized)

  const outcome = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(redeemCodes)
      .set({ status: 'redeemed', redeemedBy: input.userId, redeemedAt: now, updatedAt: now })
      .where(and(eq(redeemCodes.codeHash, codeHash), eq(redeemCodes.status, 'unused')))
      .returning({ id: redeemCodes.id, valueMicros: redeemCodes.valueMicros })
    if (!claimed) {
      const [existing] = await tx
        .select({ status: redeemCodes.status })
        .from(redeemCodes)
        .where(eq(redeemCodes.codeHash, codeHash))
      return { ok: false as const, kind: classifyUnavailable(existing?.status ?? null) }
    }
    await ledgerRedeem(
      tx,
      input.userId,
      claimed.valueMicros,
      { codeId: claimed.id, idempotencyKey: input.idempotencyKey },
      now,
    )
    await tx
      .insert(redeemAttempts)
      .values({ userId: input.userId, ip: input.ip, ok: true, createdAt: now })
    const quota = await quotaViewIn(tx, input.userId, now)
    return { ok: true as const, result: { addedMicros: claimed.valueMicros, quota } }
  })

  if (!outcome.ok) return fail(input, outcome.kind, threshold, now)
  return outcome.result
}
