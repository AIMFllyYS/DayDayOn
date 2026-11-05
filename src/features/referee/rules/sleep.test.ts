import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES } from '../defaults'
import { bedtimeAxis, judgeSleep } from './sleep'

const ctx = { rules: DEFAULT_RULES.sleep, tier: 'balanced-glycemic' as const, facts: null }

describe('睡眠双门槛', () => {
  it('A 23:15 → 07:10：有效', () => {
    const v = judgeSleep({ bedLocal: '23:15', wakeLocal: '07:10', minutes: 475 }, ctx)
    expect(v.isValid).toBe(true)
  })

  it('B 02:15 → 10:30：睡够了但熬夜补觉', () => {
    const v = judgeSleep({ bedLocal: '02:15', wakeLocal: '10:30', minutes: 495 }, ctx)
    expect(v.isValid).toBe(false)
    expect(v.detail).toContain('熬夜补觉')
    expect(v.metrics.lateByMinutes).toBe(165)
  })

  it('C 23:05 → 03:30：按时但太短', () => {
    const v = judgeSleep({ bedLocal: '23:05', wakeLocal: '03:30', minutes: 265 }, ctx)
    expect(v.isValid).toBe(false)
    expect(v.checks.map((c) => c.ok)).toEqual([true, false])
  })

  it('D 22:40 → 06:20：早睡早起', () => {
    expect(judgeSleep({ bedLocal: '22:40', wakeLocal: '06:20', minutes: 460 }, ctx).isValid).toBe(
      true,
    )
  })

  it('跨午夜的红线：00:30 红线下 00:10 入睡算按时', () => {
    const late = { ...ctx, rules: { ...DEFAULT_RULES.sleep, bedtimeBy: '00:30' } }
    expect(judgeSleep({ bedLocal: '00:10', wakeLocal: '08:00', minutes: 470 }, late).isValid).toBe(
      true,
    )
    expect(bedtimeAxis('00:30')).toBe(30 + 1440)
    expect(bedtimeAxis('23:30')).toBe(23 * 60 + 30)
  })
})
