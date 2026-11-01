import 'server-only'

/*
 * 额度周期键（database.md 第 6 节、ADR-0020）。依赖 src/lib/time/ 的 weekKey / dayKey（P2）。
 * 签名 F1，实现 P1。
 */

/** 当前额度周期键：北京时间 ISO 周，如 '2026-W44'。实现：P1（调用 weekKey） */
export function quotaPeriodKey(now: Date): string {
  void now
  throw new Error('not implemented: P1')
}

/** 本周期结束时刻：下周一 00:00 北京时间。实现：P1 */
export function quotaPeriodEndsAt(now: Date): Date {
  void now
  throw new Error('not implemented: P1')
}

/** 全站日上限的日期键：北京时间 'YYYY-MM-DD'。实现：P1（调用 dayKey） */
export function spendDayKey(now: Date): string {
  void now
  throw new Error('not implemented: P1')
}
