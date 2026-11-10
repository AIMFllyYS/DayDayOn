import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountState } from '@/server/auth/account-state'

/*
 * /agent 接口经根应用 app.request()：鉴权、会话读写、流式对话首次新会话创建与幂等去重校验。
 */

const mocks = vi.hoisted(() => ({
  session: null as { user: { id: string; role: string }; session: { id: string } } | null,
  state: null as AccountState | null,
  conversations: {
    listConversations: vi.fn(),
    getConversation: vi.fn(),
    renameConversation: vi.fn(),
    deleteConversation: vi.fn(),
  },
  runAgent: {
    loadConversationMessages: vi.fn(),
    streamAgentChat: vi.fn(),
  },
}))

vi.mock('@/server/auth/session', () => ({ getSessionFromHeaders: async () => mocks.session }))
vi.mock('@/server/auth/account-state', () => ({ loadAccountState: async () => mocks.state }))
vi.mock('@/server/rate-limit', () => ({
  consume: async () => ({ ok: true }),
}))
vi.mock('@/server/services/agent/conversations', () => mocks.conversations)
vi.mock('@/server/ai/run-agent', () => mocks.runAgent)

const { app } = await import('../app')
const { ApiError } = await import('../errors')

const SAME_ORIGIN = { 'sec-fetch-site': 'same-origin' }

const jsonInit = (method: string, body: unknown) => ({
  method,
  headers: { 'content-type': 'application/json', ...SAME_ORIGIN },
  body: JSON.stringify(body),
})

function login(userId = 'u1') {
  mocks.session = { user: { id: userId, role: 'user' }, session: { id: 's1' } }
  mocks.state = { banned: false, banReason: null, banExpires: null, onboardedAt: new Date(0) }
}

const CONV_ID = '019a4000-0000-7000-8000-000000000001'
const IDEM_KEY = '019a4000-0000-7000-8000-000000000002'

const sampleConv = {
  id: CONV_ID,
  title: '今天跑了 3 公里',
  lastMessageAt: '2026-11-02T06:00:00.000Z',
  createdAt: '2026-11-02T05:50:00.000Z',
}

beforeEach(() => {
  mocks.session = null
  mocks.state = null
  for (const fn of Object.values(mocks.conversations)) fn.mockReset()
  for (const fn of Object.values(mocks.runAgent)) fn.mockReset()
})

describe('/api/v1/agent 鉴权', () => {
  it.each([
    ['GET', '/api/v1/agent/conversations', undefined],
    ['GET', `/api/v1/agent/conversations/${CONV_ID}`, undefined],
    ['PATCH', `/api/v1/agent/conversations/${CONV_ID}`, jsonInit('PATCH', { title: '新名' })],
    [
      'DELETE',
      `/api/v1/agent/conversations/${CONV_ID}`,
      { method: 'DELETE', headers: SAME_ORIGIN },
    ],
    [
      'POST',
      '/api/v1/agent/chat',
      jsonInit('POST', {
        id: CONV_ID,
        message: { id: 'm1', role: 'user', parts: [{ type: 'text', text: '你好' }] },
        idempotencyKey: IDEM_KEY,
      }),
    ],
  ] as const)('未登录 %s %s → 401 UNAUTHENTICATED', async (_m, path, init) => {
    const res = await app.request(path, init)
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
  })
})

