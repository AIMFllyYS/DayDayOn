import { describe, expect, it } from 'vitest'
import { heatLevel } from './week-heatmap'

describe('heatLevel', () => {
  it('0 和非法值是第 0 档', () => {
    expect(heatLevel(0)).toBe(0)
    expect(heatLevel(Number.NaN)).toBe(0)
    expect(heatLevel(-1)).toBe(0)
  })
  it('不到一半是第 1 档，一半起是第 2 档', () => {
    expect(heatLevel(0.3)).toBe(1)
    expect(heatLevel(0.5)).toBe(2)
    expect(heatLevel(0.99)).toBe(2)
  })
  it('全部完成是第 3 档', () => {
    expect(heatLevel(1)).toBe(3)
  })
})
