import { type InstantInput, type LocalDateString, parseLocalDate, toInstant } from './parse'
import { BUSINESS_TIME_ZONE, calendarDateOf, secondsBetween } from './zone'

/*
 * 显示用格式化（time-and-dates.md 第 4 节）：只用原生 Intl，零体积。
 * 时刻按用户时区显示；周期类显示（"本周额度"）由调用方传 BUSINESS_TIME_ZONE 并注明"北京时间"。
 * 本地日期没有时区：放到 UTC 零点上格式化，结果与系统时区无关。
 */

const LOCALE = 'zh-CN'

// Intl.DateTimeFormat 构造开销不小，按时区缓存
const cache = new Map<string, Intl.DateTimeFormat>()
function formatter(timeZone: string, kind: 'monthDay' | 'weekday' | 'time' | 'yearMonth') {
  const id = `${kind}|${timeZone}`
  let f = cache.get(id)
  if (!f) {
    const options: Intl.DateTimeFormatOptions =
      kind === 'monthDay'
        ? { month: 'long', day: 'numeric' }
        : kind === 'weekday'
          ? { weekday: 'short' }
          : kind === 'time'
            ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
            : { year: 'numeric', month: 'long' }
    f = new Intl.DateTimeFormat(LOCALE, { ...options, timeZone })
    cache.set(id, f)
  }
  return f
}

/** 本地日期 → 该日 UTC 正午（只用于格式化；取正午留出余量，不会因舍入跨日） */
function utcNoonOf(localDate: LocalDateString): Date {
  const { year, month, day } = parseLocalDate(localDate)
  return new Date(Date.UTC(year, month - 1, day, 12))
}

/** '2026-10-31' → '10月31日' */
export function formatMonthDay(localDate: LocalDateString): string {
  return formatter('UTC', 'monthDay').format(utcNoonOf(localDate))
}

/** '2026-10-31' → '周六' */
export function formatWeekday(localDate: LocalDateString): string {
  return formatter('UTC', 'weekday').format(utcNoonOf(localDate))
}

/** '2026-10-31' → '10月31日 周六'（日期印章、历史列表分组） */
export function formatLocalDateLabel(localDate: LocalDateString): string {
  return `${formatMonthDay(localDate)} ${formatWeekday(localDate)}`
}

/** '2026-10' → '2026年10月'（日历标题、月榜） */
export function formatMonth(month: string): string {
  return formatter('UTC', 'yearMonth').format(utcNoonOf(`${month}-01`))
}

/** 时刻 → '23:30'（按给定时区） */
export function formatTime(instant: InstantInput, timeZone: string): string {
  return formatter(timeZone, 'time').format(toInstant(instant))
}

/** 时刻 → '10月31日 周六'（按给定时区的日历日期） */
export function formatInstantDate(instant: InstantInput, timeZone: string): string {
  return formatLocalDateLabel(calendarDateOf(instant, timeZone))
}

/** 时刻 → '10月31日 23:30'（待办 DDL、后台列表） */
export function formatDateTime(instant: InstantInput, timeZone: string): string {
  return `${formatMonthDay(calendarDateOf(instant, timeZone))} ${formatTime(instant, timeZone)}`
}

/** 周期时刻 → '11月2日 00:00'（北京时间，调用方在界面上注明） */
export function formatBusinessDateTime(instant: InstantInput): string {
  return formatDateTime(instant, BUSINESS_TIME_ZONE)
}

/**
 * 秒 → '1小时30分' / '30分钟' / '8小时' / '45秒'。
 * 负数按 0 处理；不足一分钟且大于 0 时显示秒，其余按分钟向下取整。
 */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  if (total === 0) return '0分钟'
  if (total < 60) return `${total}秒`
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (hours === 0) return `${minutes}分钟`
  if (minutes === 0) return `${hours}小时`
  return `${hours}小时${minutes}分`
}

const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })

/**
 * 相对时间：'刚刚'、'3分钟前'、'2小时前'、'昨天'、'3天前'；超过 7 天显示日期。
 * now 由调用方传入；未来的时刻显示 '3分钟后' 这类。
 */
export function formatRelative(instant: InstantInput, now: InstantInput, timeZone: string): string {
  const diff = secondsBetween(now, instant)
  const abs = Math.abs(diff)
  if (abs < 60) return '刚刚'
  if (abs < 3600) return relative.format(Math.trunc(diff / 60), 'minute')
  if (abs < 86_400) return relative.format(Math.trunc(diff / 3600), 'hour')
  if (abs < 7 * 86_400) return relative.format(Math.trunc(diff / 86_400), 'day')
  return formatInstantDate(instant, timeZone)
}