describe('/api/v1/agent 会话与流式对话闭环', () => {
  beforeEach(() => login('u1'))

  it('GET /agent/conversations 返回最近会话列表', async () => {
    mocks.conversations.listConversations.mockResolvedValue([sampleConv])
    const res = await app.request('/api/v1/agent/conversations')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ items: [sampleConv] })
    expect(mocks.conversations.listConversations).toHaveBeenCalledWith('u1')
  })

  it('GET /agent/conversations/{id} 返回会话详情与历史消息', async () => {
    const messages = [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: '你好' }] }]
    mocks.conversations.getConversation.mockResolvedValue(sampleConv)
    mocks.runAgent.loadConversationMessages.mockResolvedValue(messages)

    const res = await app.request(`/api/v1/agent/conversations/${CONV_ID}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ conversation: sampleConv, messages })
    expect(mocks.conversations.getConversation).toHaveBeenCalledWith('u1', CONV_ID)
    expect(mocks.runAgent.loadConversationMessages).toHaveBeenCalledWith('u1', CONV_ID)
  })

  it('GET /agent/conversations/{id} 会话不存在返回 404 NOT_FOUND', async () => {
    mocks.conversations.getConversation.mockRejectedValue(new ApiError('NOT_FOUND', '对话不存在'))
    mocks.runAgent.loadConversationMessages.mockResolvedValue([])

    const res = await app.request(`/api/v1/agent/conversations/${CONV_ID}`)
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'NOT_FOUND' })
  })

  it('PATCH /agent/conversations/{id} 重命名成功返回 204，空标题返回 400', async () => {
    mocks.conversations.renameConversation.mockResolvedValue(undefined)
    const ok = await app.request(
      `/api/v1/agent/conversations/${CONV_ID}`,
      jsonInit('PATCH', { title: '晨跑计划' }),
    )
    expect(ok.status).toBe(204)
    expect(mocks.conversations.renameConversation).toHaveBeenCalledWith('u1', CONV_ID, '晨跑计划')

    const bad = await app.request(
      `/api/v1/agent/conversations/${CONV_ID}`,
      jsonInit('PATCH', { title: '   ' }),
    )
    expect(bad.status).toBe(400)
    expect(await bad.json()).toMatchObject({ code: 'VALIDATION_FAILED' })
  })

  it('DELETE /agent/conversations/{id} 删除成功返回 204', async () => {
    mocks.conversations.deleteConversation.mockResolvedValue(undefined)
    const res = await app.request(`/api/v1/agent/conversations/${CONV_ID}`, {
      method: 'DELETE',
      headers: SAME_ORIGIN,
    })
    expect(res.status).toBe(204)
    expect(mocks.conversations.deleteConversation).toHaveBeenCalledWith('u1', CONV_ID)
  })

  it('POST /agent/chat 首次新会话传 allowMissing=true 加载历史并去重重试消息', async () => {
    mocks.runAgent.loadConversationMessages.mockResolvedValue([
      { id: 'm0', role: 'user', parts: [{ type: 'text', text: '上一轮' }] },
      { id: 'm1', role: 'user', parts: [{ type: 'text', text: '重试同 id 消息' }] },
    ])
    mocks.runAgent.streamAgentChat.mockResolvedValue(
      new Response('data: [DONE]\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      }),
    )

    const userMsg = {
      id: 'm1',
      role: 'user' as const,
      parts: [{ type: 'text', text: '今天跑了 3 公里' }],
    }
    const res = await app.request(
      '/api/v1/agent/chat',
      jsonInit('POST', {
        id: CONV_ID,
        message: userMsg,
        deepThink: true,
        idempotencyKey: IDEM_KEY,
      }),
    )

    expect(res.status).toBe(200)
    expect(mocks.runAgent.loadConversationMessages).toHaveBeenCalledWith('u1', CONV_ID, {
      allowMissing: true,
    })
    expect(mocks.runAgent.streamAgentChat).toHaveBeenCalledWith({
      userId: 'u1',
      ip: '127.0.0.1',
      idempotencyKey: IDEM_KEY,
      conversationId: CONV_ID,
      messages: [{ id: 'm0', role: 'user', parts: [{ type: 'text', text: '上一轮' }] }, userMsg],
      deepThink: true,
    })
  })

  it('POST /agent/chat 请求体缺少合法 idempotencyKey 或 UUID 返回 400 VALIDATION_FAILED', async () => {
    const res = await app.request(
      '/api/v1/agent/chat',
      jsonInit('POST', {
        id: 'not-a-uuid',
        message: { id: 'm1', role: 'user', parts: [] },
      }),
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'VALIDATION_FAILED' })
    expect(mocks.runAgent.streamAgentChat).not.toHaveBeenCalled()
  })

  it('POST /agent/chat 支持最多 2 张合法压缩 JPEG 图片，超过 2 张或非 JPEG 返回 400 VALIDATION_FAILED', async () => {
    const validJpegDataUrl = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString('base64')}`
    mocks.runAgent.loadConversationMessages.mockResolvedValue([])
    mocks.runAgent.streamAgentChat.mockResolvedValue(
      new Response('data: [DONE]\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      }),
    )

    const okRes = await app.request(
      '/api/v1/agent/chat',
      jsonInit('POST', {
        id: CONV_ID,
        message: {
          id: 'm-img-ok',
          role: 'user',
          parts: [
            { type: 'file', mediaType: 'image/jpeg', url: validJpegDataUrl },
            { type: 'file', mediaType: 'image/jpeg', url: validJpegDataUrl },
          ],
        },
        idempotencyKey: IDEM_KEY,
      }),
    )
    expect(okRes.status).toBe(200)

    const tooManyRes = await app.request(
      '/api/v1/agent/chat',
      jsonInit('POST', {
        id: CONV_ID,
        message: {
          id: 'm-img-3',
          role: 'user',
          parts: [
            { type: 'file', mediaType: 'image/jpeg', url: validJpegDataUrl },
            { type: 'file', mediaType: 'image/jpeg', url: validJpegDataUrl },
            { type: 'file', mediaType: 'image/jpeg', url: validJpegDataUrl },
          ],
        },
        idempotencyKey: IDEM_KEY,
      }),
    )
    expect(tooManyRes.status).toBe(400)
    expect(await tooManyRes.json()).toMatchObject({ code: 'VALIDATION_FAILED' })
  })
})
