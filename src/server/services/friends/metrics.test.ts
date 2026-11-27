import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  assertFriendship: vi.fn(),
  loadPublicUsers: vi.fn(),
  weightTrend: vi.fn(),
  ratingTrend: vi.fn(),
  stepTrend: vi.fn(),
  metricCalendar: vi.fn(),
  listMetricHistory: vi.fn(),
}))

vi.mock('./access', () => ({
  assertFriendship: mocks.assertFriendship,
  loadPublicUsers: mocks.loadPublicUsers,
}))

vi.mock('@/server/services/metrics', () => ({
  weightTrend: mocks.weightTrend,
  ratingTrend: mocks.ratingTrend,
  stepTrend: mocks.stepTrend,
  metricCalendar: mocks.metricCalendar,
  listMetricHistory: mocks.listMetricHistory,
}))

const { ApiError } = await import('@/server/api/errors')
const { getFriendMetricCalendar, getFriendMetricDetail, getFriendMetricHistory } =
  await import('./metrics')

function makeProfileDb(profileRow: Record<string, unknown> | null) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (profileRow ? [profileRow] : []),
        }),
      }),
    }),
  }
}

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockReset()
})

describe('friends/metrics 只读查询服务', () => {
  const NOW = new Date('2026-11-26T02:30:00.000Z') // 北京时间 10:30，UTC-5 纽约 21:30（11-25）

  it('非好友访问统一抛 404 FRIEND_NOT_FOUND 且不触发任何指标查询', async () => {
    mocks.assertFriendship.mockRejectedValue(
      new ApiError('FRIEND_NOT_FOUND', 'Friendship not found'),
    )
    const db = makeProfileDb(null)

    await expect(
      getFriendMetricDetail(db as never, 'u1', 'u2', 'weight', NOW),
    ).rejects.toThrowError(expect.objectContaining({ code: 'FRIEND_NOT_FOUND', status: 404 }))
    await expect(
      getFriendMetricCalendar(db as never, 'u1', 'u2', 'steps', '2026-11'),
    ).rejects.toThrowError(expect.objectContaining({ code: 'FRIEND_NOT_FOUND', status: 404 }))
    await expect(
      getFriendMetricHistory(db as never, 'u1', 'u2', 'mood', { limit: 20 }),
    ).rejects.toThrowError(expect.objectContaining({ code: 'FRIEND_NOT_FOUND', status: 404 }))

    expect(mocks.weightTrend).not.toHaveBeenCalled()
    expect(mocks.metricCalendar).not.toHaveBeenCalled()
    expect(mocks.listMetricHistory).not.toHaveBeenCalled()
  })

  it('按好友自身时区算 localDate，透传身高与显式 null 步数参考线，只拉对应 kind 的 365 天走势', async () => {
    mocks.assertFriendship.mockResolvedValue({ createdAt: new Date() })
    mocks.loadPublicUsers.mockResolvedValue(
      new Map([['u2', { userId: 'u2', nickname: '阿柚', avatar: null }]]),
    )
    mocks.weightTrend.mockResolvedValue({
      entries: [{ localDate: '2026-11-25', weightGrams: 58200, measuredAt: NOW.toISOString() }],
      latest: { localDate: '2026-11-25', weightGrams: 58200, measuredAt: NOW.toISOString() },
      deltaGrams7d: -400,
    })

    const db = makeProfileDb({
      timeZone: 'America/New_York',
      dayStartHour: 4,
      heightCm: 165,
      dailyStepTarget: null,
    })

    const res = await getFriendMetricDetail(db as never, 'u1', 'u2', 'weight', NOW)
    expect(res.localDate).toBe('2026-11-25')
    expect(res.heightCm).toBe(165)
    expect(res.dailyStepTarget).toBeNull()
    expect(res.friend).toEqual({ userId: 'u2', nickname: '阿柚', avatar: null })
    expect(res.weight?.latest?.weightGrams).toBe(58200)
    expect(res.mood).toBeUndefined()
    expect(res.steps).toBeUndefined()
    expect(mocks.weightTrend).toHaveBeenCalledWith(db, 'u2', 365, NOW)
    expect(mocks.ratingTrend).not.toHaveBeenCalled()
    expect(mocks.stepTrend).not.toHaveBeenCalled()
  })

  it('好友缺少 profile 行时兜底默认 8000 步参考线', async () => {
    mocks.assertFriendship.mockResolvedValue({ createdAt: new Date() })
    mocks.loadPublicUsers.mockResolvedValue(
      new Map([['u2', { userId: 'u2', nickname: '阿柚', avatar: null }]]),
    )
    mocks.stepTrend.mockResolvedValue({
      entries: [],
      todaySteps: 0,
      latest: null,
      deltaSteps7d: null,
    })

    const res = await getFriendMetricDetail(makeProfileDb(null) as never, 'u1', 'u2', 'steps', NOW)
    expect(res.dailyStepTarget).toBe(8000)
    expect(res.heightCm).toBeNull()
    expect(res.localDate).toBe('2026-11-26')
  })

  it('calendar 与 history 校验好友关系后直接委托给 services/metrics', async () => {
    mocks.assertFriendship.mockResolvedValue({ createdAt: new Date() })
    mocks.metricCalendar.mockResolvedValue({ kind: 'steps', month: '2026-11', days: [] })
    mocks.listMetricHistory.mockResolvedValue({ kind: 'mood', items: [], nextCursor: null })

    const db = makeProfileDb(null)
    await getFriendMetricCalendar(db as never, 'u1', 'u2', 'steps', '2026-11')
    await getFriendMetricHistory(db as never, 'u1', 'u2', 'mood', { limit: 10 })

    expect(mocks.metricCalendar).toHaveBeenCalledWith(db, 'u2', 'steps', '2026-11')
    expect(mocks.listMetricHistory).toHaveBeenCalledWith(db, 'u2', 'mood', { limit: 10 })
  })
})
