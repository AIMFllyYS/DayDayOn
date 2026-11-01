import { TZDate } from '@date-fns/tz'

/*
 * 入参解析与校验（time-and-dates.md 第 1、3 节）。
 * 本地日期 'YYYY-MM-DD' 与本地时分 'HH:mm' 都是不带时区的字符串；
 * 做日期加减时一律放到 UTC 的 TZDate 上算，结果与运行环境的系统时区无关。
 */

/** 时刻入参：Date、带 Z 的 ISO 字符串或毫秒时间戳 */
export type InstantInput = Date | string | number

/** 本地日期 'YYYY-MM-DD' */
export type LocalDateString = string

/** 本地时分 'HH:mm' */
export type LocalTimeString = string

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const LOCAL_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/** 时刻入参 → Date；无效时抛 RangeError（属于调用方的编程错误，不是用户输入错误） */
export function toInstant(value: InstantInput): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  if (Number.isNaN(date.getTime())) throw new RangeError(`无效的时刻：${String(value)}`)
  return date
}

export interface LocalDateParts {
  year: number
  /** 1–12 */
  month: number
  day: number
}

/** 'YYYY-MM-DD' → 年月日；格式不对或日期不存在（如 2026-02-30）时抛 RangeError */
export function parseLocalDate(value: LocalDateString): LocalDateParts {
  const m = LOCAL_DATE_RE.exec(value)
  if (m) {
    const parts = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
    const probe = new TZDate(parts.year, parts.month - 1, parts.day, 'UTC')
    if (
      probe.getFullYear() === parts.year &&
      probe.getMonth() === parts.month - 1 &&
      probe.getDate() === parts.day
    ) {
      return parts
    }
  }
  throw new RangeError(`无效的本地日期：${value}`)
}

/** 是否为合法的 'YYYY-MM-DD' */
export function isLocalDate(value: string): boolean {
  try {
    parseLocalDate(value)
    return true
  } catch {
    return false
  }
}

/** 'HH:mm' → 时、分；格式不对时抛 RangeError */
export function parseLocalTime(value: LocalTimeString): { hours: number; minutes: number } {
  const m = LOCAL_TIME_RE.exec(value)
  if (!m) throw new RangeError(`无效的本地时间：${value}`)
  return { hours: Number(m[1]), minutes: Number(m[2]) }
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const pad4 = (n: number) => String(n).padStart(4, '0')

/** 年月日 → 'YYYY-MM-DD' */
export function formatLocalDate(year: number, month: number, day: number): LocalDateString {
  return `${pad4(year)}-${pad2(month)}-${pad2(day)}`
}

/** 时分 → 'HH:mm' */
export function formatLocalTime(hours: number, minutes: number): LocalTimeString {
  return `${pad2(hours)}:${pad2(minutes)}`
}

export { pad2 }

/** 本地日期 → 这天 00:00 的 UTC TZDate（只用于日期加减，不代表任何真实时刻） */
export function localDateToUtc(value: LocalDateString): TZDate {
  const { year, month, day } = parseLocalDate(value)
  return new TZDate(year, month - 1, day, 'UTC')
}

/** 任意 TZDate 的墙上日期 → 'YYYY-MM-DD' */
export function wallDateOf(date: TZDate): LocalDateString {
  return formatLocalDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
}
