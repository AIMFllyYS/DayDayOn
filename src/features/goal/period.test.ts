import { describe, expect, it } from 'vitest'
import {
  computeOverallPeriod,
  daysFromDeadline,
  deadlineFromDays,
  goalPeriodProgress,
} from './period'

describe('goal period helpers', () => {
  it('deadlineFromDays 与 daysFromDeadline 互为闭区间逆运算（第 1 天即 startDate）', () => {
    expect(deadlineFromDays('2026-11-01', 1)).toBe('2026-11-01')
    expect(deadlineFromDays('2026-11-01', 21)).toBe('2026-11-21')
    expect(daysFromDeadline('2026-11-01', '2026-11-21')).toBe(21)
    expect(daysFromDeadline('2026-11-10', '2026-11-01')).toBe(1)
  })

  it('goalPeriodProgress：设了截止日期按总天数，未设按阶段里程碑', () => {
    expect(goalPeriodProgress(5, '2026-11-01', '2026-11-21')).toEqual({ done: 5, total: 21 })
    expect(goalPeriodProgress(0, '2026-11-01', null)).toEqual({ done: 0, total: 7 })
    expect(goalPeriodProgress(7, '2026-11-01', null)).toEqual({ done: 7, total: 14 })
    expect(goalPeriodProgress(14, '2026-11-01', null)).toEqual({ done: 14, total: 21 })
  })

  it('computeOverallPeriod：多目标时取最晚有效截止日期与最早起始日计算总坚持天数', () => {
    expect(
      computeOverallPeriod({
        checkedDays: 8,
        startDate: '2026-11-01',
        deadlineDates: [null, '2026-11-21', '2026-11-30'],
      }),
    ).toEqual({
      checkedDays: 8,
      targetDays: 30,
      startDate: '2026-11-01',
      deadlineDate: '2026-11-30',
      hasDeadline: true,
    })
  })

  it('computeOverallPeriod：未设任何截止日期或已早于起始日时回落到里程碑', () => {
    expect(
      computeOverallPeriod({
        checkedDays: 10,
        startDate: '2026-11-01',
        deadlineDates: [null],
      }),
    ).toEqual({
      checkedDays: 10,
      targetDays: 14,
      startDate: '2026-11-01',
      deadlineDate: null,
      hasDeadline: false,
    })
  })
})
