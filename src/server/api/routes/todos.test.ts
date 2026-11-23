import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountState } from '@/server/auth/account-state'

/*
 * /todos、/todo-groups、/todo-tags 接口经根应用 app.request()：
 * 鉴权、入参校验（2000 字备注、四象限、标签去重与上限、分组名、排序）、错误码映射。
 */

const mocks = vi.hoisted(() => ({
  session: null as { user: { id: string; role: string }; session: { id: string } } | null,
  state: null as AccountState | null,
  service: {
    getTodoOverview: vi.fn(),
    listTodos: vi.fn(),
    getTodoById: vi.fn(),
    createTodo: vi.fn(),
    updateTodo: vi.fn(),
    reorderTodos: vi.fn(),
    deleteTodo: vi.fn(),
    listTodoEvents: vi.fn(),
    listTodoGroups: vi.fn(),
    createTodoGroup: vi.fn(),
    updateTodoGroup: vi.fn(),
    deleteTodoGroup: vi.fn(),
    reorderTodoGroups: vi.fn(),
    listTodoTags: vi.fn(),
    deleteTodoTag: vi.fn(),
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
const GROUP_ID = '0193f6b2-0000-7000-8000-000000000101'
const TAG_ID = '0193f6b2-0000-7000-8000-000000000201'

const todo = {
  id: TODO_ID,
  groupId: GROUP_ID,
  groupName: '默认待办',
  title: '交实验报告',
  note: null,
  dueAt: null,
  priority: 'not-important-not-urgent',
  tags: [],
  status: 'open',
  doneAt: null,
  abandonedAt: null,
  abandonReason: null,
  settledAt: null,
  isArchived: false,
  sortOrder: 0,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
}

const group = {
  id: GROUP_ID,
  name: '默认待办',
  isDefault: true,
  sortOrder: 0,
  openCount: 1,
  soonCount: 0,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
}

function login() {
  mocks.session = { user: { id: 'u1', role: 'user' }, session: { id: 's1' } }
  mocks.state = { banned: false, banReason: null, banExpires: null, onboardedAt: new Date(0) }
}

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
    ['GET', '/api/v1/todos/overview', undefined],
    ['GET', '/api/v1/todos', undefined],
    ['GET', '/api/v1/todos/events', undefined],
    ['POST', '/api/v1/todos', jsonInit('POST', { title: 'x' })],
    ['POST', '/api/v1/todos/reorder', jsonInit('POST', { groupId: GROUP_ID, todoIds: [TODO_ID] })],
    ['PATCH', `/api/v1/todos/${TODO_ID}`, jsonInit('PATCH', { status: 'done' })],
    ['DELETE', `/api/v1/todos/${TODO_ID}`, deleteInit],
    ['GET', '/api/v1/todo-groups', undefined],
    ['POST', '/api/v1/todo-groups/reorder', jsonInit('POST', { groupIds: [GROUP_ID] })],
  ] as const)('%s %s → 401 UNAUTHENTICATED', async (_m, path, init) => {
    const res = await app.request(path, init)
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  it('未完成引导：403 ONBOARDING_REQUIRED', async () => {
    login()
    mocks.state = { banned: false, banReason: null, banExpires: null, onboardedAt: null }
    const res = await app.request('/api/v1/todos/overview')
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'ONBOARDING_REQUIRED' })
  })
})

