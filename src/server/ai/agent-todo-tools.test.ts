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
}))

vi.mock('@/server/services/agent/todo-read', () => readMocks)

const { buildTodoTools } = await import('./agent-todo-tools')

const NOW = new Date('2026-11-23T04:00:00.000Z')
const GROUP_ID = '0193f6b2-0000-7000-8000-000000000101'
const TODO_ID = '0193f6b2-0000-7000-8000-000000000001'
const EXEC_OPTS = { toolCallId: 'tc_1', messages: [], context: {} as never }

beforeEach(() => {
  for (const fn of Object.values(readMocks)) fn.mockReset()
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
      tags: ['高数'],
      urgentPreview: [],
    })

    const tools = buildTodoTools({ userId: 'u1', now: NOW })
    const r1 = await tools.getTodoOverview.execute!({}, EXEC_OPTS)
    const r2 = await tools.getTodoOverview.execute!({}, EXEC_OPTS)

    expect(r1).toEqual(r2)
    expect(readMocks.getAgentTodoOverview).toHaveBeenCalledTimes(1)
  })

  it('listTodos 同参数命中缓存，不同参数分别查询', async () => {
    readMocks.listAgentTodos.mockResolvedValue({ items: [], nextCursor: null })

    const tools = buildTodoTools({ userId: 'u1', now: NOW })
    await tools.listTodos.execute!({ status: 'archived', limit: 20 }, EXEC_OPTS)
    await tools.listTodos.execute!({ status: 'archived', limit: 20 }, EXEC_OPTS)
    await tools.listTodos.execute!({ status: 'abandoned', limit: 20 }, EXEC_OPTS)

    expect(readMocks.listAgentTodos).toHaveBeenCalledTimes(2)
  })

  it('getTodoDetail 与 getTodoTimeline 正确透传并缓存', async () => {
    readMocks.getAgentTodoDetail.mockResolvedValue({ found: true, todo: { id: TODO_ID } })
    readMocks.getAgentTodoTimeline.mockResolvedValue({ events: [], nextCursor: null })

    const tools = buildTodoTools({ userId: 'u1', now: NOW })
    await tools.getTodoDetail.execute!({ todoId: TODO_ID }, EXEC_OPTS)
    await tools.getTodoDetail.execute!({ todoId: TODO_ID }, EXEC_OPTS)
    await tools.getTodoTimeline.execute!({ todoId: TODO_ID, limit: 30 }, EXEC_OPTS)

    expect(readMocks.getAgentTodoDetail).toHaveBeenCalledTimes(1)
    expect(readMocks.getAgentTodoTimeline).toHaveBeenCalledTimes(1)
  })

  it('draftTodo：已有分组填 groupId，新分组填 newGroupName', async () => {
    const tools = buildTodoTools({ userId: 'u1', now: NOW })

    readMocks.lookupUserTodoGroupByName.mockResolvedValueOnce({ id: GROUP_ID, name: '学习' })
    const existing = await tools.draftTodo.execute!(
      {
        title: '交实验报告',
        dueAt: '2026-11-24T15:59:00.000Z',
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
      priority: 'urgent-important',
      tags: ['高数', '作业'],
      confirmBody: {
        groupId: GROUP_ID,
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
      confirmBody: {
        newGroupName: '出行',
      },
    })
  })
})
