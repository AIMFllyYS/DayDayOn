import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountState } from '@/server/auth/account-state'

/*
 * D6 的路由（/me/quota、/me/ai-runs、/ai/diet-recognitions、/redeem-codes/redeem）：
 * 会话、限流、幂等、service 全部 mock，不连数据库（testing.md 第 3 节）。
 */

const mocks = vi.hoisted(() => ({
  session: null as { user: { id: string; role: string }; session: { id: string } } | null,
  recognize: vi.fn(),
  redeem: vi.fn(),
  quota: vi.fn(),
  runs: vi.fn(),
}))

vi.mock('@/server/auth/session', () => ({ getSessionFromHeaders: async () => mocks.session }))
vi.mock('@/server/auth/account-state', () => ({
  loadAccountState: async (): Promise<AccountState | null> =>
    mocks.session
      ? { banned: false, banReason: null, banExpires: null, onboardedAt: new Date(0) }
      : null,
}))
vi.mock('@/server/rate-limit', () => ({
  consume: async () => ({ ok: true, count: 1, retryAfterSeconds: 0 }),
}))
vi.mock('../middleware/idempotency', async () => {
  const { createMiddleware } = await import('hono/factory')
  return { idempotency: () => createMiddleware(async (_c, next) => next()) }
})
vi.mock('@/server/db/client', () => ({ db: {} }))
vi.mock('@/server/services/diet-recognition', () => ({ recognizeDiet: mocks.recognize }))
vi.mock('@/server/services/redeem', () => ({ redeemCode: mocks.redeem }))
vi.mock('@/server/services/quota-view', () => ({
  getQuotaView: mocks.quota,
  listAiRuns: mocks.runs,
}))

const { aiRoutes } = await import('./ai')
const { quotaRoutes } = await import('./quota')
const { redeemRoutes } = await import('./redeem')
const { ApiError } = await import('../errors')

const KEY = '0193f6b2-0000-7000-8000-000000000001'

function jpegForm(): FormData {
  const bytes = new Uint8Array(16)
  bytes.set([0xff, 0xd8, 0xff])
  const form = new FormData()
  form.append('image', new File([bytes], 'meal.jpg', { type: 'image/jpeg' }))
  form.append('mealType', 'lunch')
  return form
}

beforeEach(() => {
  mocks.session = null
  mocks.recognize.mockReset()
  mocks.redeem.mockReset()
  mocks.quota.mockReset()
  mocks.runs.mockReset()
})

function login() {
  mocks.session = { user: { id: 'u1', role: 'user' }, session: { id: 's1' } }
}

describe('未登录：401 UNAUTHENTICATED', () => {
  it('GET /me/quota', async () => {
    const res = await quotaRoutes.request('/me/quota')
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  it('GET /me/ai-runs', async () => {
    expect((await quotaRoutes.request('/me/ai-runs')).status).toBe(401)
  })

  it('POST /ai/diet-recognitions（不调用 service）', async () => {
    const res = await aiRoutes.request('/ai/diet-recognitions', {
      method: 'POST',
      body: jpegForm(),
      headers: { 'idempotency-key': KEY },
    })
    expect(res.status).toBe(401)
    expect(mocks.recognize).not.toHaveBeenCalled()
  })

  it('POST /redeem-codes/redeem（不调用 service）', async () => {
    const res = await redeemRoutes.request('/redeem-codes/redeem', {
      method: 'POST',
      body: JSON.stringify({ code: 'DDON-AAAA-BBBB-CCCC' }),
      headers: { 'content-type': 'application/json', 'idempotency-key': KEY },
    })
    expect(res.status).toBe(401)
    expect(mocks.redeem).not.toHaveBeenCalled()
  })
})

describe('已登录', () => {
  it('识别：multipart 交给 service，201 返回草稿', async () => {
    login()
    const result = {
      aiRunId: KEY,
      draft: {
        items: [
          {
            name: '米饭',
            portion: '一碗',
            lowKcal: 160,
            highKcal: 180,
            proteinGrams: null,
            fatGrams: null,
            carbGrams: null,
          },
        ],
        totalLowKcal: 160,
        totalHighKcal: 180,
        confidence: 0.9,
        summary: '一碗米饭',
      },
    }
    mocks.recognize.mockResolvedValue(result)
    const res = await aiRoutes.request('/ai/diet-recognitions', {
      method: 'POST',
      body: jpegForm(),
      headers: { 'idempotency-key': KEY },
    })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual(result)
    const arg = mocks.recognize.mock.calls[0]?.[0] as {
      userId: string
      idempotencyKey: string
      image: unknown
      fields: unknown
    }
    expect(arg.userId).toBe('u1')
    expect(arg.idempotencyKey).toBe(KEY)
    expect(arg.image).toBeInstanceOf(File)
    expect(arg.fields).toEqual({ mealType: 'lunch', note: undefined })
  })

  it('识别：非法餐次 400 VALIDATION_FAILED', async () => {
    login()
    const form = jpegForm()
    form.set('mealType', 'brunch')
    const res = await aiRoutes.request('/ai/diet-recognitions', {
      method: 'POST',
      body: form,
      headers: { 'idempotency-key': KEY },
    })
    expect(res.status).toBe(400)
    expect(mocks.recognize).not.toHaveBeenCalled()
  })

  it('识别：超过 4 MB 的请求体 413 PAYLOAD_TOO_LARGE', async () => {
    login()
    const form = new FormData()
    form.append(
      'image',
      new File([new Uint8Array(4 * 1024 * 1024 + 100 * 1024)], 'big.jpg', { type: 'image/jpeg' }),
    )
    const res = await aiRoutes.request('/ai/diet-recognitions', {
      method: 'POST',
      body: form,
      headers: { 'idempotency-key': KEY },
    })
    expect(res.status).toBe(413)
    expect(await res.json()).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' })
  })

  it('兑换锁定：经根应用返回 429 REDEEM_LOCKED + Retry-After', async () => {
    login()
    mocks.redeem.mockRejectedValue(
      new ApiError('REDEEM_LOCKED', '锁定', { retryAfterSeconds: 600 }),
    )
    const { app } = await import('../app')
    const res = await app.request('/api/v1/redeem-codes/redeem', {
      method: 'POST',
      body: JSON.stringify({ code: 'DDON-AAAA-BBBB-CCCC' }),
      headers: { 'content-type': 'application/json', 'idempotency-key': KEY },
    })
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('600')
    expect(await res.json()).toMatchObject({ code: 'REDEEM_LOCKED', retryAfterSeconds: 600 })
    expect(mocks.redeem).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', body: { code: 'DDON-AAAA-BBBB-CCCC' } }),
    )
  })

  it('GET /me/quota 返回 service 的 DTO', async () => {
    login()
    const view = {
      periodKey: '2026-W44',
      weeklyLimitMicros: 10_000_000,
      weeklyUsedMicros: 0,
      weeklyRemainingMicros: 10_000_000,
      bonusMicros: 0,
      reservedMicros: 0,
      periodEndsAt: '2026-11-01T16:00:00.000Z',
    }
    mocks.quota.mockResolvedValue(view)
    const res = await quotaRoutes.request('/me/quota')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(view)
  })
})
