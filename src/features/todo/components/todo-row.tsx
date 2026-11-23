'use client'

import type { CSSProperties } from 'react'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { axesFromPriority, dueStatus, formatDue } from '../rules'
import { TODO_DEFAULT_GROUP_NAME, type Todo } from '../schemas'
import type { LongPressReorderBinding } from '../use-long-press-reorder'

/*
 * 单条待办紧凑行（Todo v2）：
 * - 严格三段防重叠布局：左「打卡圆圈」+ 中「标题省略(...) + 副标题」+ 右「删除按钮(触发二次确认)」；
 * - 普通模式：已过期不显示单独「已过期」标签，改用红色标题文字直观标识；「默认待办」不显示为来源分组标签；
 *   紧急与重要分别以独立 SVG 图标胶囊（沙漏 / 星标）呈现，不紧急或不重要时不占空间；
 * - 四象限紧凑模式（compact）：不显示任何标签，仅展示缩微标题与截止日期，提升双列信息密度；
 * - 支持长按整行进入组内拖拽排序态。
 */

export interface TodoRowProps {
  todo: Todo
  now: Date
  timeZone: string
  /** 是否在副标题中显示来源分组名（用于已过期 / 已完成 / 已放弃 / 已归档，自动跳过「默认待办」） */
  showGroupBadge?: boolean
  /** 紧凑模式（四象限卡内使用：隐藏所有标签，仅展示缩微标题与截止日期） */
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
  const { importance, urgency } = axesFromPriority(todo.priority)

