import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import type { LedgerBucket, LedgerKind } from '@/features/quota/schemas'
import { ApiError } from '@/server/api/errors'
import type { Tx } from '@/server/db/client'
import { quotaAccounts, quotaLedger } from '@/server/db/schema'
import { getSettings } from '@/server/settings'
import { resetForPeriod, settleSplit, splitCharge, topUpDelta } from './money'
import { quotaPeriodKey } from './period'

/*
 * 额度账本（ADR-0002 第 5.2 节、ai-and-quota.md 第 3 节、database.md 第 6 节）。签名 F1，实现 P1。
 * 全部函数在调用方的事务里执行：余额用带条件的原子 UPDATE，每次变动写一条 quota_ledger。
 * 读写额度行时比较 periodKey，不同就先重置（kind = 'reset'）再操作。
 * 扣费顺序：先本周额度，用完再扣加购余额。金额规则在 money.ts（纯函数，有单测）。
 *
 * 口径见 money.ts：weeklyUsed 含本周部分的预占，bonus 已扣掉加购部分的预占，reserved 只是合计。
 */

export interface QuotaBalance {
  periodKey: string
  weeklyLimitMicros: number
  weeklyUsedMicros: number
  bonusMicros: number
  reservedMicros: number
}

/** 一次预占的明细：结算 / 释放时原样传回 */
export interface Reservation {
  aiRunId: string
  idempotencyKey: string
  /** 从本周额度预占的部分 */
  weeklyMicros: number
  /** 从加购余额预占的部分 */
  bonusMicros: number
  /** 预占时的周期键（P1 补充）：跨周结算时，上一周的部分不再退回本周 */
  periodKey?: string
}

const balanceColumns = {
  periodKey: quotaAccounts.periodKey,
  weeklyLimitMicros: quotaAccounts.weeklyLimitMicros,
  weeklyUsedMicros: quotaAccounts.weeklyUsedMicros,
  bonusMicros: quotaAccounts.bonusMicros,
  reservedMicros: quotaAccounts.reservedMicros,
}

interface LedgerEntry {
  kind: LedgerKind
  bucket: LedgerBucket
  amountMicros: number
  aiRunId?: string | null
  idempotencyKey?: string | null
  note?: string | null
}

async function writeLedger(tx: Tx, userId: string, entries: LedgerEntry[], now: Date) {
  if (entries.length === 0) return
  await tx.insert(quotaLedger).values(
    entries.map((e) => ({
      userId,
      kind: e.kind,
      bucket: e.bucket,
      amountMicros: e.amountMicros,
      aiRunId: e.aiRunId ?? null,
      idempotencyKey: e.idempotencyKey ?? null,
      note: e.note ?? null,
      createdAt: now,
      updatedAt: now,
    })),
  )
}

/** 余额不变时也留一条 0 元流水的场景：只保留非零项，全为零时保留第一项 */
function nonZero(entries: LedgerEntry[]): LedgerEntry[] {
  const kept = entries.filter((e) => e.amountMicros !== 0)
  return kept.length > 0 ? kept : entries.slice(0, 1)
}

/**
 * 锁定额度行（SELECT … FOR UPDATE），周期过期时在同一事务里先重置。
 * 账户不存在（注册钩子失败的老账号）时按新账号补建。返回当前周期的余额。
 */
async function lockCurrent(tx: Tx, userId: string, now: Date): Promise<QuotaBalance> {
  const periodKey = quotaPeriodKey(now)
  const [row] = await tx
    .select(balanceColumns)
    .from(quotaAccounts)
    .where(eq(quotaAccounts.userId, userId))
    .for('update')
  if (!row) {
    const settings = await getSettings()
    return openAccount(tx, userId, settings.newUserQuotaMicros, now)
  }
  if (row.periodKey === periodKey) return row

  const settings = await getSettings()
  const next = resetForPeriod(row, settings.weeklyQuotaMicros)
  const [updated] = await tx
    .update(quotaAccounts)
    .set({
      periodKey,
      weeklyLimitMicros: next.weeklyLimitMicros,
      weeklyUsedMicros: next.weeklyUsedMicros,
      updatedAt: now,
    })
    .where(and(eq(quotaAccounts.userId, userId), eq(quotaAccounts.periodKey, row.periodKey)))
    .returning(balanceColumns)
  if (!updated) throw new Error('额度行周期重置失败')
  await writeLedger(
    tx,
    userId,
    [
      {
        kind: 'reset',
        bucket: 'weekly',
        amountMicros: next.deltaMicros,
        note: `${row.periodKey} → ${periodKey}`,
      },
    ],
    now,
  )
  return updated
}

