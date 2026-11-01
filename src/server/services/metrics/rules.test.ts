import { describe, expect, it } from 'vitest'
import { isWeightInRange, needsWeightConfirm, weightSummary } from './rules'

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
