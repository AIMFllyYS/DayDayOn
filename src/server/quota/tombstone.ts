/*
 * 注销记录的规则（纯函数，有单测 tombstone.test.ts）。存取在 tombstone-store.ts。
 *
 * 注销会级联删掉额度账户，ai_runs、redeem_attempts 的 userId 置空。同一邮箱马上重新注册的话，
 * 本周额度、每小时 AI 次数、单人日花费告警、兑换失败锁定都会从零开始，等于注销一次换一份钱。
 * 所以注销时按邮箱摘要留一条短期记录：本周额度快照 + 最近的 AI 调用与兑换尝试的 id，
 * 同一邮箱重新注册时沿用本周额度，并把这些行重新关联到新账号。
 */

/** 注销记录保留多久：覆盖一个额度周（7 天）再留一天余量；最长的风控窗口（日花费、兑换锁定）都更短 */
export const TOMBSTONE_TTL_MS = 8 * 86_400_000

/** 注销时最多记下多少条最近的 AI 调用 / 兑换尝试（只记 24 小时内的，够覆盖风控窗口） */
export const TOMBSTONE_MAX_REFS = 200
export const TOMBSTONE_REF_WINDOW_MS = 86_400_000

export interface QuotaSnapshot {
  periodKey: string
  weeklyLimitMicros: number
  weeklyUsedMicros: number
}

export interface Opening {
  weeklyLimitMicros: number
  weeklyUsedMicros: number
  /** true：沿用注销前的本周额度（不写新账号 grant 流水） */
  restored: boolean
}

/**
 * 新账号的本周额度：同一周内注销过就沿用注销前的上限和已用（已用不超过上限），
 * 否则按新账号额度发放。跨周的话新的一周本来就会重置，按新账号处理即可。
 */
export function restoredOpening(
  snapshot: QuotaSnapshot | null,
  periodKey: string,
  newUserQuotaMicros: number,
): Opening {
  if (!snapshot || snapshot.periodKey !== periodKey) {
    return { weeklyLimitMicros: newUserQuotaMicros, weeklyUsedMicros: 0, restored: false }
  }
  return {
    weeklyLimitMicros: snapshot.weeklyLimitMicros,
    weeklyUsedMicros: Math.min(snapshot.weeklyUsedMicros, snapshot.weeklyLimitMicros),
    restored: true,
  }
}

/** 注销记录是否已过保留期 */
export function tombstoneExpired(deletedAt: Date, now: Date): boolean {
  return now.getTime() - deletedAt.getTime() >= TOMBSTONE_TTL_MS
}
