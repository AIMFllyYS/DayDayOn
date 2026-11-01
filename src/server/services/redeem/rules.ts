import type { RedeemCodeStatus } from '@/features/quota/schemas'

/*
 * 兑换的纯函数规则（PRD 2.7、7.3，ADR-0002 第 6 节）：带单测。
 * 锁定：近 1 小时内失败次数达到阈值就锁定，直到最早那次失败滑出窗口。
 */

export const REDEEM_LOCK_WINDOW_SECONDS = 3600

export type LockState = { locked: false } | { locked: true; retryAfterSeconds: number }

/**
 * @param failuresDesc 近 1 小时内的失败时刻，按时间倒序（最多取 threshold 条即可）
 * @param threshold 全站配置 redeemFailLockThreshold
 */
export function redeemLockState(
  failuresDesc: readonly Date[],
  threshold: number,
  now: Date,
): LockState {
  const windowStart = now.getTime() - REDEEM_LOCK_WINDOW_SECONDS * 1000
  const recent = failuresDesc.filter((d) => d.getTime() > windowStart)
  if (recent.length < threshold) return { locked: false }
  // 第 threshold 新的那次失败滑出窗口后，失败次数降到阈值以下
  const pivot = recent[threshold - 1]
  if (!pivot) return { locked: false }
  const unlockAt = pivot.getTime() + REDEEM_LOCK_WINDOW_SECONDS * 1000
  return {
    locked: true,
    retryAfterSeconds: Math.max(1, Math.ceil((unlockAt - now.getTime()) / 1000)),
  }
}

export type RedeemFailure = 'invalid' | 'used'

/** 码不可用时的错误分类：不存在或已作废 → invalid（不区分，防探测）；已兑换 → used */
export function classifyUnavailable(status: RedeemCodeStatus | null): RedeemFailure {
  return status === 'redeemed' ? 'used' : 'invalid'
}
