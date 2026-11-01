import { describe, expect, it } from 'vitest'
import { restoredOpening, TOMBSTONE_TTL_MS, tombstoneExpired } from './tombstone'

const snapshot = {
  periodKey: '2026-W44',
  weeklyLimitMicros: 10_000_000,
  weeklyUsedMicros: 9_500_000,
}

describe('restoredOpening', () => {
  it('没有注销记录：按新账号发放', () => {
    expect(restoredOpening(null, '2026-W44', 2_000_000)).toEqual({
      weeklyLimitMicros: 2_000_000,
      weeklyUsedMicros: 0,
      restored: false,
    })
  })

  it('同一周内注销再注册：沿用注销前的上限和已用，不再发新额度', () => {
    expect(restoredOpening(snapshot, '2026-W44', 2_000_000)).toEqual({
      weeklyLimitMicros: 10_000_000,
      weeklyUsedMicros: 9_500_000,
      restored: true,
    })
  })

  it('已用超过上限（预占中注销）：按上限封顶', () => {
    expect(
      restoredOpening({ ...snapshot, weeklyUsedMicros: 12_000_000 }, '2026-W44', 2_000_000),
    ).toMatchObject({ weeklyUsedMicros: 10_000_000 })
  })

  it('注销前上限比新账号额度还小：取较小的，不因注销变多', () => {
    expect(
      restoredOpening(
        { ...snapshot, weeklyLimitMicros: 1_000_000, weeklyUsedMicros: 0 },
        '2026-W44',
        2_000_000,
      ),
    ).toMatchObject({ weeklyLimitMicros: 1_000_000, restored: true })
  })

  it('跨周再注册：新的一周本来就该重置，但已经注册过，不再给新账号额度以外的东西', () => {
    expect(restoredOpening(snapshot, '2026-W45', 2_000_000)).toEqual({
      weeklyLimitMicros: 2_000_000,
      weeklyUsedMicros: 0,
      restored: false,
    })
  })
})

describe('tombstoneExpired', () => {
  const deletedAt = new Date('2026-11-01T00:00:00Z')
  it('保留期内不过期', () => {
    expect(tombstoneExpired(deletedAt, new Date(deletedAt.getTime() + TOMBSTONE_TTL_MS - 1))).toBe(
      false,
    )
  })
  it('超过保留期过期', () => {
    expect(tombstoneExpired(deletedAt, new Date(deletedAt.getTime() + TOMBSTONE_TTL_MS))).toBe(true)
  })
})
