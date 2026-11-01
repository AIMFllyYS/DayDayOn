import { describe, expect, it } from 'vitest'
import { fitWithinPixels, MAX_PIXELS } from './size'

describe('fitWithinPixels', () => {
  it('小图原样返回，不放大', () => {
    expect(fitWithinPixels({ width: 800, height: 600 })).toEqual({ width: 800, height: 600 })
    expect(fitWithinPixels({ width: 1300, height: 1300 })).toEqual({ width: 1300, height: 1300 })
  })

  it('手机照片 4032×3024 等比缩到像素总量以内', () => {
    const r = fitWithinPixels({ width: 4032, height: 3024 })
    expect(r.width * r.height).toBeLessThanOrEqual(MAX_PIXELS)
    expect(r.width / r.height).toBeCloseTo(4 / 3, 2)
    expect(r.width).toBe(1501)
    expect(r.height).toBe(1125)
  })

  it('竖图同样等比', () => {
    const r = fitWithinPixels({ width: 3024, height: 4032 })
    expect(r).toEqual({ width: 1125, height: 1501 })
  })

  it('极端长宽比也不超上限，至少 1 像素', () => {
    const r = fitWithinPixels({ width: 100_000, height: 20 })
    expect(r.width * r.height).toBeLessThanOrEqual(MAX_PIXELS)
    expect(r.height).toBeGreaterThanOrEqual(1)
    const thin = fitWithinPixels({ width: 10_000_000, height: 1 })
    expect(thin).toEqual({ width: MAX_PIXELS, height: 1 })
    const tall = fitWithinPixels({ width: 1, height: 10_000_000 })
    expect(tall).toEqual({ width: 1, height: MAX_PIXELS })
  })

  it('自定义上限', () => {
    expect(fitWithinPixels({ width: 200, height: 100 }, 5000)).toEqual({ width: 100, height: 50 })
  })

  it('无效尺寸抛 RangeError', () => {
    expect(() => fitWithinPixels({ width: 0, height: 100 })).toThrow(RangeError)
    expect(() => fitWithinPixels({ width: Number.NaN, height: 100 })).toThrow(RangeError)
    expect(() => fitWithinPixels({ width: Infinity, height: 100 })).toThrow(RangeError)
  })
})
