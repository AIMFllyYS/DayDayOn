import { TZDate, tz } from '@date-fns/tz'
import { differenceInSeconds, getISOWeek, getISOWeekYear } from 'date-fns'
import { addDays, startOfWeekDate } from './local-date'
import {
  formatLocalDate,
  type InstantInput,
  type LocalDateString,
  type LocalTimeString,
  pad2,
  parseLocalDate,
  parseLocalTime,
  toInstant,
  wallDateOf,
} from './parse'

/*
 * 时刻 ↔ 本地日期 / 周期键（time-and-dates.md 第 2–3 节）。
 * 每个函数都显式带时区，不读系统时区，不读当前时间（now 由调用方传入）。
 */

/** 业务周期时区：额度周、全站日上限、排行周 / 月一律按北京时间 */
export const BUSINESS_TIME_ZONE = 'Asia/Shanghai'

/** 默认的日切换时间：凌晨 4 点前算前一天 */
export const DEFAULT_DAY_START_HOUR = 4

/** IANA 时区名是否可用（个人资料改时区时校验） */
export function isValidTimeZone(timeZone: string): boolean {
  if (timeZone.length === 0) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

/** 时刻在某时区的墙上时间 */
function inZone(instant: InstantInput, timeZone: string): TZDate {
  return new TZDate(toInstant(instant).getTime(), timeZone)
}

/**
 * 时刻 → 打卡日（PRD 3）。墙上时间早于 dayStartHour 点的算前一天，熬夜打卡不会记到第二天。
 * dayStartHour 取 0–6（偏好设置），0 表示零点换日。
 */
export function localDateOf(
  instant: InstantInput,
  timeZone: string,
  dayStartHour: number = DEFAULT_DAY_START_HOUR,
): LocalDateString {
  if (!Number.isInteger(dayStartHour) || dayStartHour < 0 || dayStartHour > 23) {
    throw new RangeError(`无效的日切换时间：${dayStartHour}`)
  }
  const wall = inZone(instant, timeZone)
  const date = wallDateOf(wall)
  return wall.getHours() < dayStartHour ? addDays(date, -1) : date
}

/** 时刻在某时区的本地日历日期（零点换日，不做日切换偏移） */
export function calendarDateOf(instant: InstantInput, timeZone: string): LocalDateString {
  return wallDateOf(inZone(instant, timeZone))
}

/** 时刻在某时区的本地时分 'HH:mm'（睡眠表单回填） */
export function localTimeOf(instant: InstantInput, timeZone: string): LocalTimeString {
  const wall = inZone(instant, timeZone)
  return `${pad2(wall.getHours())}:${pad2(wall.getMinutes())}`
}

/** 北京时间的日期键 '2026-10-31'（全站每日花费上限） */
export function dayKey(instant: InstantInput): string {
  return calendarDateOf(instant, BUSINESS_TIME_ZONE)
}

/** 北京时间的 ISO 周键 '2026-W44'（每周额度、周榜）；年末年初的周按 ISO 规则归属 */
export function weekKey(instant: InstantInput): string {
  const date = toInstant(instant)
  const options = { in: tz(BUSINESS_TIME_ZONE) }
  const year = getISOWeekYear(date, options)
  const week = getISOWeek(date, options)
  return `${year}-W${pad2(week)}`
}

/** 北京时间的月键 '2026-10'（月榜） */
export function monthKey(instant: InstantInput): string {
  return dayKey(instant).slice(0, 7)
}

/** 本地日期范围（闭区间） */
export interface LocalDateRange {
  start: LocalDateString
  end: LocalDateString
}

/** 北京时间所在 ISO 周的周一到周日（排行周榜按 localDate 落在这个区间计数） */
export function weekRange(instant: InstantInput): LocalDateRange {
  const start = startOfWeekDate(dayKey(instant))
  return { start, end: addDays(start, 6) }
}

/** 北京时间所在自然月的第一天到最后一天（月榜） */
export function monthRange(instant: InstantInput): LocalDateRange {
  const { year, month } = parseLocalDate(dayKey(instant))
  const start = formatLocalDate(year, month, 1)
  const nextMonth =
    month === 12 ? formatLocalDate(year + 1, 1, 1) : formatLocalDate(year, month + 1, 1)
  return { start, end: addDays(nextMonth, -1) }
}

/** 下一个北京时间周一 00:00 的时刻（每周额度的重置时刻） */
export function nextWeekStartsAt(instant: InstantInput): Date {
  const { start } = weekRange(instant)
  return combineLocal(addDays(start, 7), '00:00', BUSINESS_TIME_ZONE)
}

/** 下一个北京时间 00:00 的时刻（全站日上限的重置时刻） */
export function nextDayStartsAt(instant: InstantInput): Date {
  return combineLocal(addDays(dayKey(instant), 1), '00:00', BUSINESS_TIME_ZONE)
}

/**
 * 本地日期 + 本地时分 → 时刻（原生 date / time 输入提交前用）。
 * 落在夏令时跳过的那一小时里时，按 @date-fns/tz 的规则顺延。
 */
export function combineLocal(
  localDate: LocalDateString,
  localTime: LocalTimeString,
  timeZone: string,
): Date {
  const { year, month, day } = parseLocalDate(localDate)
  const { hours, minutes } = parseLocalTime(localTime)
  return new Date(new TZDate(year, month - 1, day, hours, minutes, timeZone).getTime())
}

/** datetime-local 的值 'YYYY-MM-DDTHH:mm' → 时刻（待办 DDL） */
export function combineLocalDateTime(value: string, timeZone: string): Date {
  const [date, time] = value.split('T')
  if (date === undefined || time === undefined) {
    throw new RangeError(`无效的本地日期时间：${value}`)
  }
  return combineLocal(date, time.slice(0, 5), timeZone)
}

/** 时刻 → datetime-local 的值 'YYYY-MM-DDTHH:mm'（编辑待办时回填） */
export function toLocalDateTimeValue(instant: InstantInput, timeZone: string): string {
  return `${calendarDateOf(instant, timeZone)}T${localTimeOf(instant, timeZone)}`
}

/** 两个时刻之间的秒数：b − a，b 更晚为正，不足一秒的部分舍去 */
export function secondsBetween(a: InstantInput, b: InstantInput): number {
  return differenceInSeconds(toInstant(b), toInstant(a))
}

export interface SleepRange {
  bedAt: Date
  wakeAt: Date
  durationSeconds: number
  /** 起床是否在入睡的次日（界面显示"次日"） */
  nextDay: boolean
}

/**
 * 入睡日期 + 入睡时分 + 起床时分 → 时刻区间（time-and-dates.md 第 3 节）。
 * 起床早于入睡时算作次日；起床等于入睡视为输入错误，返回 null。
 * 时长范围（30 分钟–20 小时）由表单 schema 校验，这里不拦。
 */
export function sleepRange(
  bedDate: LocalDateString,
  bedTime: LocalTimeString,
  wakeTime: LocalTimeString,
  timeZone: string,
): SleepRange | null {
  if (bedTime === wakeTime) return null
  const nextDay = wakeTime < bedTime
  const bedAt = combineLocal(bedDate, bedTime, timeZone)
  const wakeAt = combineLocal(nextDay ? addDays(bedDate, 1) : bedDate, wakeTime, timeZone)
  return { bedAt, wakeAt, durationSeconds: secondsBetween(bedAt, wakeAt), nextDay }
}

/**
 * 按打卡日组合睡眠区间（PRD 7.2：起床 = 目标打卡日的该时分，入睡晚于起床则取前一天）。
 * 起床早于日切换时间时（例如 4 点换日、03:30 起床），墙上日期是打卡日的次日，
 * 这样 localDateOf(wakeAt) 仍等于 checkinDate，与服务端的校验一致。
 */
export function sleepRangeForDay(
  checkinDate: LocalDateString,
  bedTime: LocalTimeString,
  wakeTime: LocalTimeString,
  timeZone: string,
  dayStartHour: number = DEFAULT_DAY_START_HOUR,
): SleepRange | null {
  if (bedTime === wakeTime) return null
  const wakeDate =
    parseLocalTime(wakeTime).hours < dayStartHour ? addDays(checkinDate, 1) : checkinDate
  const bedDate = wakeTime < bedTime ? addDays(wakeDate, -1) : wakeDate
  return sleepRange(bedDate, bedTime, wakeTime, timeZone)
}
