'use client'

import type { CSSProperties } from 'react'
import { Icon } from '@/components/ui/icon'
import { softToneClass } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
import { dueStatus, formatDue, TODO_PRIORITY_META } from '../rules'
import type { Todo } from '../schemas'
import type { LongPressReorderBinding } from '../use-long-press-reorder'

/*
 * 单条待办紧凑行（Todo v2）：
 * - 严格三段防重叠布局：左「打卡圆圈」(44x44 触控区) + 中「标题省略(...) + 副标题(DDL + 四象限Tag + 自定义Tag)」+ 右「删除按钮(触发二次确认)」；
 * - 标题容器强制 min-w-0 flex-1 overflow-hidden + truncate，超长必出 ... 绝不覆盖右侧垃圾桶按钮；
 * - 支持长按整行进入组内拖拽排序态。
 */

export interface TodoRowProps {
  todo: Todo
  now: Date
  timeZone: string
  /** 是否在副标题中显示来源分组名（用于已过期 / 已完成 / 已放弃 / 四象限 / 已归档） */
  showGroupBadge?: boolean
  /** 紧凑模式（四象限卡内使用） */
  compact?: boolean
  onToggle: (todo: Todo) => void
  onOpenManage: (todo: Todo) => void
  onRequestDelete: (todo: Todo) => void
  /** 长按拖拽排序支持 */
  itemRef?: (node: HTMLElement | null) => void
  dragBind?: LongPressReorderBinding
  isDragging?: boolean
  dragOffsetY?: number
  shouldSuppressClick?: () => boolean
}

