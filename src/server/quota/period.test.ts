import { describe, expect, it } from 'vitest'
import { quotaPeriodEndsAt, quotaPeriodKey, spendDayKey } from './period'

describe('quotaPeriodKey', () => {
  it('北京时间周日 23:59:59 仍属于本周', () => {
    // 2026-11-01 是周日；北京时间 23:59:59 = UTC 15:59:59
    expect(quotaPeriodKey(new Date('2026-11-01T15:59:59Z'))).toBe('2026-W44')
  })

  it('北京时间周一 00:00:00 进入下一周', () => {
    expect(quotaPeriodKey(new Date('2026-11-01T16:00:00Z'))).toBe('2026-W45')
  })

  it('跨年 ISO 周：2026-01-01（周四）属于 2026-W01', () => {
    expect(quotaPeriodKey(new Date('2026-01-01T04:00:00Z'))).toBe('2026-W01')
  })

  it('跨年 ISO 周：2027-01-01（周五）属于 2026-W53', () => {
    expect(quotaPeriodKey(new Date('2027-01-01T04:00:00Z'))).toBe('2026-W53')
  })

  it('跨年 ISO 周：2024-12-30（周一）属于 2025-W01', () => {
    expect(quotaPeriodKey(new Date('2024-12-30T04:00:00Z'))).toBe('2025-W01')
  })
})

describe('quotaPeriodEndsAt', () => {
  it('周三的周期在下周一 00:00 北京时间结束', () => {
    // 2026-10-28 周三
    expect(quotaPeriodEndsAt(new Date('2026-10-28T04:00:00Z')).toISOString()).toBe(
      '2026-11-01T16:00:00.000Z',
    )
  })

  it('周一 00:00 整开始的周期在 7 天后结束', () => {
    expect(quotaPeriodEndsAt(new Date('2026-11-01T16:00:00Z')).toISOString()).toBe(
      '2026-11-08T16:00:00.000Z',
    )
  })

  it('周日 23:59:59 的周期在 1 秒后结束', () => {
    expect(quotaPeriodEndsAt(new Date('2026-11-01T15:59:59Z')).toISOString()).toBe(
      '2026-11-01T16:00:00.000Z',
    )
  })
})

describe('spendDayKey', () => {
  it('跨午夜：北京时间 23:59 与 00:00', () => {
    expect(spendDayKey(new Date('2026-10-31T15:59:00Z'))).toBe('2026-10-31')
    expect(spendDayKey(new Date('2026-10-31T16:00:00Z'))).toBe('2026-11-01')
  })
})
