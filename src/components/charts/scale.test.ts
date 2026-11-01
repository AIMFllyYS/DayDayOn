import { describe, expect, it } from 'vitest'
import { extentOf, linearScale, paddedExtent, ticks } from './scale'

describe('linearScale', () => {
  it('把 domain 线性映射到 range', () => {
    const s = linearScale([0, 10], [0, 100])
    expect(s(0)).toBe(0)
    expect(s(5)).toBe(50)
    expect(s(10)).toBe(100)
  })

  it('range 可以反向（SVG 的 y 轴向下）', () => {
    const s = linearScale([50, 60], [100, 0])
    expect(s(50)).toBe(100)
    expect(s(60)).toBe(0)
  })

  it('domain 只有一个点时映射到 range 中点', () => {
    expect(linearScale([3, 3], [0, 100])(3)).toBe(50)
  })
})

describe('extentOf', () => {
  it('跳过非有限值', () => {
    expect(extentOf([3, Number.NaN, 1, 7, Infinity])).toEqual([1, 7])
  })
  it('空数组返回 null', () => {
    expect(extentOf([])).toBeNull()
  })
})

describe('paddedExtent', () => {
  it('上下各留 15% 跨度', () => {
    expect(paddedExtent([50, 60])).toEqual([48.5, 61.5])
  })
  it('值都相同时上下各留 minPad', () => {
    expect(paddedExtent([52, 52], 0.15, 2)).toEqual([50, 54])
  })
  it('非负数据（例如全为 0）下界不低于 0', () => {
    expect(paddedExtent([0, 0], 0.15, 1)).toEqual([0, 1])
  })
})

describe('ticks', () => {
  it('含两端等分', () => {
    expect(ticks([0, 10], 3)).toEqual([0, 5, 10])
  })
  it('退化区间只有一个刻度', () => {
    expect(ticks([4, 4], 3)).toEqual([4])
  })
})
