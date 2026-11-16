import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountState } from '@/server/auth/account-state'

/*
 * POST /api/v1/goals/{goalId}/referee 接口经根应用 app.request() 测试：
 * 鉴权、参数校验（goalId / body）、流式 SSE 响应转发。
 */

const mocks = vi.hoisted(() => ({
  session: null as { user: { id: string; role: string }; session: { id: string } } | null,
  state: null as AccountState | null,
  startReferee: vi.fn(),
}))

vi.mock('@/server/auth/session', () => ({ getSessionFromHeaders: async () => mocks.session }))
vi.mock('@/server/auth/account-state', () => ({ loadAccountState: async () => mocks.state }))
vi.mock('@/server/rate-limit', () => ({
  consume: async () => ({ ok: true }),
}))
vi.mock('@/server/services/referee', () => ({
  startReferee: mocks.startReferee,
}))

const { app } = await import('../app')

const SAME_ORIGIN = { 'sec-fetch-site': 'same-origin' }
const GOAL_ID = '019a4000-0000-7000-8000-000000000001'
const CONV_ID = '019a4000-0000-7000-8000-000000000002'
const IDEM_KEY = '019a4000-0000-7000-8000-000000000003'

const validBody = {
  checkin: { module: 'study', what: '阅读《代码整洁之道》第 3 章', durationSeconds: 1800 },
  idempotencyKey: IDEM_KEY,
  conversation: { id: CONV_ID, messageId: 'm1', text: '帮我分析这条学习打卡' },
}

const jsonInit = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...SAME_ORIGIN },
  body: JSON.stringify(body),
})

function login(userId = 'u1') {
  mocks.session = { user: { id: userId, role: 'user' }, session: { id: 's1' } }
  mocks.state = { banned: false, banReason: null, banExpires: null, onboardedAt: new Date(0) }
}

beforeEach(() => {
  mocks.session = null
  mocks.state = null
  mocks.startReferee.mockReset()
})

describe('/api/v1/goals/{goalId}/referee', () => {
  it('未登录返回 401 UNAUTHENTICATED', async () => {
    const res = await app.request(`/api/v1/goals/${GOAL_ID}/referee`, jsonInit(validBody))
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
    expect(mocks.startReferee).not.toHaveBeenCalled()
  })

  it('非法 goalId 或请求体返回 400 VALIDATION_FAILED', async () => {
    login('u1')
    const badParam = await app.request('/api/v1/goals/not-a-uuid/referee', jsonInit(validBody))
    expect(badParam.status).toBe(400)
    expect(await badParam.json()).toMatchObject({ code: 'VALIDATION_FAILED' })

    const badBody = await app.request(`/api/v1/goals/${GOAL_ID}/referee`, jsonInit({}))
    expect(badBody.status).toBe(400)
    expect(await badBody.json()).toMatchObject({ code: 'VALIDATION_FAILED' })
    expect(mocks.startReferee).not.toHaveBeenCalled()
  })

  it('合法请求透传给 startReferee 并返回 SSE 流式响应', async () => {
    login('u1')
    mocks.startReferee.mockResolvedValueOnce(
      new Response('data: [DONE]\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      }),
    )

    const res = await app.request(`/api/v1/goals/${GOAL_ID}/referee`, jsonInit(validBody))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    expect(mocks.startReferee).toHaveBeenCalledWith({
      userId: 'u1',
      ip: '127.0.0.1',
      idempotencyKey: IDEM_KEY,
      goalId: GOAL_ID,
      checkin: expect.objectContaining({ module: 'study', what: '阅读《代码整洁之道》第 3 章' }),
      conversation: validBody.conversation,
    })
  })
})
