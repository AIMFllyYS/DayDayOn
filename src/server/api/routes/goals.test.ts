import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountState } from '@/server/auth/account-state'
import { ApiError } from '../errors'

/*
 * 目标接口的鉴权、入参校验与错误码（testing.md 第 1 节）。
 * 会话层与 service 层都 mock：不连数据库、不初始化 Better Auth。
 */

const mocks = vi.hoisted(() => ({
  session: null as { user: { id: string }; session: { id: string } } | null,
  state: null as AccountState | null,
  listGoals: vi.fn(),
  getGoal: vi.fn(),
  deleteGoal: vi.fn(),
}))

vi.mock('@/server/auth/session', () => ({ getSessionFromHeaders: async () => mocks.session }))
vi.mock('@/server/auth/account-state', () => ({ loadAccountState: async () => mocks.state }))
vi.mock('@/server/db/client', () => ({
  db: { transaction: async (fn: (tx: unknown) => unknown) => fn({}) },
}))
vi.mock('@/server/services/goals', () => ({
  listGoals: mocks.listGoals,
  getGoal: mocks.getGoal,
  deleteGoal: mocks.deleteGoal,
  createGoalForUser: vi.fn(),
  updateGoal: vi.fn(),
}))

const { goalRoutes } = await import('./goals')

const GOAL_ID = '0193f6b2-0000-7000-8000-000000000001'

function login() {
  mocks.session = { user: { id: 'u1' }, session: { id: 's1' } }
  mocks.state = {
    banned: false,
    banReason: null,
    banExpires: null,
    onboardedAt: new Date('2026-10-30T00:00:00Z'),
  }
}

beforeEach(() => {
  mocks.session = null
  mocks.state = null
  vi.clearAllMocks()
})

describe('目标接口', () => {
  it('没登录：每个接口都是 401', async () => {
    const requests: [string, RequestInit?][] = [
      ['/goals'],
      ['/goals', { method: 'POST' }],
      [`/goals/${GOAL_ID}`],
      [`/goals/${GOAL_ID}`, { method: 'PATCH' }],
      [`/goals/${GOAL_ID}`, { method: 'DELETE' }],
    ]
    for (const [path, init] of requests) {
      const res = await goalRoutes.request(path, init)
      expect(res.status, `${init?.method ?? 'GET'} ${path}`).toBe(401)
      expect(await res.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
    }
    expect(mocks.listGoals).not.toHaveBeenCalled()
  })

  it('列表：status 默认 active，按当前用户查询', async () => {
    login()
    mocks.listGoals.mockResolvedValue({ items: [] })
    const res = await goalRoutes.request('/goals')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ items: [] })
    expect(mocks.listGoals).toHaveBeenCalledWith(expect.anything(), 'u1', { status: 'active' })
  })

  it('列表：非法 status 返回 400', async () => {
    login()
    const res = await goalRoutes.request('/goals?status=deleted')
    expect(res.status).toBe(400)
  })

  it('详情：不存在或不属于自己时 404 GOAL_NOT_FOUND', async () => {
    login()
    mocks.getGoal.mockRejectedValue(new ApiError('GOAL_NOT_FOUND', '目标不存在'))
    const { app } = await import('../app')
    const res = await app.request(`/api/v1/goals/${GOAL_ID}`)
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'GOAL_NOT_FOUND' })
  })

  it('删除：成功返回 204', async () => {
    login()
    mocks.deleteGoal.mockResolvedValue(undefined)
    // 直接请求子应用：根应用的 CSRF 中间件要读 env，单测不加载 .env
    const res = await goalRoutes.request(`/goals/${GOAL_ID}`, { method: 'DELETE' })
    expect(res.status).toBe(204)
    expect(mocks.deleteGoal).toHaveBeenCalledWith(expect.anything(), 'u1', GOAL_ID)
  })
})
