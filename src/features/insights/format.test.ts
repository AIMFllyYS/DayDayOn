import { describe, expect, it } from 'vitest'
import { clockText, durationParts, insightView } from './format'
import type { GoalInsight } from './schemas'

const base: GoalInsight = {
  goalId: 'g1',
  module: 'diet',
  title: '好好吃饭',
  total: 0,
  valid: 0,
  validDays: 0,
  avgScore: null,
  passScore: null,
  totalSeconds: 0,
  dailyTargetSeconds: null,
  kcal: null,
  avgSleepSeconds: null,
  avgBedMinutes: null,
  lateNights: null,
  bedtimeBy: null,
  minSleepSeconds: null,
  series: [],
  topFailure: null,
  deadline: null,
}

describe('durationParts / clockText', () => {
  it('不到 1 小时按分钟，否则一位小数小时', () => {
    expect(durationParts(600)).toEqual({ value: '10', unit: '分钟' })
    expect(durationParts(4200)).toEqual({ value: '1.2', unit: '小时' })
    expect(durationParts(-5)).toEqual({ value: '0', unit: '分钟' })
  })
  it('分钟 → HH:mm，越过 24 点回绕', () => {
    expect(clockText(1410)).toBe('23:30')
    expect(clockText(0)).toBe('00:00')
    expect(clockText(1470)).toBe('00:30')
  })
})

describe('insightView', () => {
  it('没打卡：空状态、无达标率', () => {
    const v = insightView(base, 7)
    expect(v.empty).toBe(true)
    expect(v.rate).toBeNull()
    expect(v.value).toBe('—')
  })

  it('饮食：平均分、有效线做门槛、最常卡住的规则', () => {
    const v = insightView(
      {
        ...base,
        total: 4,
        valid: 3,
        avgScore: 3.6,
        passScore: 3,
        kcal: 620,
        topFailure: { text: '钠 ≤ 1500mg', count: 2, of: 4 },
        series: [{ date: '2026-11-05', value: 3.6 }],
      },
      7,
    )
    expect(v.value).toBe('3.6')
    expect(v.rate).toBe('达标 3/4')
    expect(v.rateTone).toBe('warning')
    expect(v.threshold).toBe(3)
    expect(v.note).toContain('每餐约 620 千卡')
    expect(v.failure).toBe('最常卡在：钠 ≤ 1500mg（2/4 次）')
  })

  it('睡眠：小时一位小数、平均入睡时刻、门槛按最少时长', () => {
    const v = insightView(
      {
        ...base,
        module: 'sleep',
        total: 2,
        valid: 2,
        avgSleepSeconds: 27000,
        avgBedMinutes: 1400,
        lateNights: 1,
        bedtimeBy: '23:30',
        minSleepSeconds: 23400,
        series: [{ date: '2026-11-05', value: 27000 }],
      },
      7,
    )
    expect(v.value).toBe('7.5')
    expect(v.unit).toBe('小时')
    expect(v.note).toBe('平均 23:20 入睡 · 1 晚晚于 23:30')
    expect(v.threshold).toBe(6.5)
    expect(v.bars).toEqual([7.5])
  })

  it('期限：剩余天数 / 已到', () => {
    expect(
      insightView({ ...base, deadline: { date: '2026-11-15', daysLeft: 10 } }, 7).deadline,
    ).toBe('距期限还有 10 天')
    expect(
      insightView({ ...base, deadline: { date: '2026-11-01', daysLeft: 0 } }, 7).deadline,
    ).toBe('期限已到')
  })
})
