import type { LocalDate } from '@/features/shared/schemas'
import { addDays, daysBetween } from '@/lib/time'

/*
 * 目标周期与总坚持天数的纯计算（前后端共用）。
 * - 显式设定截止日期时：总天数 = 起始打卡日 → 截止日期（闭区间，至少 1 天）。
 * - 未设截止日期时：自动匹配下一个里程碑（7、14、21、30、60、100、200、365 天）。
 */

export const PERIOD_DAY_PRESETS = [7, 14, 21, 30, 60, 100] as const
export const PERIOD_MILESTONES = [7, 14, 21, 30, 60, 100, 200, 365] as const

export interface OverallPeriod {
  checkedDays: number
  targetDays: number
  startDate: LocalDate | null
  deadlineDate: LocalDate | null
  hasDeadline: boolean
}

/** 起始日 + 坚持天数 → 截止日期（包含起始当天，所以第 1 天即 startDate） */
export function deadlineFromDays(startDate: LocalDate, days: number): LocalDate {
  const safeDays = Math.max(1, Math.round(days))
  return addDays(startDate, safeDays - 1)
}

/** 起始日 → 截止日期的总天数（闭区间，至少 1 天） */
export function daysFromDeadline(startDate: LocalDate, deadlineDate: LocalDate): number {
  if (deadlineDate < startDate) return 1
  return Math.max(1, daysBetween(startDate, deadlineDate) + 1)
}

/** 单个目标的周期环进度（打卡页使用） */
export function goalPeriodProgress(
  validDays: number,
  startDate: LocalDate,
  deadlineDate: LocalDate | null,
): { done: number; total: number } {
  if (deadlineDate && deadlineDate >= startDate) {
    return { done: validDays, total: daysFromDeadline(startDate, deadlineDate) }
  }
  const total = PERIOD_MILESTONES.find((m) => m > validDays) ?? validDays + 1
  return { done: validDays, total }
}

/** 全局总坚持进度（主页首卡使用）：多目标时取最早起始日与最晚有效截止日期 */
export function computeOverallPeriod(input: {
  checkedDays: number
  startDate: LocalDate | null
  deadlineDates: readonly (LocalDate | null)[]
}): OverallPeriod {
  const checkedDays = Math.max(0, Math.floor(input.checkedDays))
  const startDate = input.startDate
  let latestDeadline: LocalDate | null = null
  for (const d of input.deadlineDates) {
    if (d && (latestDeadline === null || d > latestDeadline)) {
      latestDeadline = d
    }
  }
  if (startDate !== null && latestDeadline !== null && latestDeadline >= startDate) {
    return {
      checkedDays,
      targetDays: daysFromDeadline(startDate, latestDeadline),
      startDate,
      deadlineDate: latestDeadline,
      hasDeadline: true,
    }
  }
  const milestone = PERIOD_MILESTONES.find((m) => m > checkedDays) ?? checkedDays + 1
  return {
    checkedDays,
    targetDays: milestone,
    startDate,
    deadlineDate: null,
    hasDeadline: false,
  }
}
