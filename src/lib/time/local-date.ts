import { addDays as addDaysFns, differenceInCalendarDays } from 'date-fns'
import { type LocalDateString, localDateToUtc, parseLocalDate, wallDateOf } from './parse'

/*
 * 本地日期 'YYYY-MM-DD' 上的纯日历运算。本地日期没有时区，
 * 统一换成 UTC 零点做加减，所以夏令时和系统时区都不会影响结果。
 */

const SAKAMOTO_OFFSETS = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4] as const

/** 本地日期加减天数：addDays('2026-10-31', 1) = '2026-11-01' */
export function addDays(localDate: LocalDateString, days: number): LocalDateString {
  return wallDateOf(addDaysFns(localDateToUtc(localDate), days))
}

/** ISO 星期：1 = 周一 … 7 = 周日（纯整数计算，不构造 Date/TZDate，兼容 Next.js 16 静态预渲染） */
export function isoWeekday(localDate: LocalDateString): number {
  const { year, month, day } = parseLocalDate(localDate)
  const y = month < 3 ? year - 1 : year
  const offset = SAKAMOTO_OFFSETS[month - 1] ?? 0
  const sun0 =
    (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + offset + day) % 7
  return sun0 === 0 ? 7 : sun0
}

/** to − from 的天数（to 更晚为正） */
export function daysBetween(from: LocalDateString, to: LocalDateString): number {
  return differenceInCalendarDays(localDateToUtc(to), localDateToUtc(from))
}

/** 闭区间 [start, end] 内的每一天；start 晚于 end 时返回空数组 */
export function eachLocalDate(start: LocalDateString, end: LocalDateString): LocalDateString[] {
  const count = daysBetween(start, end)
  const out: LocalDateString[] = []
  for (let i = 0; i <= count; i += 1) out.push(addDays(start, i))
  return out
}

/** 所在周的周一（一周从周一开始） */
export function startOfWeekDate(localDate: LocalDateString): LocalDateString {
  return addDays(localDate, 1 - isoWeekday(localDate))
}

/** 所在周周一到周日的七天（主页热力图按用户打卡日的本周） */
export function weekDates(localDate: LocalDateString): LocalDateString[] {
  const monday = startOfWeekDate(localDate)
  return eachLocalDate(monday, addDays(monday, 6))
}

/** 本地日期比较：a 早于 b 为负，相同为 0（'YYYY-MM-DD' 可直接按字符串比较） */
export function compareLocalDate(a: LocalDateString, b: LocalDateString): number {
  return a < b ? -1 : a > b ? 1 : 0
}
