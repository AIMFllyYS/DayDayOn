import { describe, expect, it } from 'vitest'
import { computeStreak } from '@/server/services/stats'
import { streakReachesWindow } from './streaks'

describe('streakReachesWindow', () => {
  const today = '2026-11-01'

  it('连续天数为 0：不需要扩大窗口', () => {
    expect(streakReachesWindow(0, new Set(), today, '2026-10-01')).toBe(false)
  })

  it('连续天数没碰到窗口起点：不扩大', () => {
    const dates = new Set(['2026-11-01', '2026-10-31', '2026-10-30'])
    const streak = computeStreak([...dates], today)
    expect(streak).toBe(3)
    expect(streakReachesWindow(streak, dates, today, '2026-10-29')).toBe(false)
  })

  it('连续天数数到了窗口起点：需要扩大', () => {
    const dates = new Set(['2026-11-01', '2026-10-31', '2026-10-30'])
    expect(streakReachesWindow(3, dates, today, '2026-10-30')).toBe(true)
  })

  it('今天还没打卡时从昨天往回数', () => {
    const dates = new Set(['2026-10-31', '2026-10-30'])
    const streak = computeStreak([...dates], today)
    expect(streak).toBe(2)
    expect(streakReachesWindow(streak, dates, today, '2026-10-30')).toBe(true)
    expect(streakReachesWindow(streak, dates, today, '2026-10-29')).toBe(false)
  })
})
