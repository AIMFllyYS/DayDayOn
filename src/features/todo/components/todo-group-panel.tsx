'use client'

import type { CSSProperties, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Collapse } from '@/components/ui/collapse'
import { Icon, type IconName } from '@/components/ui/icon'
import { Skeleton } from '@/components/ui/skeleton'
import { softToneClass, type Tone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
import type { Todo } from '../schemas'
import { useLongPressReorder, type LongPressReorderBinding } from '../use-long-press-reorder'
import { TodoRow } from './todo-row'

/*
 * 可折叠待办小面板（用于自定义分组、已过期、已完成、已放弃）：
 * - 紧凑手账卡片风格，折叠态仅占一行高度；
 * - 折叠时 unmountOnCollapse=true，不渲染内部待办 DOM，兼顾性能与流畅度；
 * - 支持两种长按拖拽：
 *   1. 长按分组面板头（由外层传 groupDragBind）调整分组顺序；
 *   2. 长按组内待办行（由 onReorderTodos 开启）调整组内待办顺序。
 */

export interface TodoGroupPanelProps {
  title: string
  subtitle?: string
  icon: IconName
  tone?: Tone
  count: number
  /** 附加提示胶囊，如「1 快到期」 */
  alertText?: string
  alertTone?: Tone
  open: boolean
  onToggleOpen: () => void
  loading?: boolean
  items: readonly Todo[]
  emptyText?: string
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
  showGroupBadge?: boolean
  now: Date
  timeZone: string
  onToggleTodo: (todo: Todo) => void
  onOpenManage: (todo: Todo) => void
  onRequestDelete: (todo: Todo) => void
  /** 传入则启用组内待办长按拖拽排序 */
  onReorderTodos?: (nextIds: string[]) => void
  /** 面板头外层长按拖拽排序分组支持 */
  panelRef?: (node: HTMLElement | null) => void
  groupDragBind?: LongPressReorderBinding
  isGroupDragging?: boolean
  groupDragOffsetY?: number
  shouldSuppressGroupClick?: () => boolean
  headerExtra?: ReactNode
}

export function TodoGroupPanel({
  title,
  subtitle,
  icon,
  tone = 'neutral',
  count,
  alertText,
  alertTone = 'warning',
  open,
  onToggleOpen,
  loading = false,
  items,
  emptyText = '暂时没有待办',
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  showGroupBadge = false,
  now,
  timeZone,
  onToggleTodo,
  onOpenManage,
  onRequestDelete,
  onReorderTodos,
  panelRef,
  groupDragBind,
  isGroupDragging = false,
  groupDragOffsetY = 0,
  shouldSuppressGroupClick,
  headerExtra,
}: TodoGroupPanelProps) {
  const itemIds = items.map((t) => t.id)
  const itemById = new Map(items.map((t) => [t.id, t]))

  const rowDrag = useLongPressReorder({
    ids: itemIds,
    enabled: Boolean(onReorderTodos) && items.length > 1,
    onReorder: (nextIds) => onReorderTodos?.(nextIds),
  })

  const orderedItems = rowDrag.orderedIds
    .map((id) => itemById.get(id))
    .filter((t): t is Todo => t !== undefined)

  const panelStyle: CSSProperties | undefined = isGroupDragging
    ? { transform: `translate3d(0, ${groupDragOffsetY}px, 0) scale(1.015)`, zIndex: 30 }
    : undefined

  return (
    <section
      ref={panelRef}
      style={panelStyle}
      className={cn(
        'border-border bg-surface relative w-full min-w-0 overflow-hidden rounded-xl border transition-shadow duration-(--dur-fast)',
        isGroupDragging ? 'shadow-float ring-primary/45 ring-2' : 'shadow-soft',
      )}
    >
      {/* 面板头：支持点击折叠/展开，以及长按拖拽排序分组 */}
      <div
        className="flex min-h-10.5 w-full min-w-0 items-center gap-1 pr-2 select-none"
        {...groupDragBind}
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            if (shouldSuppressGroupClick?.()) return
            onToggleOpen()
          }}
          className="flex min-h-10.5 min-w-0 flex-1 items-center gap-2 py-1.5 pl-2.5 text-left"
        >
          <Icon
            name="chevron-down"
            size={14}
            className={cn(
              'text-subtle shrink-0 transition-transform duration-(--dur-base)',
              !open && '-rotate-90',
            )}
          />
          <span
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-lg',
              softToneClass[tone],
            )}
          >
            <Icon name={icon} size={14} lineOnly />
          </span>
          <span className="text-caption text-foreground min-w-0 truncate font-bold">{title}</span>
          {subtitle && <span className="text-tiny text-subtle shrink-0">{subtitle}</span>}
          <span className="font-display bg-surface-sunken text-muted text-tiny ml-auto shrink-0 rounded-full px-2 py-0.5 font-semibold tabular-nums">
            {count}
          </span>
          {alertText && (
            <span
              className={cn(
                'shrink-0 rounded-full px-1.5 py-0.5 text-[11px] leading-none font-semibold',
                softToneClass[alertTone],
              )}
            >
              {alertText}
            </span>
          )}
        </button>
        {headerExtra}
      </div>

      {/* 面板体：收起时卸载内部 DOM，保持零开销 */}
      <Collapse open={open} unmountOnCollapse>
        <div className="border-border/70 border-t px-1.5 py-1.5">
          {loading ? (
            <div role="status" aria-label="加载中" className="grid gap-1.5 p-1">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : orderedItems.length === 0 ? (
            <p className="text-tiny text-subtle px-2 py-3 text-center">{emptyText}</p>
          ) : (
            <>
              <ul className="divide-border/55 grid divide-y divide-dashed">
                {orderedItems.map((todo) => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    now={now}
                    timeZone={timeZone}
                    showGroupBadge={showGroupBadge}
                    onToggle={onToggleTodo}
                    onOpenManage={onOpenManage}
                    onRequestDelete={onRequestDelete}
                    itemRef={onReorderTodos ? rowDrag.registerItem(todo.id) : undefined}
                    dragBind={onReorderTodos ? rowDrag.bindItem(todo.id) : undefined}
                    isDragging={rowDrag.draggingId === todo.id}
                    dragOffsetY={rowDrag.draggingId === todo.id ? rowDrag.dragOffsetY : 0}
                    shouldSuppressClick={rowDrag.shouldSuppressClick}
                  />
                ))}
              </ul>
              {hasMore && onLoadMore && (
                <div className="flex justify-center pt-1.5 pb-0.5">
                  <Button variant="ghost" size="sm" loading={loadingMore} onClick={onLoadMore}>
                    加载更多
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Collapse>
    </section>
  )
}
