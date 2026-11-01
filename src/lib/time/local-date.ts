import { addDays as addDaysFns, differenceInCalendarDays, getISODay } from 'date-fns'
import { type LocalDateString, localDateToUtc, wallDateOf } from './parse'

/*
 * 本地日期 'YYYY-MM-DD' 上的纯日历运算。本地日期没有时区，
 * 统一换成 UTC 零点做加减，所以夏令时和系统时区都不会影响结果。
 */

/** 本地日期加减天数：addDays('2026-10-31', 1) = '2026-11-01' */
export function addDays(localDate: LocalDateString, days: number): LocalDateString {
  return wallDateOf(addDaysFns(localDateToUtc(localDate), days))
}

/** ISO 星期：1 = 周一 … 7 = 周日 */
export function isoWeekday(localDate: LocalDateString): number {
  return getISODay(localDateToUtc(localDate))
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