  const showUrgentBadge = !compact && urgency === 'urgent'
  const showImportantBadge = !compact && importance === 'important'
  const showCustomTags = !compact && todo.tags.length > 0
  const showCustomGroupBadge =
    !compact && showGroupBadge && todo.groupName !== TODO_DEFAULT_GROUP_NAME
  const showSoonBadge = !compact && dStatus === 'soon'
  const showAbandonReason = !compact && isAbandoned && Boolean(todo.abandonReason)
  const hasSubtitle =
    todo.dueAt !== null ||
    showUrgentBadge ||
    showImportantBadge ||
    showCustomTags ||
    showCustomGroupBadge ||
    showSoonBadge ||
    showAbandonReason

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
          compact ? 'gap-0.5 px-0.5 py-0.5 sm:gap-1 sm:px-1' : 'gap-1 px-1.5 py-1',
          !isDragging && 'hover:bg-surface-sunken/65',
        )}
      >
        {/* 左：打卡圆圈（常规列表保证 40-44px 触控区，四象限双列紧凑态收敛不挤占标题） */}
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
            compact ? 'size-5 sm:size-6' : 'size-10 sm:size-11',
          )}
        >
          <span
            className={cn(
              'ease-spring flex items-center justify-center rounded-full transition-[transform,background-color,border-color] duration-(--dur-base) active:scale-90',
              compact ? 'size-3.5 border-[1.5px] sm:size-4' : 'size-5.5 border-2',
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
              <Icon
                name="check"
                size={compact ? 9 : 13}
                strokeWidth={3}
                className="animate-pop-in"
                lineOnly
              />
            )}
            {isAbandoned && <Icon name="ban" size={compact ? 9 : 12} strokeWidth={2.2} lineOnly />}
          </span>
        </button>

        {/* 中：标题概要（严格 truncate 省略，绝不覆盖右侧按钮） + 副标题 */}
        <button
          type="button"
          onClick={() => {
            if (shouldSuppressClick?.()) return
            onOpenManage(todo)
          }}
          aria-label={`管理待办：${todo.title}`}
          className={cn(
            'flex min-w-0 flex-1 flex-col justify-center overflow-hidden text-left',
            compact ? 'min-h-6 py-0.5 sm:min-h-7' : 'min-h-10 py-0.5',
          )}
        >
          <div className="flex min-w-0 items-center gap-1">
            <span
              className={cn(
                'block min-w-0 flex-1 truncate font-semibold transition-colors duration-(--dur-base)',
                compact ? 'text-[10px] leading-[1.25] sm:text-[11px]' : 'text-caption leading-snug',
                isSettled ? 'text-subtle line-through' : dStatus === 'overdue' && 'text-danger-ink',
              )}
            >
              {todo.title}
            </span>
            {!compact && todo.note && (
              <Icon name="note" size={12} className="text-subtle shrink-0" aria-hidden />
            )}
          </div>

          {hasSubtitle && (
            <div
              className={cn(
                'flex min-w-0 flex-wrap items-center',
                compact ? 'mt-0.5 gap-x-1' : 'mt-0.5 gap-x-1.5 gap-y-1',
              )}
            >
              {todo.dueAt !== null && (
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center gap-0.5 leading-none tabular-nums',
                    compact ? 'text-[9px] sm:text-[10px]' : 'text-tiny',
                    dStatus === 'overdue'
                      ? 'text-danger-ink font-semibold'
                      : dStatus === 'soon'
                        ? 'text-warning-ink font-semibold'
                        : 'text-muted',
                  )}
                >
                  <Icon name="clock" size={compact ? 9 : 11} lineOnly />
                  <span>{formatDue(todo.dueAt, now, timeZone)}</span>
                </span>
              )}

              {/* 紧急度 & 重要度独立 SVG 图标标签（不紧急/不重要时不显示，节省空间） */}
              {showUrgentBadge && (
                <span
                  data-todo-priority-tag="urgent"
                  title="紧急"
                  aria-label="紧急"
                  className="bg-danger-soft text-danger-ink inline-flex h-4.5 shrink-0 items-center justify-center rounded-full px-1.5"
                >
                  <Icon name="hourglass" size={11} strokeWidth={2.2} lineOnly />
                </span>
              )}
              {showImportantBadge && (
                <span
                  data-todo-priority-tag="important"
                  title="重要"
                  aria-label="重要"
                  className="bg-warning-soft text-warning-ink inline-flex h-4.5 shrink-0 items-center justify-center rounded-full px-1.5"
                >
                  <Icon name="star" size={11} strokeWidth={2.2} lineOnly />
                </span>
              )}

              {/* 自定义标签（仅普通模式显示） */}
              {showCustomTags &&
                todo.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-surface-sunken text-muted border-border inline-flex max-w-28 shrink-0 items-center gap-0.5 truncate rounded-full border px-1.5 py-0.5 text-[11px] leading-none font-medium"
                  >
                    <span className="truncate">#{tag}</span>
                  </span>
                ))}

              {/* 自定义来源分组名（不把「默认待办」作为标签显示） */}
              {showCustomGroupBadge && (
                <span className="bg-primary-soft/55 text-primary-ink inline-flex max-w-24 shrink-0 items-center truncate rounded-full px-1.5 py-0.5 text-[11px] leading-none font-medium">
                  <span className="truncate">{todo.groupName}</span>
                </span>
              )}

              {showSoonBadge && (
                <span className="bg-warning-soft text-warning-ink inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[11px] leading-none font-semibold">
                  快到期
                </span>
              )}
              {showAbandonReason && (
                <span className="text-tiny text-subtle max-w-36 truncate leading-none">
                  · {todo.abandonReason}
                </span>
              )}
            </div>
          )}
        </button>

        {/* 右：删除按钮（固定占位 shrink-0，点击弹出 ConfirmDialog 二次确认） */}
        <button
          type="button"
          data-no-drag="true"
          aria-label={`删除：${todo.title}`}
          onClick={() => onRequestDelete(todo)}
          className={cn(
            'ease-spring text-subtle hover:bg-danger-soft/60 hover:text-danger-ink flex shrink-0 items-center justify-center rounded-full transition-[transform,color,background-color] duration-(--dur-fast) active:scale-90',
            compact ? 'size-5 sm:size-6' : 'size-10 sm:size-11',
          )}
        >
          <Icon name="trash" size={compact ? 11 : 16} lineOnly />
        </button>
      </div>
    </li>
  )
}