export function TodoRow({
  todo,
  now,
  timeZone,
  showGroupBadge = false,
  compact = false,
  onToggle,
  onOpenManage,
  onRequestDelete,
  itemRef,
  dragBind,
  isDragging = false,
  dragOffsetY = 0,
  shouldSuppressClick,
}: TodoRowProps) {
  const isDone = todo.status === 'done'
  const isAbandoned = todo.status === 'abandoned'
  const isSettled = isDone || isAbandoned
  const dStatus = isSettled ? 'none' : dueStatus(todo.dueAt, now)
  const priorityMeta = TODO_PRIORITY_META[todo.priority]

  const dragStyle: CSSProperties | undefined = isDragging
    ? { transform: `translate3d(0, ${dragOffsetY}px, 0) scale(1.015)`, zIndex: 20 }
    : undefined

  return (
    <li
      ref={itemRef}
      style={dragStyle}
      className={cn(
        'relative w-full min-w-0 list-none select-none',
        isDragging
          ? 'bg-surface shadow-float ring-primary/45 rounded-xl ring-2 transition-shadow'
          : 'transition-transform duration-(--dur-fast)',
      )}
      {...dragBind}
    >
      <div
        className={cn(
          'flex w-full min-w-0 items-center rounded-xl transition-colors duration-(--dur-fast)',
          compact ? 'gap-0.5 px-1 py-1 sm:gap-1 sm:px-1.5' : 'gap-1 px-1.5 py-1',
          !isDragging && 'hover:bg-surface-sunken/65',
        )}
      >
        {/* 左：打卡圆圈（常规列表保证 44x44px 触控区，四象限双列紧凑态自动收敛不挤占标题） */}
        <button
          type="button"
          data-no-drag="true"
          role="checkbox"
          aria-checked={isDone}
          aria-label={
            isDone
              ? `取消完成：${todo.title}`
              : isAbandoned
                ? `恢复待办：${todo.title}`
                : `完成：${todo.title}`
          }
          onClick={() => onToggle(todo)}
          className={cn(
            'flex shrink-0 items-center justify-center',
            compact ? 'size-7 sm:size-9' : 'size-10 sm:size-11',
          )}
        >
          <span
            className={cn(
              'ease-spring flex items-center justify-center rounded-full border-2 transition-[transform,background-color,border-color] duration-(--dur-base) active:scale-90',
              compact ? 'size-4.5 sm:size-5' : 'size-5.5',
              isDone
                ? 'border-success bg-success text-surface scale-105'
                : isAbandoned
                  ? 'border-border-strong bg-surface-sunken text-muted'
                  : dStatus === 'overdue'
                    ? 'border-danger/70 bg-surface'
                    : 'border-border-strong bg-surface',
            )}
          >
            {isDone && (
              <Icon name="check" size={13} strokeWidth={3} className="animate-pop-in" lineOnly />
            )}
            {isAbandoned && <Icon name="ban" size={12} strokeWidth={2.2} lineOnly />}
          </span>
        </button>

        {/* 中：标题概要（严格 truncate 省略，绝不覆盖右侧按钮） + 副标题（DDL + 四象限Tag + 自定义Tag） */}
        <button
          type="button"
          onClick={() => {
            if (shouldSuppressClick?.()) return
            onOpenManage(todo)
          }}
          aria-label={`管理待办：${todo.title}`}
          className={cn(
            'flex min-w-0 flex-1 flex-col justify-center overflow-hidden py-0.5 text-left',
            compact ? 'min-h-8 sm:min-h-9' : 'min-h-10',
          )}
        >
          <div className="flex min-w-0 items-center gap-1">
            <span
              className={cn(
                'block min-w-0 flex-1 truncate leading-snug font-semibold transition-colors duration-(--dur-base)',
                compact ? 'text-tiny sm:text-caption' : 'text-caption',
                isSettled && 'text-subtle line-through',
              )}
            >
              {todo.title}
            </span>
            {todo.note && (
              <Icon name="note" size={12} className="text-subtle shrink-0" aria-hidden />
            )}
          </div>

          {/* 副标题行：DDL 在左，右侧响应式排布四象限 Tag、自定义 Tag 与状态/分组标记 */}
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
            {todo.dueAt !== null && (
              <span
                className={cn(
                  'text-tiny inline-flex shrink-0 items-center gap-0.5 leading-none tabular-nums',
                  dStatus === 'overdue'
                    ? 'text-danger-ink font-semibold'
                    : dStatus === 'soon'
                      ? 'text-warning-ink font-semibold'
                      : 'text-muted',
                )}
              >
                <Icon name="clock" size={11} lineOnly />
                <span>{formatDue(todo.dueAt, now, timeZone)}</span>
              </span>
            )}

            {/* 四象限优先级 Tag（在非四象限紧凑卡片或按需完整展示） */}
            {!compact && (
              <span
                className={cn(
                  'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[11px] leading-none font-semibold',
                  softToneClass[priorityMeta.tone],
                )}
              >
                {priorityMeta.shortLabel}
              </span>
            )}

            {/* 自定义标签（响应式流式换行） */}
            {todo.tags.map((tag) => (
              <span
                key={tag}
                className="bg-surface-sunken text-muted border-border inline-flex max-w-28 shrink-0 items-center gap-0.5 truncate rounded-full border px-1.5 py-0.5 text-[11px] leading-none font-medium"
              >
                <span className="truncate">#{tag}</span>
              </span>
            ))}

            {showGroupBadge && (
              <span className="bg-primary-soft/55 text-primary-ink inline-flex max-w-24 shrink-0 items-center truncate rounded-full px-1.5 py-0.5 text-[11px] leading-none font-medium">
                <span className="truncate">{todo.groupName}</span>
              </span>
            )}

            {dStatus === 'soon' && (
              <span className="bg-warning-soft text-warning-ink inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[11px] leading-none font-semibold">
                快到期
              </span>
            )}
            {dStatus === 'overdue' && (
              <span className="bg-danger-soft text-danger-ink inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[11px] leading-none font-semibold">
                已过期
              </span>
            )}
            {isAbandoned && todo.abandonReason && (
              <span className="text-tiny text-subtle max-w-36 truncate leading-none">
                · {todo.abandonReason}
              </span>
            )}
          </div>
        </button>

        {/* 右：删除按钮（固定占位 shrink-0，点击弹出 ConfirmDialog 二次确认） */}
        <button
          type="button"
          data-no-drag="true"
          aria-label={`删除：${todo.title}`}
          onClick={() => onRequestDelete(todo)}
          className={cn(
            'ease-spring text-subtle hover:bg-danger-soft/60 hover:text-danger-ink flex shrink-0 items-center justify-center rounded-full transition-[transform,color,background-color] duration-(--dur-fast) active:scale-90',
            compact ? 'size-7 sm:size-9' : 'size-10 sm:size-11',
          )}
        >
          <Icon name="trash" size={compact ? 14 : 16} lineOnly />
        </button>
      </div>
    </li>
  )
}
