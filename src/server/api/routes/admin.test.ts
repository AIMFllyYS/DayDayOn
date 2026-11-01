import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountState } from '@/server/auth/account-state'

/*
 * 后台接口的鉴权与入参（testing.md 第 1 节）。会话层、service 层都 mock：不连数据库、不初始化 Better Auth。
 */

interface FakeUser {
  id: string
  role: string | null
  twoFactorEnabled: boolean | null
  banned: boolean | null
}

const mocks = vi.hoisted(() => ({
  session: null as { user: FakeUser; session: { id: string } } | null,
  state: null as AccountState | null,
}))

vi.mock('@/server/auth/session', () => ({ getSessionFromHeaders: async () => mocks.session }))
vi.mock('@/server/auth/account-state', () => ({ loadAccountState: async () => mocks.state }))
vi.mock('@/server/db/client', () => ({
  db: { transaction: async (fn: (tx: object) => unknown) => fn({}) },
}))
vi.mock('@/server/services/admin', () => ({
  getOverview: vi.fn(async () => ({
    dayKey: '2026-11-01',
    todaySpentMicros: 0,
    dailySpendCapMicros: 10_000_000,
    aiPaused: false,
    capReached: false,
    spendSeries: [],
    anomalies: [],
  })),
  setAiPaused: vi.fn(async (_tx: object, _admin: string, paused: boolean) => ({
    aiPaused: paused,
    capReached: false,
  })),
  listUsers: vi.fn(async () => ({ items: [], total: 0 })),
  adjustUserQuota: vi.fn(async (_tx: object, _admin: string, userId: string) => ({
    userId,
    bonusMicros: 5_000_000,
  })),
  listCodes: vi.fn(async () => ({ items: [], total: 0 })),
  generateCodes: vi.fn(),
  voidCode: vi.fn(),
  readSettings: vi.fn(),
  writeSettings: vi.fn(),
}))

const { adminRoutes } = await import('./admin')
const services = await import('@/server/services/admin')

function login(over: Partial<FakeUser> = {}) {
  mocks.session = {
    user: { id: 'admin-1', role: 'admin', twoFactorEnabled: true, banned: false, ...over },
    session: { id: 's1' },
  }
  mocks.state = { banned: false, banReason: null, banExpires: null, onboardedAt: null }
}

beforeEach(() => {
  mocks.session = null
  mocks.state = null
  vi.clearAllMocks()
})

const GET_PATHS = ['/admin/overview', '/admin/users', '/admin/redeem-codes', '/admin/settings']

describe('后台接口鉴权', () => {
  it.each(GET_PATHS)('GET %s 没登录：401', async (path) => {
    const res = await adminRoutes.request(path)
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  it.each(['/admin/ai/pause', '/admin/ai/resume', '/admin/redeem-codes/x/void'])(
    'POST %s 没登录：401',
    async (path) => {
      expect((await adminRoutes.request(path, { method: 'POST' })).status).toBe(401)
    },
  )

  it('普通用户：403 FORBIDDEN', async () => {
    login({ role: 'user' })
    const res = await adminRoutes.request('/admin/overview')
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'FORBIDDEN' })
  })

  it('管理员没开两步验证：403 TWO_FACTOR_REQUIRED', async () => {
    login({ twoFactorEnabled: false })
    const res = await adminRoutes.request('/admin/overview')
    expect(await res.json()).toMatchObject({ code: 'TWO_FACTOR_REQUIRED' })
  })

  it('管理员（未完成引导也可以）：200', async () => {
    login()
    const res = await adminRoutes.request('/admin/overview')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ dayKey: '2026-11-01', aiPaused: false })
  })
})

describe('后台接口入参', () => {
  it('暂停 / 恢复把当前管理员传给 service', async () => {
    login()
    const res = await adminRoutes.request('/admin/ai/resume', { method: 'POST' })
    expect(await res.json()).toEqual({ aiPaused: false, capReached: false })
    expect(services.setAiPaused).toHaveBeenCalledWith({}, 'admin-1', false, expect.any(Date))
  })

  it('用户列表：查询参数带默认值', async () => {
    login()
    await adminRoutes.request('/admin/users?q=qq.com')
    expect(services.listUsers).toHaveBeenCalledWith(
      expect.anything(),
      { q: 'qq.com', offset: 0, limit: 20 },
      expect.any(Date),
    )
  })

  it('用户列表：limit 超过 100 返回 400', async () => {
    login()
    const res = await adminRoutes.request('/admin/users?limit=500')
    expect(res.status).toBe(400)
  })

  it('调额度：金额为 0 返回 400，不调 service', async () => {
    login()
    const res = await adminRoutes.request('/admin/users/u9/quota-adjustments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amountMicros: 0, reason: '补偿' }),
    })
    expect(res.status).toBe(400)
    expect(services.adjustUserQuota).not.toHaveBeenCalled()
  })

  it('调额度：合法请求返回新的加购余额', async () => {
    login()
    const res = await adminRoutes.request('/admin/users/u9/quota-adjustments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amountMicros: 5_000_000, reason: '补偿' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ userId: 'u9', bonusMicros: 5_000_000 })
  })

  it('批量生成：没有幂等键返回 400', async () => {
    login()
    const res = await adminRoutes.request('/admin/redeem-codes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ count: 3 }),
    })
    expect(res.status).toBe(400)
    expect(services.generateCodes).not.toHaveBeenCalled()
  })

  it('作废：codeId 不是 uuid 返回 400', async () => {
    login()
    const res = await adminRoutes.request('/admin/redeem-codes/abc/void', { method: 'POST' })
    expect(res.status).toBe(400)
    expect(services.voidCode).not.toHaveBeenCalled()
  })
})
