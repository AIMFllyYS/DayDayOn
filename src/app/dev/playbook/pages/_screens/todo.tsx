'use client'

import { useState } from 'react'
import { Mascot } from '@/components/mascot/mascot'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { cn } from '@/lib/cn'

/*
 * 待办（清单 + DDL，ADR-0003 第 5 项）。勾选后划线并移到"已完成"。
 * 时间日志视图在 v0.2，这里只占位。
 */
interface Todo {
  id: number
  title: string
  due: string
  urgent?: boolean
  done: boolean
}

const initial: Todo[] = [
  { id: 1, title: '交数据结构实验报告', due: '今天 23:59', urgent: true, done: false },
  { id: 2, title: '给妈妈打电话', due: '今天', done: false },
  { id: 3, title: '买牛奶和燕麦', due: '明天', done: false },
  { id: 4, title: '整理本周错题', due: '周日', done: false },
  { id: 5, title: '晨跑 3km', due: '今天 07:00', done: true },
]

const views = [
  { value: 'list', label: '清单' },
  { value: 'log', label: '时间日志' },
] as const

export function TodoScreen() {
  const [items, setItems] = useState(initial)
  const [view, setView] = useState<(typeof views)[number]['value']>('list')
  const open = items.filter((t) => !t.done)
  const done = items.filter((t) => t.done)
  const toggle = (id: number) =>
    setItems((list) => list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-3">
      <div className="flex items-center gap-2">
        <SegmentedControl
          options={views}
          value={view}
          onValueChange={setView}
          label="待办视图"
          size="sm"
          className="w-48"
        />
        <Button variant="soft" size="sm" icon="plus" className="ml-auto">
          新建
        </Button>
      </div>

      {view === 'log' ? (
        <Card variant="sunken" className="flex flex-col items-center gap-2 py-8 text-center">
          <Mascot mood="thinking" size={72} />
          <p className="font-semibold">时间日志在 v0.2 上线</p>
          <p className="text-caption text-muted">先用清单记下要做的事吧</p>
        </Card>
      ) : (
        <>
          <p className="text-tiny text-muted px-1 font-semibold">进行中 · {open.length}</p>
          <ul className="grid gap-2">
            {open.map((t) => (
              <TodoRow key={t.id} todo={t} onToggle={toggle} />
            ))}
          </ul>
          {done.length > 0 && (
            <>
              <p className="text-tiny text-muted mt-1 px-1 font-semibold">已完成 · {done.length}</p>
              <ul className="grid gap-2">
                {done.map((t) => (
                  <TodoRow key={t.id} todo={t} onToggle={toggle} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}

function TodoRow({ todo, onToggle }: { todo: Todo; onToggle: (id: number) => void }) {
  return (
    <li className="animate-fade-up">
      <Card variant="outline" className="flex items-center gap-3 py-3 md:py-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={todo.done}
          aria-label={`完成：${todo.title}`}
          onClick={() => onToggle(todo.id)}
          className="-m-2 flex size-11 shrink-0 items-center justify-center"
        >
          <span
            className={cn(
              'ease-spring flex size-6 items-center justify-center rounded-lg border-2 transition-[transform,background-color,border-color] duration-(--dur-base) active:scale-90',
              todo.done
                ? 'border-success bg-success text-surface scale-105'
                : 'border-border-strong bg-surface',
            )}
          >
            {todo.done && <Icon name="check" size={14} strokeWidth={3} />}
          </span>
        </button>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate font-semibold transition-colors duration-(--dur-base)',
              todo.done && 'text-subtle line-through',
            )}
          >
            {todo.title}
          </span>
          <span className="text-tiny text-muted flex items-center gap-1">
            <Icon name="clock" size={12} />
            {todo.due}
          </span>
        </span>
        {todo.urgent && !todo.done && (
          <Badge tone="danger" dot>
            快到期
          </Badge>
        )}
      </Card>
    </li>
  )
}
