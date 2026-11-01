/*
 * 图表用的比例尺：几行线性映射，不引入 d3-scale（ui-primitives.md 第 7 节）。
 * 纯函数，带单测（scale.test.ts）。
 */

export type Extent = readonly [min: number, max: number]

/** 线性映射：domain → range。domain 退化成一个点时映射到 range 中点，避免除以 0 */
export function linearScale(domain: Extent, range: Extent): (v: number) => number {
  const [d0, d1] = domain
  const [r0, r1] = range
  const span = d1 - d0
  if (span === 0 || !Number.isFinite(span)) {
    const mid = (r0 + r1) / 2
    return () => mid
  }
  return (v) => r0 + ((v - d0) / span) * (r1 - r0)
}

/** 数据的最小、最大值；空数组或全是非有限值时返回 null */
export function extentOf(values: readonly number[]): Extent | null {
  let min = Infinity
  let max = -Infinity
  for (const v of values) {
    if (!Number.isFinite(v)) continue
    if (v < min) min = v
    if (v > max) max = v
  }
  return min === Infinity ? null : [min, max]
}

/**
 * 给 y 轴留白：上下各加 padRatio 倍的跨度；所有值相同时上下各留 minPad，
 * 这样一条水平线不会贴着图表边缘。
 */
export function paddedExtent(extent: Extent, padRatio = 0.15, minPad = 1): Extent {
  const [min, max] = extent
  const pad = Math.max((max - min) * padRatio, max === min ? minPad : 0)
  return [min - pad, max + pad]
}

/** 在 [min, max] 之间等分出 count 个刻度（含两端） */
export function ticks(extent: Extent, count: number): number[] {
  const [min, max] = extent
  if (count <= 1 || min === max) return [min]
  const step = (max - min) / (count - 1)
  return Array.from({ length: count }, (_, i) => min + step * i)
}
