import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * AI 待办渐进式披露工具单测：
 * - 验证 3 层渐进式工具（getTodoOverview / listTodos / getTodoDetail / getTodoTimeline）正确传参；
 * - 验证单轮内存缓存（turnMemo）：同参重复调用仅触发 1 次底层 DB 读取；
 * - 验证 draftTodo 支持分组解析、原地新建分组、四象限优先级、自定义标签与 2000 字备注。
 */

const readMocks = vi.hoisted(() => ({
  getAgentTodoOverview: vi.fn(),
  listAgentTodos: vi.fn(),
  getAgentTodoDetail: vi.fn(),
  getAgentTodoTimeline: vi.fn(),
  lookupUserTodoGroupByName: vi.fn(),
  checkAgentTodoCreateLimits: vi.fn(),
  previewAgentTodoUpdate: vi.fn(),
  previewAgentTodoDelete: vi.fn(),
  previewAgentTodoGroup: vi.fn(),
}))

vi.mock('@/server/services/agent/todo-read', () => readMocks)

const { buildTodoTools, parseAgentDueAt } = await import('./agent-todo-tools')
const { ApiError } = await import('@/server/api/errors')

const NOW = new Date('2026-11-23T04:00:00.000Z')
const CLOCK = { timeZone: 'Asia/Shanghai', dayStartHour: 4 }
const GROUP_ID = '0193f6b2-0000-7000-8000-000000000101'
const TODO_ID = '0193f6b2-0000-7000-8000-000000000001'
const EXEC_OPTS = { toolCallId: 'tc_1', messages: [], context: {} as never }

beforeEach(() => {
  for (const fn of Object.values(readMocks)) fn.mockReset()
  readMocks.checkAgentTodoCreateLimits.mockResolvedValue(undefined)
})

describe('parseAgentDueAt 时区安全解析', () => {
  it('兼容 UTC ISO、无时区本地时间、纯日期与空值', () => {
    expect(parseAgentDueAt(null, 'Asia/Shanghai')).toBeNull()
    expect(parseAgentDueAt(undefined, 'Asia/Shanghai')).toBeNull()
    expect(parseAgentDueAt('   ', 'Asia/Shanghai')).toBeNull()
    expect(parseAgentDueAt('2026-11-24T18:00:00+08:00', 'Asia/Shanghai')).toBe(
      '2026-11-24T10:00:00.000Z',
    )
    expect(parseAgentDueAt('2026-11-24T20:30', 'Asia/Shanghai')).toBe('2026-11-24T12:30:00.000Z')
    expect(parseAgentDueAt('2026-11-24', 'Asia/Shanghai')).toBe('2026-11-24T15:59:00.000Z')
  })

  it('非法格式抛出清晰错误', () => {
    expect(() => parseAgentDueAt('明天晚上', 'Asia/Shanghai')).toThrow(/格式不合法/)
  })
})

