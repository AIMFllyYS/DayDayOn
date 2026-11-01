import 'server-only'
import { dayKey, nextWeekStartsAt, weekKey } from '@/lib/time'

/*
 * 额度周期键（database.md 第 6 节、ADR-0020）。签名 F1，实现 P1。
 * 时区与周的计算全部经 src/lib/time（北京时间、ISO 周）。
 */

/** 当前额度周期键：北京时间 ISO 周，如 '2026-W44' */
export function quotaPeriodKey(now: Date): string {
  return weekKey(now)
}

/** 本周期结束时刻：下周一 00:00 北京时间 */
export function quotaPeriodEndsAt(now: Date): Date {
  return nextWeekStartsAt(now)
}

/** 全站日上限的日期键：北京时间 'YYYY-MM-DD' */
export function spendDayKey(now: Date): string {
  return dayKey(now)
}
