import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountState } from '@/server/auth/account-state'

/*
 * /todos 接口经根应用 app.request()：鉴权、入参校验、错误码映射（testing.md 第 1 节）。
 * 会话、账号状态、service 层、幂等存储都被 mock：不连数据库、不初始化 Better Auth。
 */

const mocks = vi.hoisted(() => ({
  session: null as { user: { id: string; role: string }; session: { id: string } } | null,
  state: null as AccountState | null,
  service: {
    listTodos: vi.fn(),
    createTodo: vi.fn(),
    updateTodo: vi.fn(),
    deleteTodo: vi.fn(),
  },
}))

vi.mock('@/server/auth/session', () => ({ getSessionFromHeaders: async () => mocks.session }))
vi.mock('@/server/auth/account-state', () => ({ loadAccountState: async () => mocks.state }))
vi.mock('@/server/services/todos', () => mocks.service)
vi.mock('@/server/db/client', () => ({
  db: { transaction: (fn: (tx: unknown) => unknown) => fn({}) },
}))
vi.mock('@/server/idempotency', () => ({
  requestHash: async () => 'hash',
  beginIdempotent: async () => ({ kind: 'new' }),
  completeIdempotent: async () => undefined,
  abortIdempotent: async () => undefined,
}))

const { app } = await import('../app')
const { ApiError } = await import('../errors')

const TODO_ID = '0193f6b2-0000-7000-8000-000000000001'
const todo = {
  id: TODO_ID,
  title: '交实验报告',
  dueAt: null,
  priority: 'normal',
  doneAt: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
}

function login() {
  mocks.session = { user: { id: 'u1', role: 'user' }, session: { id: 's1' } }
  mocks.state = { banned: false, banReason: null, banExpires: null, onboardedAt: new Date(0) }
}

/*
 * 浏览器对同源的写请求总会带 Sec-Fetch-Site；根应用的 hono/csrf 把没有 Content-Type 的写请求
 * （DELETE）当作 text/plain 表单请求检查来源，测试里同样带上。
 */
const SAME_ORIGIN = { 'sec-fetch-site': 'same-origin' }

const jsonInit = (method: string, body: unknown, headers: Record<string, string> = {}) => ({
  method,
  headers: { 'content-type': 'application/json', ...SAME_ORIGIN, ...headers },
  body: JSON.stringify(body),
})
const deleteInit = { method: 'DELETE', headers: SAME_ORIGIN }

beforeEach(() => {
  mocks.session = null
  mocks.state = null
  for (const fn of Object.values(mocks.service)) fn.mockReset()
})

describe('未登录', () => {
  it.each([
    ['GET', '/api/v1/todos', undefined],
    ['POST', '/api/v1/todos', jsonInit('POST', { title: 'x' })],
    ['PATCH', `/api/v1/todos/${TODO_ID}`, jsonInit('PATCH', { done: true })],
    ['DELETE', `/api/v1/todos/${TODO_ID}`, deleteInit],
  ] as const)('%s %s → 401 UNAUTHENTICATED', async (_m, path, init) => {
    const res = await app.request(path, init)
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
    expect(mocks.service.listTodos).not.toHaveBeenCalled()
  })

  it('未完成引导：403 ONBOARDING_REQUIRED', async () => {
    login()
    mocks.state = { banned: false, banReason: null, banExpires: null, onboardedAt: null }
    const res = await app.request('/api/v1/todos')
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'ONBOARDING_REQUIRED' })
  })
})

describe('已登录', () => {
  beforeEach(login)

  it('GET 默认 status=open，按用户调用 service', async () => {
    mocks.service.listTodos.mockResolvedValue({ items: [todo], nextCursor: null })
    const res = await app.request('/api/v1/todos')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ items: [todo], nextCursor: null })
    const [, userId, query] = mocks.service.listTodos.mock.calls[0] ?? []
    expect(userId).toBe('u1')
    expect(query).toMatchObject({ status: 'open', limit: 20 })
  })

  it('GET 非法 status：400 VALIDATION_FAILED', async () => {
    const res = await app.request('/api/v1/todos?status=all')
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'VALIDATION_FAILED' })
  })

  it('POST 缺幂等键：400，不调 service', async () => {
    const res = await app.request('/api/v1/todos', jsonInit('POST', { title: '交实验报告' }))
    expect(res.status).toBe(400)
    expect(mocks.service.createTodo).not.toHaveBeenCalled()
  })

  it('POST 标题为空：400 带 fields.title', async () => {
    const res = await app.request(
      '/api/v1/todos',
      jsonInit('POST', { title: '   ' }, { 'idempotency-key': crypto.randomUUID() }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { fields?: Record<string, string[]> }
    expect(body.fields?.title).toBeDefined()
  })

  it('POST 成功：201，标题去首尾空白、默认值补齐', async () => {
    mocks.service.createTodo.mockResolvedValue(todo)
    const res = await app.request(
      '/api/v1/todos',
      jsonInit('POST', { title: '  交实验报告 ' }, { 'idempotency-key': crypto.randomUUID() }),
    )
    expect(res.status).toBe(201)
    const [, userId, input] = mocks.service.createTodo.mock.calls[0] ?? []
    expect(userId).toBe('u1')
    expect(input).toEqual({ title: '交实验报告', dueAt: null, priority: 'normal' })
  })

  it('POST 超过上限：409 TODO_LIMIT_REACHED', async () => {
    mocks.service.createTodo.mockRejectedValue(new ApiError('TODO_LIMIT_REACHED'))
    const res = await app.request(
      '/api/v1/todos',
      jsonInit('POST', { title: 'x' }, { 'idempotency-key': crypto.randomUUID() }),
    )
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'TODO_LIMIT_REACHED' })
  })

  it('PATCH 空对象：400', async () => {
    const res = await app.request(`/api/v1/todos/${TODO_ID}`, jsonInit('PATCH', {}))
    expect(res.status).toBe(400)
    expect(mocks.service.updateTodo).not.toHaveBeenCalled()
  })

  it('PATCH 不存在或不属于自己：404 TODO_NOT_FOUND', async () => {
    mocks.service.updateTodo.mockRejectedValue(new ApiError('TODO_NOT_FOUND'))
    const res = await app.request(`/api/v1/todos/${TODO_ID}`, jsonInit('PATCH', { done: true }))
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'TODO_NOT_FOUND' })
    const [, userId, todoId, patch] = mocks.service.updateTodo.mock.calls[0] ?? []
    expect([userId, todoId, patch]).toEqual(['u1', TODO_ID, { done: true }])
  })

  it('路径参数不是 UUID：400', async () => {
    const res = await app.request('/api/v1/todos/abc', deleteInit)
    expect(res.status).toBe(400)
  })

  it('DELETE 成功：204', async () => {
    mocks.service.deleteTodo.mockResolvedValue(undefined)
    const res = await app.request(`/api/v1/todos/${TODO_ID}`, deleteInit)
    expect(res.status).toBe(204)
    expect(mocks.service.deleteTodo.mock.calls[0]?.slice(1)).toEqual(['u1', TODO_ID])
  })
})
