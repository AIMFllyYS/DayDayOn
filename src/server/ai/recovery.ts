import type { LedgerBucket, LedgerKind } from '@/features/quota/schemas'

/*
 * runAi 结算的恢复工具（纯函数，有单测 recovery.test.ts）。
 * 结算事务失败时先重试；仍失败的 running 行由下一次调用前的对账（run.ts reconcileStaleRuns）处理。
 */

/** 重试一个异步操作：失败后等 delayMs × 第几次，次数用完抛出最后一次的错误 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts, delayMs }: { attempts: number; delayMs: number },
): Promise<T> {
  let last: unknown
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn()
    } catch (error) {
      last = error
      if (i < attempts && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * i))
      }
    }
  }
  throw last
}

export interface LedgerRow {
  kind: LedgerKind
  bucket: LedgerBucket
  amountMicros: number
}

/**
 * 一次 AI 调用的流水 → 还没退回的预占金额。
 * 已经有 settle / release 流水（结算过）或没有 reserve 流水时返回 null：不能再退一次。
 */
export function reservationFromLedger(
  rows: readonly LedgerRow[],
): { weeklyMicros: number; bonusMicros: number } | null {
  if (rows.some((r) => r.kind === 'settle' || r.kind === 'release')) return null
  const reserves = rows.filter((r) => r.kind === 'reserve')
  if (reserves.length === 0) return null
  const sum = (bucket: LedgerBucket) =>
    reserves.filter((r) => r.bucket === bucket).reduce((acc, r) => acc - r.amountMicros, 0)
  return { weeklyMicros: sum('weekly'), bonusMicros: sum('bonus') }
}
