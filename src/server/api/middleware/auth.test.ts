import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountState } from '@/server/auth/account-state'
import type { AppEnv } from '../app'
import { ADMIN_ERRORS, AUTH_ERRORS, errorResponses } from '../schemas'

/*
 * requireUser / requireOnboarded / requireAdmin 的分支（auth.md 第 8 节）：用构造的会话对象，
 * 不连数据库、不初始化 Better Auth（session.ts 与 account-state.ts 都被 mock）。
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

vi.mock('@/server/auth/session', () => ({
  getSessionFromHeaders: async () => mocks.session,
}))
vi.mock('@/server/auth/account-state', () => ({
  loadAccountState: async () => mocks.state,
}))

const { requireAdmin, requireOnboarded, requireUser } = await import('./auth')

const okResponse = {
  200: {
    content: { 'application/json': { schema: z.object({ userId: z.string(), ip: z.string() }) } },
    description: 'ok',
  },
}

const meRoute = createRoute({
  method: 'get',
  path: '/probe/me',
  middleware: [requireUser, requireOnboarded] as const,
  responses: { ...okResponse, ...errorResponses(...AUTH_ERRORS) },
})
const adminRoute = createRoute({
  method: 'get',
  path: '/probe/admin',
  middleware: [requireAdmin] as const,
  responses: { ...okResponse, ...errorResponses(...ADMIN_ERRORS) },
})

const probe = new OpenAPIHono<AppEnv>()
  .openapi(meRoute, (c) => c.json({ userId: c.get('user').id, ip: c.get('ip') }, 200))
  .openapi(adminRoute, (c) => c.json({ userId: c.get('user').id, ip: c.get('ip') }, 200))

const user = (over: Partial<FakeUser> = {}): FakeUser => ({
  id: 'u1',
  role: 'user',
  twoFactorEnabled: false,
  banned: false,
  ...over,
})

const state = (over: Partial<AccountState> = {}): AccountState => ({
  banned: false,
  banReason: null,
  banExpires: null,
  onboardedAt: new Date('2026-10-30T00:00:00Z'),
  ...over,
})

function login(u: FakeUser, s: AccountState | null = state()) {
  mocks.session = { user: u, session: { id: 's1' } }
  mocks.state = s
}

beforeEach(() => {
  mocks.session = null
  mocks.state = null
})

describe('requireUser + requireOnboarded', () => {
  it('无会话：401 UNAUTHENTICATED', async () => {
    const res = await probe.request('/probe/me')
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  it('会话残留但用户已注销：401', async () => {
    login(user(), null)
    expect((await probe.request('/probe/me')).status).toBe(401)
  })

  it('被封禁（即使会话缓存里没标记）：403 ACCOUNT_BANNED 带 ban', async () => {
    login(
      user({ banned: false }),
      state({ banned: true, banReason: '刷额度', banExpires: new Date('2099-01-01T00:00:00Z') }),
    )
    const res = await probe.request('/probe/me')
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      code: 'ACCOUNT_BANNED',
      detail: '账号已被停用',
      ban: { reason: '刷额度', expiresAt: '2099-01-01T00:00:00.000Z' },
    })
  })

  it('未完成引导：403 ONBOARDING_REQUIRED', async () => {
    login(user(), state({ onboardedAt: null }))
    const res = await probe.request('/probe/me')
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'ONBOARDING_REQUIRED' })
  })

  it('通过：写入 user 与 ip（只取 x-real-ip，没有时 127.0.0.1）', async () => {
    login(user())
    const res = await probe.request('/probe/me', {
      headers: { 'x-forwarded-for': '6.6.6.6' },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ userId: 'u1', ip: '127.0.0.1' })

    const res2 = await probe.request('/probe/me', { headers: { 'x-real-ip': '1.2.3.4' } })
    expect(await res2.json()).toEqual({ userId: 'u1', ip: '1.2.3.4' })
  })
})

describe('requireAdmin', () => {
  it('无会话：401', async () => {
    expect((await probe.request('/probe/admin')).status).toBe(401)
  })

  it('被封禁：403 ACCOUNT_BANNED', async () => {
    login(user({ role: 'admin', twoFactorEnabled: true }), state({ banned: true }))
    const res = await probe.request('/probe/admin')
    expect(await res.json()).toMatchObject({ code: 'ACCOUNT_BANNED' })
  })

  it('非管理员：403 FORBIDDEN', async () => {
    login(user({ role: 'user', twoFactorEnabled: true }))
    const res = await probe.request('/probe/admin')
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'FORBIDDEN' })
  })

  it('管理员未开两步验证：403 TWO_FACTOR_REQUIRED', async () => {
    login(user({ role: 'admin', twoFactorEnabled: false }))
    const res = await probe.request('/probe/admin')
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'TWO_FACTOR_REQUIRED' })
  })

  it('管理员已开两步验证：通过（不要求完成引导）', async () => {
    login(user({ role: 'admin', twoFactorEnabled: true }), state({ onboardedAt: null }))
    const res = await probe.request('/probe/admin')
    expect(res.status).toBe(200)
  })
})