/**
 * 新账号建额度行（本周 newUserQuotaMicros），写 grant 流水。
 * P1 的 databaseHooks.user.create.after 调用。已存在时不重复发放，直接返回现有余额。
 */
export async function openAccount(
  tx: Tx,
  userId: string,
  weeklyLimitMicros: number,
  now: Date,
  /** 同一邮箱本周注销过（tombstone.ts restoredOpening）：沿用注销前的额度，不写 grant 流水 */
  restored?: { weeklyLimitMicros: number; weeklyUsedMicros: number },
): Promise<QuotaBalance> {
  const periodKey = quotaPeriodKey(now)
  const [inserted] = await tx
    .insert(quotaAccounts)
    .values({
      userId,
      periodKey,
      weeklyLimitMicros: restored?.weeklyLimitMicros ?? weeklyLimitMicros,
      weeklyUsedMicros: restored?.weeklyUsedMicros ?? 0,
      bonusMicros: 0,
      reservedMicros: 0,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: quotaAccounts.userId })
    .returning(balanceColumns)
  if (!inserted) return lockCurrent(tx, userId, now)
  if (restored) return inserted
  await writeLedger(
    tx,
    userId,
    [{ kind: 'grant', bucket: 'weekly', amountMicros: weeklyLimitMicros, note: '新账号首周额度' }],
    now,
  )
  return inserted
}

/** 把本周额度补到 targetMicros（引导完成补到 10 元，已用的照常计入），写 grant 流水。D1 调用 */
export async function topUpWeekly(
  tx: Tx,
  userId: string,
  targetMicros: number,
  now: Date,
): Promise<QuotaBalance> {
  const current = await lockCurrent(tx, userId, now)
  const delta = topUpDelta(current, targetMicros)
  if (delta === 0) return current
  const [updated] = await tx
    .update(quotaAccounts)
    .set({
      weeklyLimitMicros: sql`greatest(${quotaAccounts.weeklyLimitMicros}, ${targetMicros})`,
      updatedAt: now,
    })
    .where(and(eq(quotaAccounts.userId, userId), eq(quotaAccounts.periodKey, current.periodKey)))
    .returning(balanceColumns)
  if (!updated) throw new Error('补足本周额度失败')
  await writeLedger(
    tx,
    userId,
    [
      {
        kind: 'grant',
        bucket: 'weekly',
        amountMicros: delta,
        note: `本周额度补到 ${targetMicros}`,
      },
    ],
    now,
  )
  return updated
}

/**
 * 管理员调整加购余额（± 金额 + 原因），写 adjust 流水；扣成负数时抛 ApiError('VALIDATION_FAILED')。
 * D7 调用；审计日志由 D7 自己写。
 */
export async function adjustBonus(
  tx: Tx,
  userId: string,
  amountMicros: number,
  note: string,
  now: Date,
): Promise<QuotaBalance> {
  if (!Number.isSafeInteger(amountMicros) || amountMicros === 0) {
    throw new ApiError('VALIDATION_FAILED', '调整金额必须是非零整数微元', {
      fields: { amountMicros: ['调整金额不能为 0'] },
    })
  }
  await lockCurrent(tx, userId, now)
  const [updated] = await tx
    .update(quotaAccounts)
    .set({ bonusMicros: sql`${quotaAccounts.bonusMicros} + ${amountMicros}`, updatedAt: now })
    .where(
      and(
        eq(quotaAccounts.userId, userId),
        sql`${quotaAccounts.bonusMicros} + ${amountMicros} >= 0`,
      ),
    )
    .returning(balanceColumns)
  if (!updated) {
    throw new ApiError('VALIDATION_FAILED', '加购余额不足以扣减', {
      fields: { amountMicros: ['扣减后加购余额会小于 0'] },
    })
  }
  await writeLedger(tx, userId, [{ kind: 'adjust', bucket: 'bonus', amountMicros, note }], now)
  return updated
}

