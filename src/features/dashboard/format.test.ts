import { describe, expect, it } from 'vitest'
import {
  completionPercent,
  formatKg,
  formatKgDelta,
  moodLabel,
  progressText,
  stampCaption,
} from './format'

describe('主页显示换算', () => {
  it('克 → 千克一位小数', () => {
    expect(formatKg(52_400)).toBe('52.4')
    expect(formatKg(52_449)).toBe('52.4')
    expect(formatKg(60_000)).toBe('60.0')
  })

  it('体重差值带符号', () => {
    expect(formatKgDelta(-600)).toBe('−0.6')
    expect(formatKgDelta(400)).toBe('+0.4')
    expect(formatKgDelta(40)).toBe('0.0')
  })

  it('进度文字：分钟、小时、餐、次', () => {
    expect(
      progressText({
        module: 'exercise',
        target: { kind: 'duration', value: 1800 },
        progress: { value: 1920, target: 1800, done: true },
      }),
    ).toBe('32 / 30 分钟')
    expect(
      progressText({
        module: 'sleep',
        target: { kind: 'duration', value: 28_800 },
        progress: { value: 25_920, target: 28_800, done: false },
      }),
    ).toBe('7.2 / 8 小时')
    expect(
      progressText({
        module: 'diet',
        target: { kind: 'count', value: 3 },
        progress: { value: 2, target: 3, done: false },
      }),
    ).toBe('2 / 3 餐')
    expect(
      progressText({
        module: 'study',
        target: { kind: 'count', value: 2 },
        progress: { value: 1, target: 2, done: false },
      }),
    ).toBe('1 / 2 次')
  })

  it('印章日期、完成度、心情', () => {
    expect(stampCaption('2026-11-01')).toBe('11.01')
    expect(completionPercent({ done: 3, planned: 4 })).toBe(75)
    expect(completionPercent({ done: 0, planned: 0 })).toBeNull()
    expect(moodLabel(4)).toBe('不错')
    expect(moodLabel(9)).toBe('—')
  })
})
