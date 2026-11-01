import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Skeleton } from '@/components/ui/skeleton'
import { Mascot } from '@/components/mascot/mascot'
import type { TodoView } from '../rules'
import type { Todo } from '../schemas'
import { TodoRow } from './todo-row'

/*
 * 待办页面主体（原型 src/app/dev/playbook/pages/_screens/todo.tsx）。只负责呈现：
 * 数据、勾选、删除都由调用方传入（正式页面是 todo-page.tsx，Playbook 传演示数据）。
 */

const views = [
  { value: 'list', label: '清单' },
  { value: 'log', label: '时间日志' },
] as const

export type TodoScreenStatus = 'loading' | 'error' | 'ready'

export interface TodoScreenProps {
  view: TodoView
  onViewChange: (view: TodoView) => void
  onCreate: () => void
  status: TodoScreenStatus
  /** status = error 时的原因（errorMessage(err)） */
  errorText?: string
  onRetry?: () => void
  retrying?: boolean
  open: readonly Todo[]
  done: readonly Todo[]
  /** 已完成还有更早的（最近 30 天内） */
  doneHasMore?: boolean
  onLoadMoreDone?: () => void
  loadingMoreDone?: boolean
  now: Date
  timeZone: string
  onToggle: (todo: Todo) => void
  onEdit: (todo: Todo) => void
  onDelete: (todo: Todo) => void
}

export function TodoScreen(props: TodoScreenProps) {
  const { view, onViewChange, onCreate } = props
  return (
    <div className="mx-auto grid w-full max-w-2xl min-w-0 gap-3">
      <div className="flex w-full min-w-0 items-center gap-2">
        <SegmentedControl
          options={views}
          value={view}
          onValueChange={onViewChange}
          label="待办视图"
          size="sm"
          className="w-48"
        />
        {view === 'list' && (
          <Button variant="soft" size="sm" icon="plus" className="ml-auto" onClick={onCreate}>
            新建
          </Button>
        )}
      </div>
      {view === 'log' ? <LogPlaceholder /> : <TodoLists {...props} />}
    </div>
  )
}

function LogPlaceholder() {
  return (
    <Card variant="sunken" className="flex flex-col items-center gap-2 py-8 text-center">
      <Mascot mood="thinking" size={72} />
      <p className="font-semibold">时间日志在 v0.2 上线</p>
      <p className="text-caption text-muted">先用清单记下要做的事吧</p>
    </Card>
  )
}

function TodoLists({
  status,
  errorText,
  onRetry,
  retrying,
  open,
  done,
  doneHasMore = false,
  onLoadMoreDone,
  loadingMoreDone = false,
  onCreate,
  ...row
}: TodoScreenProps) {
  if (status === 'loading') return <TodoListSkeleton />
  if (status === 'error') {
    return (
      <ErrorState
        title="待办没加载出来"
        message={errorText}
        onRetry={onRetry}
        retrying={retrying}
      />
    )
  }
  const rowProps = {
    now: row.now,
    timeZone: row.timeZone,
    onToggle: row.onToggle,
    onEdit: row.onEdit,
    onDelete: row.onDelete,
  }
  return (
    <>
      {open.length === 0 ? (
        <EmptyState
          title="今天还没有待办"
          description="记下要做的事，做完勾掉它"
          size={done.length > 0 ? 'compact' : 'md'}
          action={
            <Button variant="soft" icon="plus" onClick={onCreate}>
              新建待办
            </Button>
          }
        />
      ) : (
        <>
          <p className="text-tiny text-muted px-1 font-semibold">进行中 · {open.length}</p>
          <ul className="grid gap-2">
            {open.map((t) => (
              <TodoRow key={t.id} todo={t} {...rowProps} />
            ))}
          </ul>
        </>
      )}
      {done.length > 0 && (
        <>
          <p className="text-tiny text-muted mt-1 px-1 font-semibold">
            已完成 · 最近 30 天{doneHasMore ? '' : ` · ${done.length}`}
          </p>
          <ul className="grid gap-2">
            {done.map((t) => (
              <TodoRow key={t.id} todo={t} {...rowProps} />
            ))}
          </ul>
          {doneHasMore && onLoadMoreDone && (
            <Button
              variant="ghost"
              size="sm"
              className="justify-self-center"
              loading={loadingMoreDone}
              onClick={onLoadMoreDone}
            >
              再看看更早的
            </Button>
          )}
        </>
      )}
    </>
  )
}

/** 整页骨架（Suspense fallback）：视图切换 + 列表 */
export function TodoScreenSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-3">
      <Skeleton className="h-9 w-48 rounded-full" />
      <TodoListSkeleton />
    </div>
  )
}

function TodoListSkeleton() {
  return (
    <div role="status" aria-label="加载中" className="grid gap-2">
      <Skeleton className="h-4 w-20" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-16 w-full rounded-2xl" />
      ))}
    </div>
  )
}
