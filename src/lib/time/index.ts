/*
 * 日期与时区的唯一入口（time-and-dates.md 第 3 节）。业务代码只从 '@/lib/time' 导入，
 * 不直接 import date-fns / @date-fns/tz（ESLint 拦截）。前后端通用，不含 server-only。
 */
export {
  isLocalDate,
  parseLocalDate,
  parseLocalTime,
  toInstant,
  type InstantInput,
  type LocalDateParts,
  type LocalDateString,
  type LocalTimeString,
} from './parse'
export {
  addDays,
  compareLocalDate,
  daysBetween,
  eachLocalDate,
  isoWeekday,
  startOfWeekDate,
  weekDates,
} from './local-date'
export {
  BUSINESS_TIME_ZONE,
  DEFAULT_DAY_START_HOUR,
  calendarDateOf,
  combineLocal,
  combineLocalDateTime,
  dayKey,
  isValidTimeZone,
  localDateOf,
  localTimeOf,
  monthKey,
  monthRange,
  nextDayStartsAt,
  nextWeekStartsAt,
  secondsBetween,
  sleepRange,
  sleepRangeForDay,
  toLocalDateTimeValue,
  weekKey,
  weekRange,
  type LocalDateRange,
  type SleepRange,
} from './zone'
export {
  formatBusinessDateTime,
  formatDateTime,
  formatDuration,
  formatInstantDate,
  formatLocalDateLabel,
  formatMonth,
  formatMonthDay,
  formatRelative,
  formatTime,
  formatWeekday,
} from './format'
