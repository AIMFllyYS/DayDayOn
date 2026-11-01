import { describe, expect, it } from 'vitest'
import { formatSpanMinutes, timeRangeSpan } from './time-range-field'

describe('timeRangeSpan', () => {
  it('23:30 入睡 07:00 起床跨过午夜，共 7 小时 30 分', () => {
    expect(timeRangeSpan('23:30', '07:00')).toEqual({ minutes: 450, nextDay: true })
  })

  it('同一天内的午睡不算次日', () => {
    expect(timeRangeSpan('13:00', '14:20')).toEqual({ minutes: 80, nextDay: false })
  })

  it('23:59 到 00:00 是次日的 1 分钟', () => {
    expect(timeRangeSpan('23:59', '00:00')).toEqual({ minutes: 1, nextDay: true })
  })

  it('00:00 到 23:59 不跨午夜', () => {
    expect(timeRangeSpan('00:00', '23:59')).toEqual({ minutes: 1439, nextDay: false })
  })

  it('入睡等于起床视为输入错误', () => {
    expect(timeRangeSpan('22:00', '22:00')).toBeNull()
  })

  it('没填或格式不对返回 null', () => {
    expect(timeRangeSpan('', '07:00')).toBeNull()
    expect(timeRangeSpan('24:00', '07:00')).toBeNull()
    expect(timeRangeSpan('7:00', '08:00')).toBeNull()
  })
})

describe('formatSpanMinutes', () => {
  it('小时和分钟', () => {
    expect(formatSpanMinutes(450)).toBe('7小时30分')
  })
  it('整点省略分钟', () => {
    expect(formatSpanMinutes(480)).toBe('8小时')
  })
  it('不足 1 小时只写分钟', () => {
    expect(formatSpanMinutes(45)).toBe('45分钟')
  })
})
