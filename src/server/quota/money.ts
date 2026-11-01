/*
 * 额度的金额规则（ADR-0002 第 5.2 节、ai-and-quota.md 第 10 节）：纯函数，带单元测试。
 * ledger.ts 用它算出要扣 / 退多少，再用带条件的原子 UPDATE 落库；条件本身仍在 SQL 里兜底。
 * 不 import 'server-only'：没有服务端依赖，测试直接引用。
 *
 * 账户的口径（与 quota_accounts 列一一对应）：
 * - weeklyUsedMicros 含"已预占但未结算"中属于本周额度的部分；
 * - bonusMicros 已扣除"已预占但未结算"中属于加购余额的部分；
 * - reservedMicros 是进行中的预占合计，只用于展示和对账。
 * 所以本周剩余 = weeklyLimitMicros - weeklyUsedMicros（见 weeklyRemaining）。
 */

export interface AccountState {
  weeklyLimitMicros: number
  weeklyUsedMicros: number
  bonusMicros: number
}

/** 本周剩余额度，不小于 0 */
export function weeklyRemaining(a: Pick<AccountState, 'weeklyLimitMicros' | 'weeklyUsedMicros'>) {
  return Math.max(0, a.weeklyLimitMicros - a.weeklyUsedMicros)
}

/** 一笔扣费在两个桶之间的分配：先本周额度，用完再扣加购余额 */
export interface Split {
  weeklyMicros: number
  bonusMicros: number
}

/** 预占 amount：余额不足返回 null */
export function splitCharge(a: AccountState, amountMicros: number): Split | null {
  if (!Number.isSafeInteger(amountMicros) || amountMicros < 0) return null
  const weekly = Math.min(amountMicros, weeklyRemaining(a))
  const bonus = amountMicros - weekly
  if (bonus > Math.max(0, a.bonusMicros)) return null
  return { weeklyMicros: weekly, bonusMicros: bonus }
}

export interface SettleResult {
  /** 实际扣下的金额（不超过预占合计） */
  chargedMicros: number
  /** 退回本周额度 */
  weeklyRefundMicros: number
  /** 退回加购余额 */
  bonusRefundMicros: number
}

/**
 * 结算：实际费用先算在本周部分，超出的再算在加购部分，其余退回。
 * actual 超过预占时按预占封顶（预占按上限计算，正常不会发生；ai_runs 仍记真实费用）。
 * actual = 0 即全额释放。
 */
export function settleSplit(reserved: Split, actualMicros: number): SettleResult {
  const total = reserved.weeklyMicros + reserved.bonusMicros
  const charged = Math.min(total, Math.max(0, Math.ceil(actualMicros)))
  const fromWeekly = Math.min(charged, reserved.weeklyMicros)
  const fromBonus = charged - fromWeekly
  return {
    chargedMicros: charged,
    weeklyRefundMicros: reserved.weeklyMicros - fromWeekly,
    bonusRefundMicros: reserved.bonusMicros - fromBonus,
  }
}

/** 周期切换：本周额度重置为新周期的上限，已用清零，不累积；加购余额不动 */
export function resetForPeriod(a: AccountState, newLimitMicros: number) {
  const before = weeklyRemaining(a)
  return {
    weeklyLimitMicros: newLimitMicros,
    weeklyUsedMicros: 0,
    /** reset 流水的金额：本周可用额度的变化量（新上限 - 上期剩余） */
    deltaMicros: newLimitMicros - before,
  }
}

/** 引导完成补到 target：只升不降，已用的照常计入；返回流水金额（0 表示不变） */
export function topUpDelta(a: Pick<AccountState, 'weeklyLimitMicros'>, targetMicros: number) {
  return Math.max(0, targetMicros - a.weeklyLimitMicros)
}
