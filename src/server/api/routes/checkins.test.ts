import { describe, expect, it, vi } from 'vitest'

/*
 * 打卡与指标接口的鉴权（testing.md 第 1 节）：会话 mock 成"没有会话"，service 层 mock 掉，
 * 不连数据库、不初始化 Better Auth。
 */

const called = vi.hoisted(() => ({ count: 0 }))

vi.mock('@/server/auth/session', () => ({ getSessionFromHeaders: async () => null }))
vi.mock('@/server/auth/account-state', () => ({ loadAccountState: async () => null }))
vi.mock('@/server/services/checkins', () => {
  const touch = async () => {
    called.count += 1
    return {}
  }
  return {
    listCheckins: touch,
    createCheckin: touch,
    goalCalendar: touch,
    checkinToday: touch,
    updateCheckin: touch,
    deleteCheckin: touch,
  }
})
vi.mock('@/server/services/metrics', () => {
  const touch = async () => {
    called.count += 1
    return {}
  }
  return { putWeight: touch, weightTrend: touch, putRating: touch }
})

const { checkinRoutes } = await import('./checkins')
const { metricRoutes } = await import('./metrics')

const goalId = '0193f6b2-0000-7000-8000-000000000001'
const checkinId = '0193f6b2-0000-7000-8000-000000000002'
const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
  body: JSON.stringify(body),
})

describe('没登录：打卡接口一律 401，不调用 service', () => {
  const cases: [string, string, RequestInit?][] = [
    ['GET', `/goals/${goalId}/checkins`],
    ['POST', `/goals/${goalId}/checkins`, jsonInit('POST', { module: 'study', what: '英语' })],
    ['GET', `/goals/${goalId}/calendar?month=2026-11`],
    ['GET', '/checkins/today'],
    ['PATCH', `/checkins/${checkinId}`, jsonInit('PATCH', { note: '好吃' })],
    ['DELETE', `/checkins/${checkinId}`, { method: 'DELETE' }],
  ]
  for (const [method, path, init] of cases) {
    it(`${method} ${path}`, async () => {
      const res = await checkinRoutes.request(path, init ?? { method })
      expect(res.status).toBe(401)
      expect(await res.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
    })
  }
})

describe('没登录：指标接口一律 401', () => {
  it('PUT /metrics/weight', async () => {
    const res = await metricRoutes.request(
      '/metrics/weight',
      jsonInit('PUT', { weightGrams: 60_000 }),
    )
    expect(res.status).toBe(401)
  })
  it('GET /metrics/weight', async () => {
    expect((await metricRoutes.request('/metrics/weight?days=30')).status).toBe(401)
  })
  it('PUT /ratings', async () => {
    const res = await metricRoutes.request(
      '/ratings',
      jsonInit('PUT', { scope: 'overall', value: 4 }),
    )
    expect(res.status).toBe(401)
  })
  it('service 一次都没被调用', () => {
    expect(called.count).toBe(0)
  })
})
