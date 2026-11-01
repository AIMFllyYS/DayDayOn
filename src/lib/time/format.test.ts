import { describe, expect, it } from 'vitest'
import {
  formatBusinessDateTime,
  formatDateTime,
  formatDuration,
  formatInstantDate,
  formatLocalDateLabel,
  formatMonth,
  formatRelative,
  formatTime,
} from './format'

const SH = 'Asia/Shanghai'
const NY = 'America/New_York'

describe('本地日期显示', () => {
  it("'10月31日 周六'", () => {
    expect(formatLocalDateLabel('2026-10-31')).toBe('10月31日 周六')
    expect(formatLocalDateLabel('2026-11-02')).toBe('11月2日 周一')
  })

  it("'2026年10月'", () => {
    expect(formatMonth('2026-10')).toBe('2026年10月')
  })
})

describe('时刻显示', () => {
  it('按给定时区显示 HH:mm', () => {
    expect(formatTime('2026-10-31T15:30:00Z', SH)).toBe('23:30')
    expect(formatTime('2026-10-31T16:00:00Z', SH)).toBe('00:00')
    expect(formatTime('2026-10-31T15:30:00Z', NY)).toBe('11:30')
  })

  it('日期按时区的日历日', () => {
    expect(formatInstantDate('2026-10-31T16:30:00Z', SH)).toBe('11月1日 周日')
    expect(formatInstantDate('2026-10-31T16:30:00Z', NY)).toBe('10月31日 周六')
  })

  it('日期 + 时间', () => {
    expect(formatDateTime('2026-11-02T10:00:00Z', SH)).toBe('11月2日 18:00')
    expect(formatBusinessDateTime('2026-11-01T16:00:00Z')).toBe('11月2日 00:00')
  })
})

describe('formatDuration', () => {
  it("'1小时30分'、'30分钟'、'8小时'", () => {
    expect(formatDuration(5400)).toBe('1小时30分')
    expect(formatDuration(1800)).toBe('30分钟')
    expect(formatDuration(28_800)).toBe('8小时')
    expect(formatDuration(45)).toBe('45秒')
    expect(formatDuration(0)).toBe('0分钟')
    expect(formatDuration(-10)).toBe('0分钟')
    expect(formatDuration(119)).toBe('1分钟')
  })
})

describe('formatRelative', () => {
  const now = '2026-10-31T12:00:00Z'

  it("'刚刚'、'3分钟前'、'2小时前'", () => {
    expect(formatRelative('2026-10-31T11:59:30Z', now, SH)).toBe('刚刚')
    expect(formatRelative('2026-10-31T11:57:00Z', now, SH)).toBe('3分钟前')
    expect(formatRelative('2026-10-31T10:00:00Z', now, SH)).toBe('2小时前')
  })

  it("'昨天'、'3天前'，超过 7 天显示日期", () => {
    expect(formatRelative('2026-10-30T12:00:00Z', now, SH)).toBe('昨天')
    expect(formatRelative('2026-10-28T12:00:00Z', now, SH)).toBe('3天前')
    expect(formatRelative('2026-10-20T12:00:00Z', now, SH)).toBe('10月20日 周二')
  })

  it('未来的时刻', () => {
    expect(formatRelative('2026-10-31T12:03:00Z', now, SH)).toBe('3分钟后')
  })
})
