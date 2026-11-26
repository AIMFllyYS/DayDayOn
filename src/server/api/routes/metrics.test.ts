import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountState } from '@/server/auth/account-state'
import { ApiError } from '@/server/api/errors'

/*
 * routes/metrics.ts 的接口测试（testing.md 第 1、3 节）：
 * 覆盖权重/心情/步数今日昨日写入、手动与 Agent 删除、游标分页历史与月度日历的参数校验与转发。
 */

const mocks = vi.hoisted(() => ({
  session: null as { user: { id: string }; session: { id: string } } | null,
  state: null as AccountState | null,
  putWeight: vi.fn(),
  weightTrend: vi.fn(),
  deleteWeight: vi.fn(),
  putRating: vi.fn(),
  ratingTrend: vi.fn(),
  deleteRating: vi.fn(),
  putSteps: vi.fn(),
  stepTrend: vi.fn(),
  deleteSteps: vi.fn(),
  listMetricHistory: vi.fn(),
  metricCalendar: vi.fn(),
}))

vi.mock('@/server/auth/session', () => ({ getSessionFromHeaders: async () => mocks.session }))
vi.mock('@/server/auth/account-state', () => ({ loadAccountState: async () => mocks.state }))
vi.mock('@/server/db/client', () => ({ db: {} }))
vi.mock('@/server/services/metrics', () => ({
  putWeight: mocks.putWeight,
  weightTrend: mocks.weightTrend,
  deleteWeight: mocks.deleteWeight,
  putRating: mocks.putRating,
  ratingTrend: mocks.ratingTrend,
  deleteRating: mocks.deleteRating,
  putSteps: mocks.putSteps,
  stepTrend: mocks.stepTrend,
  deleteSteps: mocks.deleteSteps,
  listMetricHistory: mocks.listMetricHistory,
  metricCalendar: mocks.metricCalendar,
}))

const { OpenAPIHono } = await import('@hono/zod-openapi')
const { metricRoutes } = await import('./metrics')

const app = new OpenAPIHono()
  .onError((err, c) => {
    if (err instanceof ApiError) return c.json(err.toBody(), err.status)
    return c.json({ code: 'INTERNAL', detail: 'internal' }, 500)
  })
  .route('/', metricRoutes)

function login() {
  mocks.session = { user: { id: 'u1' }, session: { id: 's1' } }
  mocks.state = {
    banned: false,
    banReason: null,
    banExpires: null,
    onboardedAt: new Date('2026-10-30T00:00:00Z'),
  }
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }
}

beforeEach(() => {
  mocks.session = null
  mocks.state = null
  vi.clearAllMocks()
})

describe('routes/metrics.ts', () => {
  it('未登录调用新增端点全部返回 401', async () => {
    const cases: [string, RequestInit?][] = [
      ['/metrics/weight/2026-11-04', { method: 'DELETE' }],
      ['/ratings/2026-11-04?scope=overall', { method: 'DELETE' }],
      ['/metrics/steps/2026-11-04', { method: 'DELETE' }],
      ['/metrics/steps/history'],
      ['/metrics/mood/calendar?month=2026-11'],
    ]
    for (const [path, init] of cases) {
      const res = await app.request(path, init)
      expect(res.status).toBe(401)
    }
  })

  it('PUT /metrics/steps 透传可选 localDate（昨日补记）', async () => {
    login()
    mocks.putSteps.mockResolvedValue({
      localDate: '2026-11-04',
      steps: 9200,
      measuredAt: '2026-11-04T04:00:00.000Z',
    })
    const res = await app.request(
      '/metrics/steps',
      json('PUT', { steps: 9200, localDate: '2026-11-04' }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ localDate: '2026-11-04', steps: 9200 })
    expect(mocks.putSteps).toHaveBeenCalledWith(
      expect.anything(),
      'u1',
      { steps: 9200, localDate: '2026-11-04' },
      expect.any(Date),
    )
  })

  it('DELETE /metrics/weight/{localDate}?origin=agent 转发 origin 并透传 MAKEUP_NOT_ALLOWED', async () => {
    login()
    mocks.deleteWeight.mockResolvedValueOnce(undefined)
    const ok = await app.request('/metrics/weight/2026-11-04?origin=agent', { method: 'DELETE' })
    expect(ok.status).toBe(204)
    expect(mocks.deleteWeight).toHaveBeenCalledWith(
      expect.anything(),
      'u1',
      '2026-11-04',
      'agent',
      expect.any(Date),
    )

    mocks.deleteWeight.mockRejectedValueOnce(
      new ApiError('MAKEUP_NOT_ALLOWED', '团团只能删除今天或昨天的记录'),
    )
    const rejected = await app.request('/metrics/weight/2026-11-01?origin=agent', {
      method: 'DELETE',
    })
    expect(rejected.status).toBe(400)
    expect(await rejected.json()).toMatchObject({ code: 'MAKEUP_NOT_ALLOWED' })
  })

  it('DELETE /ratings/{localDate} 默认 scope=overall, origin=manual', async () => {
    login()
    mocks.deleteRating.mockResolvedValue(undefined)
    const res = await app.request('/ratings/2026-11-04', { method: 'DELETE' })
    expect(res.status).toBe(204)
    expect(mocks.deleteRating).toHaveBeenCalledWith(
      expect.anything(),
      'u1',
      '2026-11-04',
      'overall',
      'manual',
      expect.any(Date),
    )
  })

  it('GET /metrics/{kind}/history 与 /calendar 校验非法 kind 并正常返回分页/月历', async () => {
    login()
    const bad = await app.request('/metrics/unknown/history')
    expect(bad.status).toBe(400)

    mocks.listMetricHistory.mockResolvedValue({
      items: [
        {
          kind: 'steps',
          localDate: '2026-11-05',
          value: 8600,
          measuredAt: '2026-11-05T06:00:00.000Z',
        },
      ],
      nextCursor: '2026-11-05',
    })
    const hist = await app.request('/metrics/steps/history?limit=10&cursor=2026-11-06')
    expect(hist.status).toBe(200)
    expect(await hist.json()).toMatchObject({ nextCursor: '2026-11-05' })
    expect(mocks.listMetricHistory).toHaveBeenCalledWith(expect.anything(), 'u1', 'steps', {
      cursor: '2026-11-06',
      limit: 10,
    })

    mocks.metricCalendar.mockResolvedValue({
      kind: 'mood',
      month: '2026-11',
      days: [{ localDate: '2026-11-05', value: 4 }],
    })
    const cal = await app.request('/metrics/mood/calendar?month=2026-11')
    expect(cal.status).toBe(200)
    expect(await cal.json()).toMatchObject({ kind: 'mood', month: '2026-11' })
  })
})
