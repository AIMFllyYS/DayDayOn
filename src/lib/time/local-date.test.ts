import { describe, expect, it } from 'vitest'
import {
  addDays,
  compareLocalDate,
  daysBetween,
  eachLocalDate,
  isoWeekday,
  startOfWeekDate,
  weekDates,
} from './local-date'
import { isLocalDate, parseLocalDate, parseLocalTime } from './parse'

describe('addDays', () => {
  it('跨月、跨年、闰年', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2026-10-31', 0)).toBe('2026-10-31')
  })

  it('跨美国夏令时也按整天算（与系统时区无关）', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08')
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
  })
})

describe('isoWeekday', () => {
  it('1 = 周一 … 7 = 周日', () => {
    expect(isoWeekday('2026-10-26')).toBe(1)
    expect(isoWeekday('2026-10-31')).toBe(6)
    expect(isoWeekday('2026-11-01')).toBe(7)
  })
})

describe('daysBetween / eachLocalDate', () => {
  it('天数差', () => {
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1)
    expect(daysBetween('2026-11-01', '2026-10-31')).toBe(-1)
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365)
  })

  it('闭区间的每一天', () => {
    expect(eachLocalDate('2026-10-30', '2026-11-01')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ])
    expect(eachLocalDate('2026-11-01', '2026-10-30')).toEqual([])
  })
})

describe('startOfWeekDate / weekDates', () => {
  it('周一开始，周日属于本周', () => {
    expect(startOfWeekDate('2026-11-01')).toBe('2026-10-26')
    expect(startOfWeekDate('2026-11-02')).toBe('2026-11-02')
    expect(startOfWeekDate('2027-01-01')).toBe('2026-12-28')
  })

  it('七天，周一起', () => {
    const days = weekDates('2026-10-31')
    expect(days).toHaveLength(7)
    expect(days[0]).toBe('2026-10-26')
    expect(days[6]).toBe('2026-11-01')
  })
})

describe('compareLocalDate', () => {
  it('按日期先后', () => {
    expect(compareLocalDate('2026-10-31', '2026-11-01')).toBe(-1)
    expect(compareLocalDate('2026-11-01', '2026-11-01')).toBe(0)
    expect(compareLocalDate('2027-01-01', '2026-12-31')).toBe(1)
  })
})

describe('parse', () => {
  it('校验本地日期', () => {
    expect(parseLocalDate('2026-10-31')).toEqual({ year: 2026, month: 10, day: 31 })
    expect(isLocalDate('2028-02-29')).toBe(true)
    expect(isLocalDate('2026-02-29')).toBe(false)
    expect(isLocalDate('2026-13-01')).toBe(false)
    expect(isLocalDate('2026-1-1')).toBe(false)
  })

  it('校验本地时分', () => {
    expect(parseLocalTime('23:59')).toEqual({ hours: 23, minutes: 59 })
    expect(() => parseLocalTime('24:00')).toThrow(RangeError)
    expect(() => parseLocalTime('7:00')).toThrow(RangeError)
  })
})
