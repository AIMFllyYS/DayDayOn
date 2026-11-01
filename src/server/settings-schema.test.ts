import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, mergeSettings } from './settings-schema'

describe('mergeSettings', () => {
  it('没有任何行时返回默认值', () => {
    expect(mergeSettings([])).toEqual(DEFAULT_SETTINGS)
  })

  it('合法的行覆盖默认值', () => {
    const s = mergeSettings([
      { key: 'aiPaused', value: true },
      { key: 'aiHourlyLimit', value: 30 },
    ])
    expect(s.aiPaused).toBe(true)
    expect(s.aiHourlyLimit).toBe(30)
    expect(s.weeklyQuotaMicros).toBe(DEFAULT_SETTINGS.weeklyQuotaMicros)
  })

  it('非法值和未知键被忽略', () => {
    const s = mergeSettings([
      { key: 'aiHourlyLimit', value: -1 },
      { key: 'unknown', value: 1 },
    ])
    expect(s).toEqual(DEFAULT_SETTINGS)
  })
})
