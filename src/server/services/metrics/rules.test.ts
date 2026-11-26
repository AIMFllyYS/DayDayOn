import { describe, expect, it } from 'vitest'
import { ApiError } from '@/server/api/errors'
import {
  assertMetricDeleteAllowed,
  isStepsInRange,
  isWeightInRange,
  isWithinTodayOrYesterday,
  needsWeightConfirm,
  ratingSummary,
  resolveMetricTargetDate,
  stepSummary,
  weightSummary,
} from './rules'

describe('体重范围', () => {
  it('20–300 kg 含两端，按整克', () => {
    expect(isWeightInRange(20_000)).toBe(true)
    expect(isWeightInRange(300_000)).toBe(true)
    expect(isWeightInRange(19_999)).toBe(false)
    expect(isWeightInRange(300_001)).toBe(false)
    expect(isWeightInRange(60_000.5)).toBe(false)
  })
})

describe('大幅变化确认', () => {
  it('超过 3 kg 才需要确认，正好 3 kg 不需要', () => {
    expect(needsWeightConfirm(60_000, 63_000)).toBe(false)
    expect(needsWeightConfirm(60_000, 63_001)).toBe(true)
    expect(needsWeightConfirm(60_000, 56_900)).toBe(true)
  })

  it('没有上一条不需要确认', () => {
    expect(needsWeightConfirm(null, 120_000)).toBe(false)
  })
})

describe('体重走势摘要', () => {
  const e = (localDate: string, weightGrams: number) => ({
    localDate,
    weightGrams,
    measuredAt: `${localDate}T00:00:00.000Z`,
  })

  it('和 7 天前（含之前最近一条）比较', () => {
    const s = weightSummary(
      [e('2026-10-20', 61_000), e('2026-10-24', 60_500), e('2026-11-01', 60_000)],
      '2026-10-26',
    )
    expect(s.latest?.weightGrams).toBe(60_000)
    // 11-01 往前 7 天是 10-25，取 10-24 那条
    expect(s.deltaGrams7d).toBe(-500)
    expect(s.entries.map((x) => x.localDate)).toEqual(['2026-11-01'])
  })

  it('没有 7 天前的记录时差值为 null', () => {
    expect(
      weightSummary([e('2026-10-30', 60_000), e('2026-11-01', 60_200)], '2026-10-01').deltaGrams7d,
    ).toBeNull()
  })
})

describe('心情与满意度走势摘要', () => {
  it('空记录返回 latest/average 为 null 且 count 为 0', () => {
    expect(ratingSummary('overall', [])).toEqual({
      scope: 'overall',
      entries: [],
      latest: null,
      average: null,
      count: 0,
    })
  })

  it('按升序记录计算最近一条、记录天数与保留一位小数的均分', () => {
    const res = ratingSummary('overall', [
      { localDate: '2026-02-10', value: 3 },
      { localDate: '2026-06-15', value: 4 },
      { localDate: '2026-11-26', value: 5 },
    ])
    expect(res.count).toBe(3)
    expect(res.latest).toEqual({ localDate: '2026-11-26', value: 5 })
    expect(res.average).toBe(4)

    const fractional = ratingSummary('overall', [
      { localDate: '2026-11-24', value: 4 },
      { localDate: '2026-11-25', value: 5 },
      { localDate: '2026-11-26', value: 4 },
    ])
    expect(fractional.average).toBe(4.3)
  })
})

describe('步数范围与走势摘要', () => {
  const s = (localDate: string, steps: number) => ({
    localDate,
    steps,
    measuredAt: `${localDate}T00:00:00.000Z`,
  })

  it('0–200000 步含两端，按整数', () => {
    expect(isStepsInRange(0)).toBe(true)
    expect(isStepsInRange(200_000)).toBe(true)
    expect(isStepsInRange(-1)).toBe(false)
    expect(isStepsInRange(200_001)).toBe(false)
    expect(isStepsInRange(100.5)).toBe(false)
  })

  it('无记录或今日未记录时 todaySteps 恒为 0', () => {
    const empty = stepSummary([], '2026-10-26', '2026-11-01')
    expect(empty.todaySteps).toBe(0)
    expect(empty.latest).toBeNull()

    const noToday = stepSummary([s('2026-10-31', 5400)], '2026-10-26', '2026-11-01')
    expect(noToday.todaySteps).toBe(0)
    expect(noToday.latest?.steps).toBe(5400)
  })

  it('有今日记录时返回今日步数及 7 天差值', () => {
    const res = stepSummary(
      [s('2026-10-24', 6000), s('2026-11-01', 8500)],
      '2026-10-26',
      '2026-11-01',
    )
    expect(res.todaySteps).toBe(8500)
    expect(res.deltaSteps7d).toBe(2500)
  })
})

describe('每日指标今日/昨日读写与删除窗口', () => {
  const clock = { timeZone: 'Asia/Shanghai', dayStartHour: 4 }
  const now = new Date('2026-11-05T06:00:00.000Z') // 北京 14:00，今天 2026-11-05，昨天 2026-11-04

  it('isWithinTodayOrYesterday 仅允许今天和昨天', () => {
    expect(isWithinTodayOrYesterday('2026-11-05', '2026-11-05')).toBe(true)
    expect(isWithinTodayOrYesterday('2026-11-04', '2026-11-05')).toBe(true)
    expect(isWithinTodayOrYesterday('2026-11-03', '2026-11-05')).toBe(false)
    expect(isWithinTodayOrYesterday('2026-11-06', '2026-11-05')).toBe(false)
  })

  it('resolveMetricTargetDate 缺省返回今天，传入昨天返回昨天且拒绝前天或未来', () => {
    expect(resolveMetricTargetDate(clock, now).localDate).toBe('2026-11-05')
    expect(resolveMetricTargetDate(clock, now, '2026-11-05').localDate).toBe('2026-11-05')
    const y = resolveMetricTargetDate(clock, now, '2026-11-04')
    expect(y.localDate).toBe('2026-11-04')
    expect(y.measuredAt.toISOString()).toBe('2026-11-04T04:00:00.000Z')

    expect(() => resolveMetricTargetDate(clock, now, '2026-11-03')).toThrow(ApiError)
    expect(() => resolveMetricTargetDate(clock, now, '2026-11-06')).toThrow(ApiError)
  })

  it('assertMetricDeleteAllowed 手动删除放行任意历史日，Agent 删除仅限今日/昨日', () => {
    expect(() => assertMetricDeleteAllowed(clock, now, '2025-01-01', 'manual')).not.toThrow()
    expect(() => assertMetricDeleteAllowed(clock, now, '2026-11-05', 'agent')).not.toThrow()
    expect(() => assertMetricDeleteAllowed(clock, now, '2026-11-04', 'agent')).not.toThrow()
    expect(() => assertMetricDeleteAllowed(clock, now, '2026-11-03', 'agent')).toThrow(ApiError)
  })
})
