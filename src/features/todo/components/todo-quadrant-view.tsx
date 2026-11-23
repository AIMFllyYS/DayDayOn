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
 * - 严格 2x2 四象限网格布局（手机与桌面均为两列两行），四个象限宽高固定一致，每个象限内部独立滚动；
 * - 不考虑分组，仅展示全部进行中待办（含已过期，排除已完成与已放弃）；
 * - 每个象限内部按创建时间从近到远排序（createdAt DESC），每象限独立分页按需加载更多。
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
      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] grid-rows-2 gap-2 sm:gap-2.5"
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
  const items = query.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <QuadrantCardFrame
      priority={priority}
      count={count}
      loading={count > 0 && query.isPending}
      items={items}
      hasMore={query.hasNextPage}
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
      className="border-border bg-surface shadow-soft flex h-60 min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border sm:h-72 md:h-80"
    >
      <header className="border-border/70 flex shrink-0 items-center justify-between gap-1.5 border-b px-2 py-1.5 sm:px-3 sm:py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[11px] leading-none font-bold sm:px-2',
              softToneClass[meta.tone],
            )}
          >
            {meta.label}
          </span>
          <span className="text-tiny text-subtle hidden min-w-0 truncate sm:inline">
            {meta.description}
          </span>
        </div>
        <span className="font-display bg-surface-sunken text-muted text-tiny shrink-0 rounded-full px-1.5 py-0.5 font-semibold tabular-nums sm:px-2">
          {count}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-1 sm:px-1.5 sm:py-1.5">
        {loading ? (
          <div className="grid gap-1.5 p-1">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full items-center justify-center px-2">
            <p className="text-tiny text-subtle text-center">暂无待办</p>
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
                  showGroupBadge
                  onToggle={onToggleTodo}
                  onOpenManage={onOpenManage}
                  onRequestDelete={onRequestDelete}
                />
              ))}
            </ul>
            {hasMore && onLoadMore && (
              <div className="flex justify-center pt-1.5">
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
