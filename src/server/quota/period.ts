import 'server-only'

/*
 * 额度周期键（database.md 第 6 节、ADR-0020）。签名 F1，实现 P1。
 *
 * TODO(集成)：src/lib/time/ 由 P2 并行实现，本 worktree 里还没有。下面的 weekKey / dayKey
 * 是临时的本地版本（只在本文件内），行为按 time-and-dates.md 第 3 节：北京时间、ISO 周。
 * 合并 P2 后删掉 "临时实现" 一段，改成 `import { dayKey, weekKey } from '@/lib/time'`，
 * period.test.ts 不用改。
 */

// ---------- 临时实现（合并 P2 后删除）----------

const BUSINESS_TIME_ZONE = 'Asia/Shanghai'

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

/** 时刻在北京时间下的年月日时分秒（用 Intl 显式传时区，不依赖系统时区） */
function zonedParts(instant: Date): ZonedParts {
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = partsFormatter.formatToParts(instant).find((p) => p.type === type)
    return Number(part?.value ?? 0)
  }
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

const pad = (n: number, width = 2): string => String(n).padStart(width, '0')

/** 纯日历运算：把 (年, 月, 日) 当作一个与时区无关的日历日 */
function calendarDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

/** ISO 星期：1 = 周一 … 7 = 周日 */
function isoWeekday(d: Date): number {
  const w = d.getUTCDay()
  return w === 0 ? 7 : w
}

function dayKey(instant: Date): string {
  const p = zonedParts(instant)
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`
}

function weekKey(instant: Date): string {
  const p = zonedParts(instant)
  const d = calendarDay(p.year, p.month, p.day)
  // ISO 周：本周的周四所在的年就是周年
  const thursday = new Date(d.getTime() + (4 - isoWeekday(d)) * 86_400_000)
  const isoYear = thursday.getUTCFullYear()
  const dayOfYear = (thursday.getTime() - calendarDay(isoYear, 1, 1).getTime()) / 86_400_000
  const week = Math.floor(dayOfYear / 7) + 1
  return `${pad(isoYear, 4)}-W${pad(week)}`
}

/** 北京时间的某个日历日 00:00 对应的时刻。偏移量用 Intl 反推，不手写 +8 */
function zonedMidnight(year: number, month: number, day: number): Date {
  const guess = Date.UTC(year, month - 1, day)
  const p = zonedParts(new Date(guess))
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  const offset = asIfUtc - guess
  return new Date(guess - offset)
}

// ---------- 临时实现结束 ----------

/** 当前额度周期键：北京时间 ISO 周，如 '2026-W44' */
export function quotaPeriodKey(now: Date): string {
  return weekKey(now)
}

/** 本周期结束时刻：下周一 00:00 北京时间 */
export function quotaPeriodEndsAt(now: Date): Date {
  const p = zonedParts(now)
  const today = calendarDay(p.year, p.month, p.day)
  const nextMonday = new Date(today.getTime() + (8 - isoWeekday(today)) * 86_400_000)
  return zonedMidnight(
    nextMonday.getUTCFullYear(),
    nextMonday.getUTCMonth() + 1,
    nextMonday.getUTCDate(),
  )
}

/** 全站日上限的日期键：北京时间 'YYYY-MM-DD' */
export function spendDayKey(now: Date): string {
  return dayKey(now)
}
