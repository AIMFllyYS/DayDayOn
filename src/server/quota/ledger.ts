import 'server-only'
import type { Tx } from '@/server/db/client'

/*
 * 额度账本（ADR-0002 第 5.2 节、ai-and-quota.md 第 3 节、database.md 第 6 节）。签名 F1，实现 P1（带单测）。
 * 全部函数在调用方的事务里执行：余额用带条件的原子 UPDATE，每次变动写一条 quota_ledger。
 * 读写额度行时比较 periodKey，不同就先重置（kind = 'reset'）再操作。
 * 扣费顺序：先本周额度，用完再扣加购余额。
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
}

/**
 * 新账号建额度行（本周 newUserQuotaMicros），写 grant 流水。
 * P1 的 databaseHooks.user.create.after 调用。实现：P1
 */
export async function openAccount(
  tx: Tx,
  userId: string,
  weeklyLimitMicros: number,
  now: Date,
): Promise<QuotaBalance> {
  void tx
  void userId
  void weeklyLimitMicros
  void now
  throw new Error('not implemented: P1')
}

/** 把本周额度补到 targetMicros（引导完成补到 10 元，已用的照常计入），写 grant 流水。D1 调用。实现：P1 */
export async function topUpWeekly(
  tx: Tx,
  userId: string,
  targetMicros: number,
  now: Date,
): Promise<QuotaBalance> {
  void tx
  void userId
  void targetMicros
  void now
  throw new Error('not implemented: P1')
}

/**
 * 管理员调整加购余额（± 金额 + 原因），写 adjust 流水；扣成负数时抛 ApiError('VALIDATION_FAILED')。
 * D7 调用；审计日志由 D7 自己写。实现：P1
 */
export async function adjustBonus(
  tx: Tx,
  userId: string,
  amountMicros: number,
  note: string,
  now: Date,
): Promise<QuotaBalance> {
  void tx
  void userId
  void amountMicros
  void note
  void now
  throw new Error('not implemented: P1')
}

/** 预占：余额不足抛 ApiError('QUOTA_INSUFFICIENT')。runAi 调用。实现：P1 */
export async function reserve(
  tx: Tx,
  userId: string,
  amountMicros: number,
  ref: { aiRunId: string; idempotencyKey: string },
  now: Date,
): Promise<Reservation> {
  void tx
  void userId
  void amountMicros
  void ref
  void now
  throw new Error('not implemented: P1')
}

/** 结算：按实际费用多退少补（实际费用不会超过预占）。runAi 调用。实现：P1 */
export async function settle(
  tx: Tx,
  userId: string,
  reservation: Reservation,
  actualMicros: number,
  now: Date,
): Promise<void> {
  void tx
  void userId
  void reservation
  void actualMicros
  void now
  throw new Error('not implemented: P1')
}

/** 释放：调用失败且未产生 token 时全额退回预占。runAi 调用。实现：P1 */
export async function release(
  tx: Tx,
  userId: string,
  reservation: Reservation,
  now: Date,
): Promise<void> {
  void tx
  void userId
  void reservation
  void now
  throw new Error('not implemented: P1')
}

/** 兑换：加到加购余额，写 redeem 流水。码的校验与状态更新由 D6 的 service 在同一事务里做。实现：P1 */
export async function redeem(
  tx: Tx,
  userId: string,
  valueMicros: number,
  ref: { codeId: string; idempotencyKey: string },
  now: Date,
): Promise<QuotaBalance> {
  void tx
  void userId
  void valueMicros
  void ref
  void now
  throw new Error('not implemented: P1')
}

/** 读余额（周期过期时先重置）。D6 的 quota-view 调用。实现：P1 */
export async function getBalance(tx: Tx, userId: string, now: Date): Promise<QuotaBalance> {
  void tx
  void userId
  void now
  throw new Error('not implemented: P1')
}
