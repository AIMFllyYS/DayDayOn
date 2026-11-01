import { describe, expect, it, vi } from 'vitest'

/*
 * GET /dashboard/today 的鉴权（testing.md 第 1 节）：会话层与 service 层 mock，不连数据库。
 */

const mocks = vi.hoisted(() => ({ getDashboardToday: vi.fn() }))

vi.mock('@/server/auth/session', () => ({ getSessionFromHeaders: async () => null }))
vi.mock('@/server/auth/account-state', () => ({ loadAccountState: async () => null }))
vi.mock('@/server/db/client', () => ({ db: {} }))
vi.mock('@/server/services/dashboard', () => ({ getDashboardToday: mocks.getDashboardToday }))

const { dashboardRoutes } = await import('./dashboard')

describe('GET /dashboard/today', () => {
  it('没登录：401 UNAUTHENTICATED，不调用 service', async () => {
    const res = await dashboardRoutes.request('/dashboard/today')
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
    expect(mocks.getDashboardToday).not.toHaveBeenCalled()
  })
})
