import { describe, expect, it } from 'vitest'
import {
  computeMoodStats,
  computeStepsStats,
  computeWeightStats,
  filterByDays,
  monthlyAverages,
  weekdayAverages,
} from './stats'

describe('metric stats 纯计算引擎', () => {
  it('filterByDays 严格按闭区间切片', () => {
    const rows = [
      { localDate: '2026-10-01', v: 1 },
      { localDate: '2026-10-07', v: 2 },
      { localDate: '2026-11-05', v: 3 },
      { localDate: '2026-11-06', v: 4 },
    ]
    // 含 2026-11-05 往前 30 天起始于 2026-10-07
    expect(filterByDays(rows, '2026-11-05', 30).map((r) => r.localDate)).toEqual([
      '2026-10-07',
      '2026-11-05',
    ])
  })

  it('monthlyAverages 按近 6 个自然月升序汇总', () => {
    const buckets = monthlyAverages(
      [
        { localDate: '2026-09-10', value: 61.0 },
        { localDate: '2026-09-20', value: 60.0 },
        { localDate: '2026-11-02', value: 59.5 },
      ],
      '2026-11-05',
      6,
      1,
    )
    expect(buckets.map((b) => b.month)).toEqual([
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
    ])
    expect(buckets[3]).toEqual({ month: '2026-09', label: '9月', average: 60.5, count: 2 })
    expect(buckets[4]?.average).toBeNull()
    expect(buckets[5]).toEqual({ month: '2026-11', label: '11月', average: 59.5, count: 1 })
  })

  it('weekdayAverages 按周一至周日汇总', () => {
    // 2026-11-02 是周一，2026-11-08 是周日
    const res = weekdayAverages(
      [
        { localDate: '2026-11-02', value: 4 },
        { localDate: '2026-11-09', value: 5 },
        { localDate: '2026-11-08', value: 3 },
      ],
      1,
    )
    expect(res).toHaveLength(7)
    expect(res[0]).toEqual({ weekday: 1, label: '周一', average: 4.5, count: 2 })
    expect(res[6]).toEqual({ weekday: 7, label: '周日', average: 3, count: 1 })
    expect(res[3]?.average).toBeNull()
  })

  it('computeWeightStats 计算极值、净变化与 BMI 参考', () => {
    const stats = computeWeightStats(
      [
        { localDate: '2026-10-10', weightGrams: 62_000 },
        { localDate: '2026-10-20', weightGrams: 60_500 },
        { localDate: '2026-11-05', weightGrams: 60_000 },
      ],
      170,
    )
    expect(stats).toEqual({
      count: 3,
      latestKg: 60,
      minKg: 60,
      maxKg: 62,
      avgKg: 60.8,
      netChangeKg: -2,
      bmi: 20.8,
      bmiLabel: '正常',
    })
  })

  it('computeMoodStats 计算五档分布、好心情占比与连续好心情最长连击', () => {
    const stats = computeMoodStats([
      { localDate: '2026-11-01', value: 4 },
      { localDate: '2026-11-02', value: 5 },
      { localDate: '2026-11-03', value: 2 },
      { localDate: '2026-11-04', value: 4 },
      { localDate: '2026-11-05', value: 4 },
      { localDate: '2026-11-06', value: 5 },
    ])
    expect(stats.count).toBe(6)
    expect(stats.average).toBe(4)
    expect(stats.goodRate).toBe(83)
    expect(stats.longestGoodStreak).toBe(3)
    expect(stats.distribution.find((b) => b.value === 4)?.count).toBe(3)
  })

  it('computeStepsStats 联动参考虚线计算达标天数与估算里程，支持关闭参考线', () => {
    const entries = [
      { localDate: '2026-11-03', steps: 6_000 },
      { localDate: '2026-11-04', steps: 8_000 },
      { localDate: '2026-11-05', steps: 10_000 },
    ]
    const withTarget = computeStepsStats(entries, '2026-11-05', 8000)
    expect(withTarget.totalSteps).toBe(24_000)
    expect(withTarget.avgSteps).toBe(8_000)
    expect(withTarget.maxSteps).toBe(10_000)
    expect(withTarget.maxDate).toBe('2026-11-05')
    expect(withTarget.estimatedKm).toBe(17.3)
    expect(withTarget.reachedDays).toBe(2)
    expect(withTarget.recent14Days).toHaveLength(14)
    expect(withTarget.recent14Days.at(-1)).toEqual({
      localDate: '2026-11-05',
      dayLabel: '5',
      steps: 10_000,
    })

    const hiddenTarget = computeStepsStats(entries, '2026-11-05', null)
    expect(hiddenTarget.reachedDays).toBeNull()
  })
})
