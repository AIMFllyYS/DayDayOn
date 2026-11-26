'use client'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { softToneClass } from '@/components/ui/tone'
import { useInfiniteQuery } from '@/lib/api'
import { todoListQuery } from '@/lib/api/queries/todos'
import { cn } from '@/lib/cn'
import { TODO_PRIORITY_META } from '../rules'
import { TODO_PRIORITIES, type Todo, type TodoPriority, type TodoQuadrantCounts } from '../schemas'
import { TodoRow } from './todo-row'

/*
 * 四象限视图（菜单切换）：
 * - 严格 2x2 响应式四象限网格布局（手机与桌面均为两列两行），自动填满双顶栏下方全部剩余视口高度，整页固定不上下滚动；
 * - 每个象限严格占 1/4 空间且内部独立滚动，行内不展示任何标签，仅展示标题与截止日期；
 * - 不考虑分组，仅展示全部进行中待办（含已过期，排除已完成与已放弃），按创建时间由近到远排序并按需分页。
 */

interface TodoQuadrantViewProps {
  counts: TodoQuadrantCounts
  activeTag?: string
  now: Date
  timeZone: string
  onToggleTodo: (todo: Todo) => void
  onOpenManage: (todo: Todo) => void
  onRequestDelete: (todo: Todo) => void
  /** Playbook 离线演示数据（传入时不走网络查询） */
  demoItems?: readonly Todo[]
}

export function TodoQuadrantView({
  counts,
  activeTag,
  now,
  timeZone,
  onToggleTodo,
  onOpenManage,
  onRequestDelete,
  demoItems,
}: TodoQuadrantViewProps) {
  return (
    <div
      data-todo-quadrant-grid="2x2"
      className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:gap-2.5"
    >
      {TODO_PRIORITIES.map((priority) =>
        demoItems ? (
          <QuadrantCardStatic
            key={priority}
            priority={priority}
            items={demoItems.filter((t) => t.status === 'open' && t.priority === priority)}
            now={now}
            timeZone={timeZone}
            onToggleTodo={onToggleTodo}
            onOpenManage={onOpenManage}
            onRequestDelete={onRequestDelete}
          />
        ) : (
          <QuadrantCardLive
            key={priority}
            priority={priority}
            count={counts[priority]}
            activeTag={activeTag}
            now={now}
            timeZone={timeZone}
            onToggleTodo={onToggleTodo}
            onOpenManage={onOpenManage}
            onRequestDelete={onRequestDelete}
          />
        ),
      )}
    </div>
  )
}

function QuadrantCardLive({
  priority,
  count,
  activeTag,
  now,
  timeZone,
  onToggleTodo,
  onOpenManage,
  onRequestDelete,
}: {
  priority: TodoPriority
  count: number
  activeTag?: string
  now: Date
  timeZone: string
  onToggleTodo: (todo: Todo) => void
  onOpenManage: (todo: Todo) => void
  onRequestDelete: (todo: Todo) => void
}) {
  const query = useInfiniteQuery({
    ...todoListQuery('quadrant', { priority, ...(activeTag ? { tag: activeTag } : {}) }),
    enabled: count > 0,
  })
  const items = count === 0 ? [] : (query.data?.pages.flatMap((p) => p.items) ?? [])

  return (
    <QuadrantCardFrame
      priority={priority}
      count={count}
      loading={count > 0 && query.isPending}
      items={items}
      hasMore={count > 0 && query.hasNextPage}
      loadingMore={query.isFetchingNextPage}
      onLoadMore={() => void query.fetchNextPage()}
      now={now}
      timeZone={timeZone}
      onToggleTodo={onToggleTodo}
      onOpenManage={onOpenManage}
      onRequestDelete={onRequestDelete}
    />
  )
}

function QuadrantCardStatic({
  priority,
  items,
  now,
  timeZone,
  onToggleTodo,
  onOpenManage,
  onRequestDelete,
}: {
  priority: TodoPriority
  items: readonly Todo[]
  now: Date
  timeZone: string
  onToggleTodo: (todo: Todo) => void
  onOpenManage: (todo: Todo) => void
  onRequestDelete: (todo: Todo) => void
}) {
  return (
    <QuadrantCardFrame
      priority={priority}
      count={items.length}
      loading={false}
      items={items}
      hasMore={false}
      loadingMore={false}
      now={now}
      timeZone={timeZone}
      onToggleTodo={onToggleTodo}
      onOpenManage={onOpenManage}
      onRequestDelete={onRequestDelete}
    />
  )
}

function QuadrantCardFrame({
  priority,
  count,
  loading,
  items,
  hasMore,
  loadingMore,
  onLoadMore,
  now,
  timeZone,
  onToggleTodo,
  onOpenManage,
  onRequestDelete,
}: {
  priority: TodoPriority
  count: number
  loading: boolean
  items: readonly Todo[]
  hasMore: boolean
  loadingMore: boolean
  onLoadMore?: () => void
  now: Date
  timeZone: string
  onToggleTodo: (todo: Todo) => void
  onOpenManage: (todo: Todo) => void
  onRequestDelete: (todo: Todo) => void
}) {
  const meta = TODO_PRIORITY_META[priority]
  return (
    <section
      data-quadrant={priority}
      className="border-border bg-surface shadow-soft flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border"
    >
      <header className="border-border/70 flex shrink-0 items-center justify-between gap-1 border-b px-2 py-1 sm:px-2.5 sm:py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold sm:px-2 sm:text-[11px]',
              softToneClass[meta.tone],
            )}
          >
            {meta.label}
          </span>
          <span className="text-tiny text-subtle hidden min-w-0 truncate sm:inline">
            {meta.description}
          </span>
        </div>
        <span className="font-display bg-surface-sunken text-muted shrink-0 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold tabular-nums sm:px-2 sm:text-[11px]">
          {count}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-0.5 pb-12 sm:px-1.5 sm:py-1">
        {loading ? (
          <div className="grid gap-1 p-1">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-7 w-full rounded-lg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full items-center justify-center px-2">
            <p className="text-subtle text-center text-[10px] sm:text-[11px]">暂无待办</p>
          </div>
        ) : (
          <>
            <ul className="divide-border/55 grid divide-y divide-dashed">
              {items.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  now={now}
                  timeZone={timeZone}
                  compact
                  onToggle={onToggleTodo}
                  onOpenManage={onOpenManage}
                  onRequestDelete={onRequestDelete}
                />
              ))}
            </ul>
            {hasMore && onLoadMore && (
              <div className="flex justify-center pt-1">
                <Button variant="ghost" size="sm" loading={loadingMore} onClick={onLoadMore}>
                  加载更多
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