/** 预占：余额不足抛 ApiError('QUOTA_INSUFFICIENT')。runAi 调用 */
export async function reserve(
  tx: Tx,
  userId: string,
  amountMicros: number,
  ref: { aiRunId: string; idempotencyKey: string },
  now: Date,
): Promise<Reservation> {
  const current = await lockCurrent(tx, userId, now)
  const split = splitCharge(current, amountMicros)
  if (!split) throw new ApiError('QUOTA_INSUFFICIENT', '本周额度与加购余额都不足')
  const [updated] = await tx
    .update(quotaAccounts)
    .set({
      weeklyUsedMicros: sql`${quotaAccounts.weeklyUsedMicros} + ${split.weeklyMicros}`,
      bonusMicros: sql`${quotaAccounts.bonusMicros} - ${split.bonusMicros}`,
      reservedMicros: sql`${quotaAccounts.reservedMicros} + ${amountMicros}`,
      updatedAt: now,
    })
    .where(
      and(
        eq(quotaAccounts.userId, userId),
        eq(quotaAccounts.periodKey, current.periodKey),
        sql`${quotaAccounts.weeklyUsedMicros} + ${split.weeklyMicros} <= ${quotaAccounts.weeklyLimitMicros}`,
        sql`${quotaAccounts.bonusMicros} >= ${split.bonusMicros}`,
      ),
    )
    .returning({ userId: quotaAccounts.userId })
  if (!updated) throw new ApiError('QUOTA_INSUFFICIENT', '本周额度与加购余额都不足')
  await writeLedger(
    tx,
    userId,
    nonZero([
      { kind: 'reserve', bucket: 'weekly', amountMicros: -split.weeklyMicros, ...ref },
      { kind: 'reserve', bucket: 'bonus', amountMicros: -split.bonusMicros, ...ref },
    ]),
    now,
  )
  return { ...ref, ...split, periodKey: current.periodKey }
}

/** 退回预占的公共部分：settle 与 release 共用 */
async function refund(
  tx: Tx,
  userId: string,
  reservation: Reservation,
  actualMicros: number,
  kind: 'settle' | 'release',
  now: Date,
): Promise<void> {
  const current = await lockCurrent(tx, userId, now)
  const result = settleSplit(reservation, actualMicros)
  // 跨周：上一周的额度已经重置，本周部分不再退回（否则等于给新一周加额度）
  const samePeriod = (reservation.periodKey ?? current.periodKey) === current.periodKey
  const weeklyRefund = samePeriod ? result.weeklyRefundMicros : 0
  const total = reservation.weeklyMicros + reservation.bonusMicros
  await tx
    .update(quotaAccounts)
    .set({
      weeklyUsedMicros: sql`greatest(${quotaAccounts.weeklyUsedMicros} - ${weeklyRefund}, 0)`,
      bonusMicros: sql`${quotaAccounts.bonusMicros} + ${result.bonusRefundMicros}`,
      reservedMicros: sql`greatest(${quotaAccounts.reservedMicros} - ${total}, 0)`,
      updatedAt: now,
    })
    .where(eq(quotaAccounts.userId, userId))
  const ref = { aiRunId: reservation.aiRunId, idempotencyKey: reservation.idempotencyKey }
  await writeLedger(
    tx,
    userId,
    nonZero([
      { kind, bucket: 'weekly', amountMicros: weeklyRefund, ...ref },
      { kind, bucket: 'bonus', amountMicros: result.bonusRefundMicros, ...ref },
    ]),
    now,
  )
}

/** 结算：按实际费用多退少补（实际费用不会超过预占）。runAi 调用 */
export async function settle(
  tx: Tx,
  userId: string,
  reservation: Reservation,
  actualMicros: number,
  now: Date,
): Promise<void> {
  await refund(tx, userId, reservation, actualMicros, 'settle', now)
}

/** 释放：调用失败且未产生 token 时全额退回预占。runAi 调用 */
export async function release(
  tx: Tx,
  userId: string,
  reservation: Reservation,
  now: Date,
): Promise<void> {
  await refund(tx, userId, reservation, 0, 'release', now)
}

/** 兑换：加到加购余额，写 redeem 流水。码的校验与状态更新由 D6 的 service 在同一事务里做 */
export async function redeem(
  tx: Tx,
  userId: string,
  valueMicros: number,
  ref: { codeId: string; idempotencyKey: string },
  now: Date,
): Promise<QuotaBalance> {
  if (!Number.isSafeInteger(valueMicros) || valueMicros <= 0) {
    throw new ApiError('VALIDATION_FAILED', '兑换面值必须是正整数微元')
  }
  await lockCurrent(tx, userId, now)
  const [updated] = await tx
    .update(quotaAccounts)
    .set({ bonusMicros: sql`${quotaAccounts.bonusMicros} + ${valueMicros}`, updatedAt: now })
    .where(eq(quotaAccounts.userId, userId))
    .returning(balanceColumns)
  if (!updated) throw new Error('兑换入账失败')
  await writeLedger(
    tx,
    userId,
    [
      {
        kind: 'redeem',
        bucket: 'bonus',
        amountMicros: valueMicros,
        idempotencyKey: ref.idempotencyKey,
        note: `code:${ref.codeId}`,
      },
    ],
    now,
  )
  return updated
}

/** 读余额（周期过期时先重置）。D6 的 quota-view 调用 */
export async function getBalance(tx: Tx, userId: string, now: Date): Promise<QuotaBalance> {
  return lockCurrent(tx, userId, now)
}
