import { describe, expect, it } from 'vitest'
import {
  axesFromPriority,
  compareDoneTodos,
  compareQuadrantTodos,
  dueStatus,
  formatDue,
  groupEventsByLocalDate,
  isAutoArchived,
  isOverdueTodo,
  parseTodoLayoutMode,
  parseTodoView,
  priorityFromAxes,
  sortOpenTodos,
} from './rules'
import { moveArrayItem } from './use-long-press-reorder'

const todo = (
  id: string,
  dueAt: string | null,
  createdAt = '2026-10-30T00:00:00.000Z',
  sortOrder = 0,
) => ({
  id,
  dueAt,
  createdAt,
  sortOrder,
})

describe('sortOpenTodos：sortOrder 升序 → DDL 升序（无 DDL 排后）→ 创建时间', () => {
  it('优先遵循拖拽排序 sortOrder', () => {
    const sorted = sortOpenTodos([
      todo('a', '2026-11-01T00:00:00.000Z', '2026-10-30T00:00:00.000Z', 2),
      todo('b', null, '2026-10-30T00:00:00.000Z', 0),
      todo('c', '2026-11-03T00:00:00.000Z', '2026-10-30T00:00:00.000Z', 1),
    ])
    expect(sorted.map((t) => t.id)).toEqual(['b', 'c', 'a'])
  })

  it('sortOrder 相同时按 DDL 时刻排序，null 在最后', () => {
    const sorted = sortOpenTodos([
      todo('a', null),
      todo('b', '2026-11-03T00:00:00.000Z'),
      todo('c', '2026-11-01T15:59:00.000Z'),
      todo('d', null),
      todo('e', '2026-11-02T00:00:00.000Z'),
    ])
    expect(sorted.map((t) => t.id)).toEqual(['c', 'e', 'b', 'a', 'd'])
  })

  it('DDL 相同或都没有 DDL 时按创建时间，再按 id', () => {
    const sorted = sortOpenTodos([
      todo('z', null, '2026-10-30T00:00:01.000Z'),
      todo('y', null, '2026-10-30T00:00:00.000Z'),
      todo('b', '2026-11-01T00:00:00.000Z', '2026-10-30T00:00:00.000Z'),
      todo('a', '2026-11-01T00:00:00.000Z', '2026-10-30T00:00:00.000Z'),
    ])
    expect(sorted.map((t) => t.id)).toEqual(['a', 'b', 'y', 'z'])
  })

  it('小数位数不同的 ISO 字符串按真实时刻比较', () => {
    const sorted = sortOpenTodos([
      todo('late', '2026-11-01T00:00:00.5Z'),
      todo('early', '2026-11-01T00:00:00.100Z'),
    ])
    expect(sorted.map((t) => t.id)).toEqual(['early', 'late'])
  })
})

describe('compareQuadrantTodos：创建时间由近到远', () => {
  it('最新创建的排最前', () => {
    const items = [
      { id: 'a', createdAt: '2026-11-01T01:00:00.000Z' },
      { id: 'b', createdAt: '2026-11-02T01:00:00.000Z' },
      { id: 'c', createdAt: '2026-11-02T01:00:00.000Z' },
    ]
    expect([...items].sort(compareQuadrantTodos).map((t) => t.id)).toEqual(['c', 'b', 'a'])
  })
})

describe('四象限双维度映射', () => {
  it.each([
    ['important', 'urgent', 'urgent-important'],
    ['important', 'normal', 'important-not-urgent'],
    ['normal', 'urgent', 'urgent-not-important'],
    ['normal', 'normal', 'not-important-not-urgent'],
  ] as const)('%s + %s ↔ %s', (importance, urgency, priority) => {
    expect(priorityFromAxes(importance, urgency)).toBe(priority)
    expect(axesFromPriority(priority)).toEqual({ importance, urgency })
  })
})

describe('compareDoneTodos：终态时间降序', () => {
  it('最近完成或放弃的在前，同一时刻按 id 降序', () => {
    const items = [
      {
        id: 'a',
        settledAt: '2026-10-30T00:00:00.000Z',
        doneAt: '2026-10-30T00:00:00.000Z',
        abandonedAt: null,
      },
      {
        id: 'b',
        settledAt: '2026-11-01T00:00:00.000Z',
        doneAt: null,
        abandonedAt: '2026-11-01T00:00:00.000Z',
      },
      {
        id: 'c',
        settledAt: '2026-11-01T00:00:00.000Z',
        doneAt: '2026-11-01T00:00:00.000Z',
        abandonedAt: null,
      },
    ]
    expect([...items].sort(compareDoneTodos).map((t) => t.id)).toEqual(['c', 'b', 'a'])
  })
})

