import { describe, expect, it } from 'vitest'
import { birthYearOptions, DAY_START_OPTIONS, kgToGrams, timeZoneOptions } from './units'

describe('kgToGrams', () => {
  it('千克一位小数 → 整克，消除浮点误差', () => {
    expect(kgToGrams(62.5)).toBe(62_500)
    expect(kgToGrams(70.1)).toBe(70_100)
    expect(kgToGrams(0.3 + 0.6)).toBe(900)
  })

  it('空值保持 null', () => {
    expect(kgToGrams(null)).toBeNull()
    expect(kgToGrams(Number.NaN)).toBeNull()
  })
})

describe('timeZoneOptions', () => {
  it('当前时区在常用表里：不重复', () => {
    const list = timeZoneOptions('Asia/Shanghai')
    expect(list.filter((z) => z.value === 'Asia/Shanghai')).toHaveLength(1)
  })

  it('当前时区不在常用表里：补到最前面', () => {
    expect(timeZoneOptions('Pacific/Auckland')[0]).toEqual({
      value: 'Pacific/Auckland',
      label: 'Pacific/Auckland',
    })
  })
})

describe('选项表', () => {
  it('日切换时间只有 0–6 点', () => {
    expect(DAY_START_OPTIONS.map((o) => o.value)).toEqual(['0', '1', '2', '3', '4', '5', '6'])
  })

  it('出生年份落在 schema 允许的 1900–2100 内', () => {
    const years = birthYearOptions(2026).map((o) => Number(o.value))
    expect(Math.max(...years)).toBe(2016)
    expect(Math.min(...years)).toBeGreaterThanOrEqual(1900)
  })
})
