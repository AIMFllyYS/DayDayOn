'use client'

import { useState } from 'react'
import { TodoScreen as TodoScreenView } from '@/features/todo/components/todo-screen'
import { compareDoneTodos, sortOpenTodos, type TodoView } from '@/features/todo/rules'
import type { Todo } from '@/features/todo/schemas'

/*
 * 待办（清单 + DDL，ADR-0003 第 5 项）预览：渲染正式组件 TodoScreen，数据是本地演示数据。
 * 勾选后划线并移到"已完成"；删除直接拿掉（正式页面是 5 秒可撤销的延迟删除）。
 * 演示时间固定在 2026-11-01 10:00（北京时间），徽章状态稳定。
 */

const NOW = new Date('2026-11-01T02:00:00.000Z')
const TZ = 'Asia/Shanghai'

const demo = (id: number, title: string, over: Partial<Todo> = {}): Todo => ({
  id: `0193f6b2-0000-7000-8000-00000000000${id}`,
  title,
  dueAt: null,
  priority: 'normal',
  doneAt: null,
  createdAt: '2026-10-30T02:00:00.000Z',
  updatedAt: '2026-10-30T02:00:00.000Z',
  ...over,
})

const initial: Todo[] = [
  demo(1, '交数据结构实验报告', { dueAt: '2026-11-01T15:59:00.000Z', priority: 'important' }),
  demo(2, '还图书馆的书', { dueAt: '2026-10-31T10:00:00.000Z' }),
  demo(3, '买牛奶和燕麦', { dueAt: '2026-11-02T10:00:00.000Z' }),
  demo(4, '整理本周错题', { dueAt: '2026-11-08T12:00:00.000Z' }),
  demo(5, '给妈妈打电话'),
  demo(6, '晨跑 3km', { doneAt: '2026-10-31T23:10:00.000Z' }),
]

export function TodoScreen() {
  const [items, setItems] = useState(initial)
  const [view, setView] = useState<TodoView>('list')
  const toggle = (t: Todo) =>
    setItems((list) =>
      list.map((x) =>
        x.id === t.id ? { ...x, doneAt: x.doneAt === null ? NOW.toISOString() : null } : x,
      ),
    )
  return (
    <TodoScreenView
      view={view}
      onViewChange={setView}
      onCreate={() => {}}
      status="ready"
      open={sortOpenTodos(items.filter((t) => t.doneAt === null))}
      done={items.filter((t) => t.doneAt !== null).sort(compareDoneTodos)}
      now={NOW}
      timeZone={TZ}
      onToggle={toggle}
      onEdit={() => {}}
      onDelete={(t) => setItems((list) => list.filter((x) => x.id !== t.id))}
    />
  )
}
