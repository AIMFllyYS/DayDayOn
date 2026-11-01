import { describe, expect, it } from 'vitest'
import { formatYuan, microsToYuan, yuanToMicros } from './money'

describe('yuanToMicros', () => {
  it('整数元', () => {
    expect(yuanToMicros(10)).toBe(10_000_000)
    expect(yuanToMicros(0)).toBe(0)
  })

  it('两位小数没有浮点误差', () => {
    expect(yuanToMicros(0.1)).toBe(100_000)
    expect(yuanToMicros(0.07)).toBe(70_000)
    expect(yuanToMicros(19.99)).toBe(19_990_000)
  })

  it('超过两位小数按分四舍五入', () => {
    expect(yuanToMicros(1.006)).toBe(1_010_000)
    expect(yuanToMicros(1.004)).toBe(1_000_000)
    expect(yuanToMicros(0.000_001)).toBe(0)
  })

  it('负数（扣减额度）', () => {
    expect(yuanToMicros(-5)).toBe(-5_000_000)
    expect(yuanToMicros(-0.5)).toBe(-500_000)
  })

  it('非有限数返回 null', () => {
    expect(yuanToMicros(Number.NaN)).toBeNull()
    expect(yuanToMicros(Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('microsToYuan', () => {
  it('来回换算一致', () => {
    for (const m of [0, 70_000, 2_000_000, 10_000_000, 123_450_000]) {
      expect(yuanToMicros(microsToYuan(m))).toBe(m)
    }
  })
})

describe('formatYuan', () => {
  it('两位小数', () => {
    expect(formatYuan(10_000_000)).toBe('¥10.00')
    expect(formatYuan(7_000)).toBe('¥0.01')
    expect(formatYuan(0)).toBe('¥0.00')
  })

  it('signed：正数带加号，负数带减号', () => {
    expect(formatYuan(5_000_000, { signed: true })).toBe('+¥5.00')
    expect(formatYuan(-5_000_000, { signed: true })).toBe('-¥5.00')
    expect(formatYuan(-5_000_000)).toBe('-¥5.00')
    expect(formatYuan(0, { signed: true })).toBe('¥0.00')
  })
})
