import type { RankMe } from '@/features/rank/schemas'
import { addDays, calendarDateOf, daysBetween, formatTime } from '@/lib/time'

/*
 * 排行与动态的显示文案（纯函数，前后端通用）。
 */

/** 动态时间：今天 '07:42'，昨天 '昨天 23:10'（窗口只有 24 小时，不会更早） */
export function feedTimeLabel(occurredAt: string, now: Date | number, timeZone: string): string {
  const day = calendarDateOf(occurredAt, timeZone)
  const today = calendarDateOf(now, timeZone)
  const time = formatTime(occurredAt, timeZone)
  if (day === today) return time
  if (day === addDays(today, -1)) return `昨天 ${time}`
  return time
}

/** 范围内的总天数：'/ 7 天'、'/ 30 天' 的分母 */
export function rangeLength(from: string, to: string): number {
  return daysBetween(from, to) + 1
}

/** "我"那一行的说明 */
export function myRankNote(me: Extract<RankMe, { optedIn: true }>): string {
  if (me.entry.rank === 1) return '我 · 暂列第一，继续保持'
  if (me.daysToNext !== null) return `我 · 再打卡 ${me.daysToNext} 天追上前一名`
  return '我 · 和前一名同样天数，比的是连续天数'
}
