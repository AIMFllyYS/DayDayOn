import { describe, expect, it } from 'vitest'
import {
  buildCalendarXTicks,
  findNearestTrendIndex,
  normalizeTrendPoints,
  splitTrendSegments,
} from './trend-line-chart-math'

describe('TrendLineChart 纯日历比例计算', () => {
  it('过滤窗口外与非有限值、同日去重并按真实日历偏移升序排列', () => {
    const pts = normalizeTrendPoints(
      [
        { date: '2025-11-01', value: 65.0 }, // 窗口前，忽略
        { date: '2026-11-26', value: 62.1 },
        { date: '2026-01-01', value: Number.NaN }, // 非有限，忽略
        { date: '2026-05-01', value: 63.4 },
        { date: '2026-05-01', value: 63.1 }, // 同日覆盖
        { date: '2026-12-01', value: 61.9 }, // 窗口后，忽略
      ],
      '2025-11-27',
      '2026-11-26',
    )
    expect(pts).toEqual([
      { date: '2026-05-01', value: 63.1, dayOffset: 155 },
      { date: '2026-11-26', value: 62.1, dayOffset: 364 },
    ])
  })

  it('相邻点间隔超过 30 天时拆段并生成虚线桥接点对', () => {
    const pts = normalizeTrendPoints(
      [
        { date: '2026-01-01', value: 4 },
        { date: '2026-01-20', value: 5 },
        { date: '2026-03-10', value: 3 }, // 与 01-20 相差 49 天 > 30
        { date: '2026-03-25', value: 4 },
        { date: '2026-06-01', value: 2 }, // 与 03-25 相差 68 天 > 30（单点段）
      ],
      '2025-11-27',
      '2026-11-26',
    )
    const { segments, gaps } = splitTrendSegments(pts, 30)
    expect(segments.map((s) => s.map((p) => p.date))).toEqual([
      ['2026-01-01', '2026-01-20'],
      ['2026-03-10', '2026-03-25'],
      ['2026-06-01'],
    ])
    expect(gaps.map(([a, b]) => [a.date, b.date])).toEqual([
      ['2026-01-20', '2026-03-10'],
      ['2026-03-25', '2026-06-01'],
    ])
  })

  it('跨年 365 天窗口生成清晰月份横轴刻度，首刻度标注年份前缀', () => {
    const ticks = buildCalendarXTicks('2025-11-27', '2026-11-26', 5)
    expect(ticks).toHaveLength(5)
    expect(ticks[0]).toEqual({ dayOffset: 0, label: '25/11月' })
    expect(ticks.at(-1)).toEqual({ dayOffset: 364, label: '11月' })
  })

  it('查找距离目标日历偏移最近的已记录点', () => {
    const pts = normalizeTrendPoints(
      [
        { date: '2026-01-01', value: 64 },
        { date: '2026-06-01', value: 63 },
        { date: '2026-11-01', value: 62 },
      ],
      '2025-11-27',
      '2026-11-26',
    )
    expect(findNearestTrendIndex([], 10)).toBeNull()
    expect(findNearestTrendIndex(pts, 40)).toBe(0)
    expect(findNearestTrendIndex(pts, 180)).toBe(1)
    expect(findNearestTrendIndex(pts, 350)).toBe(2)
  })
})
