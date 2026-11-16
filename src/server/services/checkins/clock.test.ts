import { describe, expect, it, vi } from 'vitest'
import type { DbOrTx } from '@/server/db/client'
import { loadClock, PROFILE_DEFAULT_DAY_START_HOUR } from './clock'

function mockClockDb(rows: Array<{ timeZone: string; dayStartHour: number }>) {
  const selectSpy = vi.fn()
  const limit = vi.fn().mockResolvedValue(rows)
  const where = vi.fn().mockReturnValue({ limit })
  const from = vi.fn().mockReturnValue({ where })
  const select = vi.fn((cols: Record<string, unknown>) => {
    selectSpy(cols)
    return { from }
  })
  return { db: { select } as unknown as DbOrTx, selectSpy }
}

describe('loadClock', () => {
  it('同时查询 timeZone 与 dayStartHour，并正确保留 dayStartHour = 0', async () => {
    const { db, selectSpy } = mockClockDb([{ timeZone: 'America/New_York', dayStartHour: 0 }])
    const clock = await loadClock(db, 'user-0')

    expect(selectSpy).toHaveBeenCalledTimes(1)
    expect(Object.keys(selectSpy.mock.calls[0]?.[0] ?? {})).toEqual(
      expect.arrayContaining(['timeZone', 'dayStartHour']),
    )
    expect(clock).toEqual({ timeZone: 'America/New_York', dayStartHour: 0 })
  })

  it('读取用户配置的 dayStartHour = 4 / 6', async () => {
    const { db: db4 } = mockClockDb([{ timeZone: 'Asia/Shanghai', dayStartHour: 4 }])
    expect(await loadClock(db4, 'user-4')).toEqual({
      timeZone: 'Asia/Shanghai',
      dayStartHour: 4,
    })

    const { db: db6 } = mockClockDb([{ timeZone: 'Asia/Tokyo', dayStartHour: 6 }])
    expect(await loadClock(db6, 'user-6')).toEqual({
      timeZone: 'Asia/Tokyo',
      dayStartHour: 6,
    })
  })

  it('无 profile 行时回落到 Asia/Shanghai 与 profiles 默认的 4 点换日', async () => {
    const { db } = mockClockDb([])
    expect(PROFILE_DEFAULT_DAY_START_HOUR).toBe(4)
    expect(await loadClock(db, 'missing-user')).toEqual({
      timeZone: 'Asia/Shanghai',
      dayStartHour: 4,
    })
  })
})