describe('buildTodoTools 渐进式披露与单轮缓存', () => {
  it('同一轮内重复调用 getTodoOverview 命中内存缓存，仅查询 1 次', async () => {
    readMocks.getAgentTodoOverview.mockResolvedValue({
      groups: [{ id: GROUP_ID, name: '默认待办', isDefault: true, openCount: 2, soonCount: 1 }],
      counts: {
        openTotal: 2,
        overdueCount: 0,
        doneRecentCount: 1,
        abandonedRecentCount: 0,
        archivedCount: 5,
      },
      tags: [{ id: 't1', name: '高数' }],
      urgentPreview: [],
    })

    const tools = buildTodoTools({ userId: 'u1', now: NOW, clock: CLOCK })
    const r1 = await tools.getTodoOverview.execute!({}, EXEC_OPTS)
    const r2 = await tools.getTodoOverview.execute!({}, EXEC_OPTS)

    expect(r1).toEqual(r2)
    expect(readMocks.getAgentTodoOverview).toHaveBeenCalledTimes(1)
  })

  it('listTodos 同参数命中缓存，支持 active 与 dueFrom/dueTo 透传', async () => {
    readMocks.listAgentTodos.mockResolvedValue({ items: [], nextCursor: null })

    const tools = buildTodoTools({ userId: 'u1', now: NOW, clock: CLOCK })
    await tools.listTodos.execute!(
      { status: 'active', dueFrom: '2026-11-23', dueTo: '2026-11-29', limit: 20 },
      EXEC_OPTS,
    )
    await tools.listTodos.execute!(
      { status: 'active', dueFrom: '2026-11-23', dueTo: '2026-11-29', limit: 20 },
      EXEC_OPTS,
    )
    await tools.listTodos.execute!({ status: 'abandoned', limit: 20 }, EXEC_OPTS)

    expect(readMocks.listAgentTodos).toHaveBeenCalledTimes(2)
    expect(readMocks.listAgentTodos).toHaveBeenNthCalledWith(
      1,
      'u1',
      NOW,
      expect.objectContaining({ status: 'active', dueFrom: '2026-11-23', dueTo: '2026-11-29' }),
    )
  })

  it('getTodoDetail 与 getTodoTimeline 正确透传并缓存', async () => {
    readMocks.getAgentTodoDetail.mockResolvedValue({ found: true, todo: { id: TODO_ID } })
    readMocks.getAgentTodoTimeline.mockResolvedValue({ events: [], nextCursor: null })

    const tools = buildTodoTools({ userId: 'u1', now: NOW, clock: CLOCK })
    await tools.getTodoDetail.execute!({ todoId: TODO_ID }, EXEC_OPTS)
    await tools.getTodoDetail.execute!({ todoId: TODO_ID }, EXEC_OPTS)
    await tools.getTodoTimeline.execute!({ todoId: TODO_ID, limit: 30 }, EXEC_OPTS)

    expect(readMocks.getAgentTodoDetail).toHaveBeenCalledTimes(1)
    expect(readMocks.getAgentTodoTimeline).toHaveBeenCalledTimes(1)
  })

  it('draftTodo：支持省略 dueAt、已有/新建分组解析以及上限预检错误返回', async () => {
    const tools = buildTodoTools({ userId: 'u1', now: NOW, clock: CLOCK })

    readMocks.lookupUserTodoGroupByName.mockResolvedValueOnce({ id: GROUP_ID, name: '学习' })
    const existing = await tools.draftTodo.execute!(
      {
        title: '交实验报告',
        dueAt: '2026-11-24T23:59',
        priority: 'urgent-important',
        groupName: '学习',
        tags: ['高数', '作业'],
        note: '记得附性能对比图',
      },
      EXEC_OPTS,
    )
    expect(existing).toMatchObject({
      kind: 'todo',
      groupName: '学习',
      isNewGroup: false,
      dueAt: '2026-11-24T15:59:00.000Z',
      priority: 'urgent-important',
      tags: ['高数', '作业'],
      confirmBody: {
        groupId: GROUP_ID,
        dueAt: '2026-11-24T15:59:00.000Z',
        priority: 'urgent-important',
        note: '记得附性能对比图',
      },
    })

    readMocks.lookupUserTodoGroupByName.mockResolvedValueOnce(null)
    const created = await tools.draftTodo.execute!(
      {
        title: '订车票',
        dueAt: null,
        priority: 'not-important-not-urgent',
        groupName: '出行',
        tags: [],
      },
      EXEC_OPTS,
    )
    expect(created).toMatchObject({
      kind: 'todo',
      groupName: '出行',
      isNewGroup: true,
      dueAt: null,
      confirmBody: {
        newGroupName: '出行',
      },
    })
    expect(readMocks.checkAgentTodoCreateLimits).toHaveBeenLastCalledWith('u1', true)

    readMocks.checkAgentTodoCreateLimits.mockRejectedValueOnce(
      new ApiError('TODO_LIMIT_REACHED', '进行中待办已达 100 条上限'),
    )
    const limitErr = await tools.draftTodo.execute!(
      {
        title: '超上限待办',
        dueAt: null,
        priority: 'not-important-not-urgent',
        tags: [],
      },
      EXEC_OPTS,
    )
    expect(limitErr).toEqual({
      error: true,
      code: 'TODO_LIMIT_REACHED',
      detail: '进行中待办已达 100 条上限',
    })
  })

  it('draftUpdateTodo / draftDeleteTodo / draftTodoGroup 正确透传预览服务并把 ApiError 转为工具错误对象', async () => {
    const tools = buildTodoTools({ userId: 'u1', now: NOW, clock: CLOCK })

    const updateDraft = { kind: 'todo-update', todoId: TODO_ID, action: 'complete' }
    readMocks.previewAgentTodoUpdate.mockResolvedValueOnce(updateDraft)
    const uRes = await tools.draftUpdateTodo.execute!(
      {
        todoId: TODO_ID,
        status: 'done',
        dueAt: '2026-11-25T18:00',
        reason: '已完成',
      },
      EXEC_OPTS,
    )
    expect(uRes).toEqual(updateDraft)
    expect(readMocks.previewAgentTodoUpdate).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        todoId: TODO_ID,
        status: 'done',
        dueAt: '2026-11-25T10:00:00.000Z',
        timeZone: 'Asia/Shanghai',
      }),
      NOW,
    )

    const delDraft = { kind: 'todo-delete', todoId: TODO_ID, reason: '重复了' }
    readMocks.previewAgentTodoDelete.mockResolvedValueOnce(delDraft)
    const dRes = await tools.draftDeleteTodo.execute!(
      { todoId: TODO_ID, reason: '重复了' },
      EXEC_OPTS,
    )
    expect(dRes).toEqual(delDraft)

    readMocks.previewAgentTodoGroup.mockRejectedValueOnce(
      new ApiError('TODO_DEFAULT_GROUP_PROTECTED', '「默认待办」为内置分组，不可删除'),
    )
    const gRes = await tools.draftTodoGroup.execute!(
      { action: 'delete', name: '默认待办' },
      EXEC_OPTS,
    )
    expect(gRes).toEqual({
      error: true,
      code: 'TODO_DEFAULT_GROUP_PROTECTED',
      detail: '「默认待办」为内置分组，不可删除',
    })
  })
})
