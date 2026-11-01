import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountState } from '@/server/auth/account-state'

/*
 * routes/me.ts 的接口测试（testing.md 第 1、3 节）：会话、账号状态、service 层全部 mock，
 * 不连数据库、不初始化 Better Auth。只验证鉴权、免引导检查的范围、入参校验和 handler 的转发。
 */

const mocks = vi.hoisted(() => ({
  session: null as { user: { id: string }; session: { id: string } } | null,
  state: null as AccountState | null,
  getMe: vi.fn(),
  updateProfile: vi.fn(),
  updatePreferences: vi.fn(),
  exportMyData: vi.fn(),
  deleteAccount: vi.fn(),
  completeOnboarding: vi.fn(),
}))

vi.mock('@/server/auth/session', () => ({ getSessionFromHeaders: async () => mocks.session }))
vi.mock('@/server/auth/account-state', () => ({ loadAccountState: async () => mocks.state }))
vi.mock('@/server/db/client', () => ({
  db: { transaction: (fn: (tx: unknown) => unknown) => fn({}) },
}))
vi.mock('@/server/services/me', () => ({
  getMe: mocks.getMe,
  updateProfile: mocks.updateProfile,
  updatePreferences: mocks.updatePreferences,
  exportMyData: mocks.exportMyData,
  deleteAccount: mocks.deleteAccount,
}))
vi.mock('@/server/services/onboarding', () => ({ completeOnboarding: mocks.completeOnboarding }))
vi.mock('../middleware/idempotency', () => ({
  idempotency: () => async (_c: unknown, next: () => Promise<void>) => next(),
}))

const { meRoutes } = await import('./me')

const ME = {
  userId: 'u1',
  email: 'xiaoman@hust.edu.cn',
  role: 'user',
  twoFactorEnabled: false,
  onboarded: true,
  profile: {
    nickname: '小满',
    avatar: null,
    gender: null,
    birthYear: null,
    heightCm: null,
    timeZone: 'Asia/Shanghai',
  },
  preferences: {
    theme: 'caramel',
    mascot: 'tuan',
    leaderboardOptIn: false,
    dayStartHour: 4,
    remindAt: null,
  },
  streak: 3,
  createdAt: '2026-10-30T00:00:00.000Z',
}

function login(onboardedAt: Date | null = new Date('2026-10-30T00:00:00Z')) {
  mocks.session = { user: { id: 'u1' }, session: { id: 's1' } }
  mocks.state = { banned: false, banReason: null, banExpires: null, onboardedAt }
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: {
      'content-type': 'application/json',
      'idempotency-key': '0193f6b2-0000-7000-8000-000000000000',
    },
    body: JSON.stringify(body),
  }
}

const ONBOARDING = { nickname: '小满', modules: ['exercise'], healthConsent: true }

beforeEach(() => {
  mocks.session = null
  mocks.state = null
  vi.clearAllMocks()
  mocks.getMe.mockResolvedValue(ME)
  mocks.updateProfile.mockResolvedValue(ME)
  mocks.updatePreferences.mockResolvedValue(ME)
  mocks.completeOnboarding.mockResolvedValue(ME)
  mocks.deleteAccount.mockResolvedValue(undefined)
  mocks.exportMyData.mockResolvedValue({
    data: {
      exportedAt: '2026-11-01T00:00:00.000Z',
      me: ME,
      goals: [],
      checkins: [],
      weights: [],
      ratings: [],
      todos: [],
    },
    localDate: '2026-11-01',
  })
})

describe('没登录：每个接口都是 401', () => {
  const cases: [string, string, RequestInit?][] = [
    ['GET', '/me'],
    ['POST', '/me/onboarding', json('POST', ONBOARDING)],
    ['PATCH', '/me/profile', json('PATCH', { nickname: '阿柚' })],
    ['PATCH', '/me/preferences', json('PATCH', { theme: 'matcha' })],
    ['GET', '/me/export'],
    ['DELETE', '/me', json('DELETE', { confirm: '注销' })],
  ]
  it.each(cases)('%s %s', async (_m, path, init) => {
    const res = await meRoutes.request(path, init)
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
  })
})

describe('免引导检查的范围（PRD 7.1）', () => {
  beforeEach(() => login(null))

  it('GET /me、GET /me/export、DELETE /me 不要求完成引导', async () => {
    expect((await meRoutes.request('/me')).status).toBe(200)
    expect((await meRoutes.request('/me/export')).status).toBe(200)
    expect((await meRoutes.request('/me', json('DELETE', { confirm: '注销' }))).status).toBe(204)
  })

  it('POST /me/onboarding 不要求完成引导', async () => {
    const res = await meRoutes.request('/me/onboarding', json('POST', ONBOARDING))
    expect(res.status).toBe(200)
    expect(mocks.completeOnboarding).toHaveBeenCalledOnce()
  })

  it('PATCH /me/profile、/me/preferences 要求完成引导：403 ONBOARDING_REQUIRED', async () => {
    const a = await meRoutes.request('/me/profile', json('PATCH', { nickname: '阿柚' }))
    const b = await meRoutes.request('/me/preferences', json('PATCH', { theme: 'matcha' }))
    expect(a.status).toBe(403)
    expect(b.status).toBe(403)
    expect(await a.json()).toMatchObject({ code: 'ONBOARDING_REQUIRED' })
  })
})

describe('已登录', () => {
  beforeEach(() => login())

  it('GET /me 返回 service 的 DTO', async () => {
    const res = await meRoutes.request('/me')
    expect(await res.json()).toEqual(ME)
    expect(mocks.getMe.mock.calls[0]?.[1]).toBe('u1')
  })

  it('引导缺少健康数据同意：400，不调用 service', async () => {
    const res = await meRoutes.request(
      '/me/onboarding',
      json('POST', { ...ONBOARDING, healthConsent: false }),
    )
    expect(res.status).toBe(400)
    expect(mocks.completeOnboarding).not.toHaveBeenCalled()
  })

  it('引导的默认值由 schema 补齐后交给 service', async () => {
    await meRoutes.request('/me/onboarding', json('POST', ONBOARDING))
    const input = mocks.completeOnboarding.mock.calls[0]?.[2]
    expect(input).toMatchObject({
      nickname: '小满',
      avatar: null,
      weightGrams: null,
      timeZone: 'Asia/Shanghai',
      leaderboardOptIn: false,
    })
  })

  it('改偏好：日切换时间超出 0–6 点是 400', async () => {
    const res = await meRoutes.request('/me/preferences', json('PATCH', { dayStartHour: 7 }))
    expect(res.status).toBe(400)
  })

  it('改资料：空对象是 400', async () => {
    const res = await meRoutes.request('/me/profile', json('PATCH', {}))
    expect(res.status).toBe(400)
  })

  it('导出带附件头', async () => {
    const res = await meRoutes.request('/me/export')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="daydayon-export-2026-11-01.json"',
    )
  })

  it('注销必须输入"注销"', async () => {
    const res = await meRoutes.request('/me', json('DELETE', { confirm: '删除' }))
    expect(res.status).toBe(400)
    expect(mocks.deleteAccount).not.toHaveBeenCalled()
    const ok = await meRoutes.request('/me', json('DELETE', { confirm: '注销' }))
    expect(ok.status).toBe(204)
    expect(mocks.deleteAccount.mock.calls[0]?.[1]).toBe('u1')
  })
})
