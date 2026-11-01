import { Badge } from '@/components/ui/badge'
import { IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { dueStatus, formatDue } from '../rules'
import type { Todo } from '../schemas'

/*
 * 一条待办（原型 TodoScreen 的 TodoRow）。勾选框回弹 + 对勾弹出；完成后标题划线。
 * 点标题打开编辑抽屉；右侧删除按钮（可撤销，不弹确认）。整行的可点区域都不小于 44px。
 */

interface TodoRowProps {
  todo: Todo
  now: Date
  timeZone: string
  onToggle: (todo: Todo) => void
  onEdit: (todo: Todo) => void
  onDelete: (todo: Todo) => void
}

export function TodoRow({ todo, now, timeZone, onToggle, onEdit, onDelete }: TodoRowProps) {
  const done = todo.doneAt !== null
  const status = done ? 'none' : dueStatus(todo.dueAt, now)
  return (
    <li className="animate-fade-up">
      <Card variant="outline" className="flex items-center gap-1 py-1.5 pr-1.5 pl-2 md:py-1.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={`完成：${todo.title}`}
          onClick={() => onToggle(todo)}
          className="flex size-11 shrink-0 items-center justify-center"
        >
          <span
            className={cn(
              'ease-spring flex size-6 items-center justify-center rounded-lg border-2 transition-[transform,background-color,border-color] duration-(--dur-base) active:scale-90',
              done
                ? 'border-success bg-success text-surface scale-105'
                : 'border-border-strong bg-surface',
            )}
          >
            {done && (
              <Icon name="check" size={14} strokeWidth={3} className="animate-pop-in" lineOnly />
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onEdit(todo)}
          aria-label={`编辑：${todo.title}`}
          className="flex min-h-11 min-w-0 flex-1 flex-col justify-center py-1 text-left"
        >
          <span
            className={cn(
              'block truncate font-semibold transition-colors duration-(--dur-base)',
              done && 'text-subtle line-through',
            )}
          >
            {todo.title}
          </span>
          {todo.dueAt !== null && (
            <span className="text-tiny text-muted flex items-center gap-1">
              <Icon name="clock" size={12} />
              {formatDue(todo.dueAt, now, timeZone)}
            </span>
          )}
        </button>
        <span className="flex shrink-0 items-center gap-1">
          {todo.priority === 'important' && !done && <Badge tone="primary">重要</Badge>}
          {status === 'soon' && (
            <Badge tone="warning" dot>
              快到期
            </Badge>
          )}
          {status === 'overdue' && (
            <Badge tone="danger" dot>
              已过期
            </Badge>
          )}
        </span>
        <IconButton icon="trash" label={`删除：${todo.title}`} onClick={() => onDelete(todo)} />
      </Card>
    </li>
  )
}
