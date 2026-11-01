import { describe, expect, it } from 'vitest'
import { compareDoneTodos, dueStatus, formatDue, parseTodoView, sortOpenTodos } from './rules'

const todo = (id: string, dueAt: string | null, createdAt = '2026-10-30T00:00:00.000Z') => ({
  id,
  dueAt,
  createdAt,
})

describe('sortOpenTodos：DDL 升序，没有 DDL 的排后', () => {
  it('按 DDL 时刻排序，null 在最后', () => {
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

  it('不修改原数组', () => {
    const input = [todo('a', null), todo('b', '2026-11-01T00:00:00.000Z')]
    sortOpenTodos(input)
    expect(input.map((t) => t.id)).toEqual(['a', 'b'])
  })
})

describe('compareDoneTodos：完成时间降序', () => {
  it('最近完成的在前，同一时刻按 id 降序', () => {
    const items = [
      { id: 'a', doneAt: '2026-10-30T00:00:00.000Z' },
      { id: 'b', doneAt: '2026-11-01T00:00:00.000Z' },
      { id: 'c', doneAt: '2026-11-01T00:00:00.000Z' },
    ]
    expect([...items].sort(compareDoneTodos).map((t) => t.id)).toEqual(['c', 'b', 'a'])
  })
})

describe('dueStatus：固定 now 下的 DDL 状态', () => {
  const now = new Date('2026-11-01T02:00:00.000Z')

  it('没有 DDL', () => {
    expect(dueStatus(null, now)).toBe('none')
  })

  it('已过 DDL 是已过期；正好到点也算过期', () => {
    expect(dueStatus('2026-11-01T01:59:59.000Z', now)).toBe('overdue')
    expect(dueStatus('2026-11-01T02:00:00.000Z', now)).toBe('overdue')
    expect(dueStatus('2026-10-20T00:00:00.000Z', now)).toBe('overdue')
  })

  it('24 小时内是快到期', () => {
    expect(dueStatus('2026-11-01T02:00:01.000Z', now)).toBe('soon')
    expect(dueStatus('2026-11-02T01:59:59.000Z', now)).toBe('soon')
  })

  it('正好 24 小时及以后不算快到期', () => {
    expect(dueStatus('2026-11-02T02:00:00.000Z', now)).toBe('later')
    expect(dueStatus('2026-11-10T00:00:00.000Z', now)).toBe('later')
  })

  it('now 也可以是 ISO 字符串', () => {
    expect(dueStatus('2026-11-01T03:00:00.000Z', '2026-11-01T02:00:00.000Z')).toBe('soon')
  })
})

describe('formatDue：按用户时区的日历日期', () => {
  // 北京时间 2026-11-01 10:00
  const now = new Date('2026-11-01T02:00:00.000Z')

  it('今天 / 明天 / 昨天', () => {
    expect(formatDue('2026-11-01T15:59:00.000Z', now, 'Asia/Shanghai')).toBe('今天 23:59')
    expect(formatDue('2026-11-01T16:00:00.000Z', now, 'Asia/Shanghai')).toBe('明天 00:00')
    expect(formatDue('2026-10-31T10:00:00.000Z', now, 'Asia/Shanghai')).toBe('昨天 18:00')
  })

  it('更远的日期显示月日和时间', () => {
    expect(formatDue('2026-11-08T04:00:00.000Z', now, 'Asia/Shanghai')).toBe('11月8日 12:00')
  })

  it('换个时区，同一时刻落在不同的日期', () => {
    // 纽约此时是 10-31 22:00（夏令时）；DDL 在 11-01 夏令时结束后，是纽约 11-01 10:59
    expect(formatDue('2026-11-01T15:59:00.000Z', now, 'America/New_York')).toBe('明天 10:59')
  })
})

describe('parseTodoView：非法值回落到 list', () => {
  it.each([
    ['log', 'log'],
    ['list', 'list'],
    [null, 'list'],
    ['LOG', 'list'],
    ['whatever', 'list'],
  ] as const)('%s → %s', (input, expected) => {
    expect(parseTodoView(input)).toBe(expected)
  })
})