describe('已登录', () => {
  beforeEach(login)

  it('GET /todos/overview 返回概览与默认分组首批待办', async () => {
    const overview = {
      defaultGroupId: GROUP_ID,
      groups: [group],
      tags: [],
      counts: {
        openTotal: 1,
        overdueCount: 0,
        doneRecentCount: 0,
        abandonedRecentCount: 0,
        archivedCount: 0,
        quadrants: {
          'urgent-important': 0,
          'important-not-urgent': 0,
          'urgent-not-important': 0,
          'not-important-not-urgent': 1,
        },
      },
      defaultGroupTodos: { items: [todo], nextCursor: null },
    }
    mocks.service.getTodoOverview.mockResolvedValue(overview)
    const res = await app.request('/api/v1/todos/overview?tag=高数')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(overview)
    const [, userId, , query] = mocks.service.getTodoOverview.mock.calls[0] ?? []
    expect(userId).toBe('u1')
    expect(query).toEqual({ tag: '高数' })
  })

  it('GET /todos 支持 open/overdue/done/abandoned/archived/quadrant', async () => {
    mocks.service.listTodos.mockResolvedValue({ items: [todo], nextCursor: null })
    const res = await app.request('/api/v1/todos?status=quadrant&priority=urgent-important')
    expect(res.status).toBe(200)
    const [, userId, query] = mocks.service.listTodos.mock.calls[0] ?? []
    expect(userId).toBe('u1')
    expect(query).toMatchObject({
      status: 'quadrant',
      priority: 'urgent-important',
      limit: 20,
    })
  })

  it('GET 非法 status：400 VALIDATION_FAILED', async () => {
    const res = await app.request('/api/v1/todos?status=all')
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'VALIDATION_FAILED' })
  })

  it('POST /todos 默认四象限为 not-important-not-urgent，标签去重，支持 newGroupName 与 2000 字备注', async () => {
    mocks.service.createTodo.mockResolvedValue(todo)
    const longNote = '备'.repeat(2000)
    const res = await app.request(
      '/api/v1/todos',
      jsonInit(
        'POST',
        {
          title: '  交实验报告 ',
          note: longNote,
          tags: ['高数', '高数', '作业'],
          newGroupName: '学习',
        },
        { 'idempotency-key': crypto.randomUUID() },
      ),
    )
    expect(res.status).toBe(201)
    const [, userId, input] = mocks.service.createTodo.mock.calls[0] ?? []
    expect(userId).toBe('u1')
    expect(input).toEqual({
      title: '交实验报告',
      note: longNote,
      dueAt: null,
      priority: 'not-important-not-urgent',
      tags: ['高数', '作业'],
      newGroupName: '学习',
    })
  })

  it('POST /todos 备注超 2000 字返回 400 VALIDATION_FAILED', async () => {
    const res = await app.request(
      '/api/v1/todos',
      jsonInit(
        'POST',
        { title: '测试', note: 'a'.repeat(2001) },
        { 'idempotency-key': crypto.randomUUID() },
      ),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { fields?: Record<string, string[]> }
    expect(body.fields?.note).toBeDefined()
  })

  it('PATCH /todos/{todoId} 支持放弃待办与原因', async () => {
    mocks.service.updateTodo.mockResolvedValue({
      ...todo,
      status: 'abandoned',
      abandonReason: '改期',
    })
    const res = await app.request(
      `/api/v1/todos/${TODO_ID}`,
      jsonInit('PATCH', { status: 'abandoned', abandonReason: '改期' }),
    )
    expect(res.status).toBe(200)
    const [, userId, todoId, patch] = mocks.service.updateTodo.mock.calls[0] ?? []
    expect([userId, todoId, patch]).toEqual([
      'u1',
      TODO_ID,
      { status: 'abandoned', abandonReason: '改期' },
    ])
  })

  it('POST /todos/reorder 转发组内排序', async () => {
    mocks.service.reorderTodos.mockResolvedValue({ ok: true })
    const res = await app.request(
      '/api/v1/todos/reorder',
      jsonInit('POST', { groupId: GROUP_ID, todoIds: [TODO_ID] }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('POST /todo-groups/reorder 转发分组排序', async () => {
    mocks.service.reorderTodoGroups.mockResolvedValue({ items: [group] })
    const res = await app.request(
      '/api/v1/todo-groups/reorder',
      jsonInit('POST', { groupIds: [GROUP_ID] }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ items: [group] })
  })

  it('DELETE 默认待办分组返回 400 TODO_DEFAULT_GROUP_PROTECTED', async () => {
    mocks.service.deleteTodoGroup.mockRejectedValue(
      new ApiError('TODO_DEFAULT_GROUP_PROTECTED', '受保护'),
    )
    const res = await app.request(`/api/v1/todo-groups/${GROUP_ID}`, deleteInit)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'TODO_DEFAULT_GROUP_PROTECTED' })
  })

  it('DELETE /todos/{todoId} 成功：204', async () => {
    mocks.service.deleteTodo.mockResolvedValue(undefined)
    const res = await app.request(`/api/v1/todos/${TODO_ID}`, deleteInit)
    expect(res.status).toBe(204)
    expect(mocks.service.deleteTodo.mock.calls[0]?.slice(1, 3)).toEqual(['u1', TODO_ID])
  })

  it('DELETE /todo-tags/{tagId} 成功：204', async () => {
    mocks.service.deleteTodoTag.mockResolvedValue(undefined)
    const res = await app.request(`/api/v1/todo-tags/${TAG_ID}`, deleteInit)
    expect(res.status).toBe(204)
  })
})
