import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountState } from '@/server/auth/account-state'

/*
 * GET /rank、GET /rank/feed 的鉴权与入参校验（testing.md 第 1 节）：
 * 会话层与 service 层 mock，不连数据库、不初始化 Better Auth。
 */

const mocks = vi.hoisted(() => ({
  session: null as { user: { id: string }; session: { id: string } } | null,
  state: null as AccountState | null,
  getRankBoard: vi.fn(),
  getRankFeed: vi.fn(),
}))

vi.mock('@/server/auth/session', () => ({ getSessionFromHeaders: async () => mocks.session }))
vi.mock('@/server/auth/account-state', () => ({ loadAccountState: async () => mocks.state }))
vi.mock('@/server/db/client', () => ({ db: {} }))
vi.mock('@/server/services/rank', () => ({
  getRankBoard: mocks.getRankBoard,
  getRankFeed: mocks.getRankFeed,
}))

const { rankRoutes } = await import('./rank')

function login() {
  mocks.session = { user: { id: 'u1' }, session: { id: 's1' } }
  mocks.state = { banned: false, banReason: null, banExpires: null, onboardedAt: new Date(0) }
}

beforeEach(() => {
  mocks.session = null
  mocks.state = null
  mocks.getRankBoard.mockReset()
  mocks.getRankFeed.mockReset()
})

describe('GET /rank', () => {
  it('没登录：401 UNAUTHENTICATED，不调用 service', async () => {
    const res = await rankRoutes.request('/rank?range=week')
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
    expect(mocks.getRankBoard).not.toHaveBeenCalled()
  })

  it('非法 range：400（接口不静默回落，页面才回落）', async () => {
    login()
    const res = await rankRoutes.request('/rank?range=year')
    expect(res.status).toBe(400)
    expect(mocks.getRankBoard).not.toHaveBeenCalled()
  })

  it('不带 range 默认 week，按当前用户调用 service', async () => {
    login()
    const board = {
      range: 'week',
      from: '2026-10-26',
      to: '2026-11-01',
      entries: [],
      me: { optedIn: false },
    }
    mocks.getRankBoard.mockResolvedValue(board)
    const res = await rankRoutes.request('/rank')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(board)
    expect(mocks.getRankBoard).toHaveBeenCalledWith({}, 'u1', 'week', expect.any(Date))
  })
})

describe('GET /rank/feed', () => {
  it('没登录：401', async () => {
    const res = await rankRoutes.request('/rank/feed')
    expect(res.status).toBe(401)
    expect(mocks.getRankFeed).not.toHaveBeenCalled()
  })

  it('未完成引导：403 ONBOARDING_REQUIRED', async () => {
    login()
    mocks.state = { banned: false, banReason: null, banExpires: null, onboardedAt: null }
    const res = await rankRoutes.request('/rank/feed')
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'ONBOARDING_REQUIRED' })
  })
})