describe('dueStatus & isOverdueTodo', () => {
  const now = new Date('2026-11-01T02:00:00.000Z')

  it('没有 DDL / 过期 / 24h 内 / 24h 后', () => {
    expect(dueStatus(null, now)).toBe('none')
    expect(dueStatus('2026-11-01T02:00:00.000Z', now)).toBe('overdue')
    expect(dueStatus('2026-11-01T02:00:01.000Z', now)).toBe('soon')
    expect(dueStatus('2026-11-02T02:00:00.000Z', now)).toBe('later')
  })

  it('仅 open 且 DDL 到期才算已过期', () => {
    expect(isOverdueTodo({ status: 'open', dueAt: '2026-11-01T01:59:59.000Z' }, now)).toBe(true)
    expect(isOverdueTodo({ status: 'done', dueAt: '2026-11-01T01:59:59.000Z' }, now)).toBe(false)
    expect(isOverdueTodo({ status: 'abandoned', dueAt: '2026-11-01T01:59:59.000Z' }, now)).toBe(
      false,
    )
  })
})

describe('isAutoArchived：30 天自动归档边界', () => {
  const now = new Date('2026-11-30T12:00:00.000Z')

  it('进行中永不归档', () => {
    expect(
      isAutoArchived({ status: 'open', settledAt: null, doneAt: null, abandonedAt: null }, now),
    ).toBe(false)
  })

  it('正好 30 天不归档，超过 30 天（哪怕 1 秒）自动归档', () => {
    const exact30d = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString()
    const over30d = new Date(now.getTime() - 30 * 24 * 3600 * 1000 - 1000).toISOString()
    expect(
      isAutoArchived(
        { status: 'done', settledAt: exact30d, doneAt: exact30d, abandonedAt: null },
        now,
      ),
    ).toBe(false)
    expect(
      isAutoArchived(
        { status: 'done', settledAt: over30d, doneAt: over30d, abandonedAt: null },
        now,
      ),
    ).toBe(true)
    expect(
      isAutoArchived(
        { status: 'abandoned', settledAt: over30d, doneAt: null, abandonedAt: over30d },
        now,
      ),
    ).toBe(true)
  })
})

describe('formatDue & 视图/模式解析 & 事件按日分组 & 数组重排', () => {
  const now = new Date('2026-11-01T02:00:00.000Z')

  it('按用户时区格式化 DDL', () => {
    expect(formatDue('2026-11-01T15:59:00.000Z', now, 'Asia/Shanghai')).toBe('今天 23:59')
    expect(formatDue('2026-11-01T16:00:00.000Z', now, 'Asia/Shanghai')).toBe('明天 00:00')
    expect(formatDue('2026-10-31T10:00:00.000Z', now, 'Asia/Shanghai')).toBe('昨天 18:00')
    expect(formatDue('2026-11-01T15:59:00.000Z', now, 'America/New_York')).toBe('明天 10:59')
  })

  it('parseTodoView & parseTodoLayoutMode', () => {
    expect(parseTodoView('log')).toBe('log')
    expect(parseTodoView('other')).toBe('list')
    expect(parseTodoLayoutMode('quadrant')).toBe('quadrant')
    expect(parseTodoLayoutMode('invalid')).toBe('list')
  })

  it('groupEventsByLocalDate 按时区日历日分组', () => {
    const events = [
      {
        id: '1',
        todoId: null,
        eventType: 'completed' as const,
        todoTitle: 'A',
        groupName: '默认待办',
        meta: {},
        occurredAt: '2026-11-01T16:30:00.000Z', // 北京时间 11-02 00:30
        isArchived: false,
      },
      {
        id: '2',
        todoId: null,
        eventType: 'created' as const,
        todoTitle: 'B',
        groupName: '默认待办',
        meta: {},
        occurredAt: '2026-11-01T15:30:00.000Z', // 北京时间 11-01 23:30
        isArchived: false,
      },
    ]
    const grouped = groupEventsByLocalDate(events, 'Asia/Shanghai')
    expect(grouped.map(([day]) => day)).toEqual(['2026-11-02', '2026-11-01'])
  })

  it('moveArrayItem 安全重排不修改原数组', () => {
    const src = ['a', 'b', 'c', 'd']
    expect(moveArrayItem(src, 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveArrayItem(src, 3, 1)).toEqual(['a', 'd', 'b', 'c'])
    expect(src).toEqual(['a', 'b', 'c', 'd'])
  })
})
