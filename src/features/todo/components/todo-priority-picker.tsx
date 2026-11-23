'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import {
  axesFromPriority,
  priorityFromAxes,
  TODO_PRIORITY_META,
  type TodoImportance,
  type TodoUrgency,
} from '../rules'
import type { TodoPriority } from '../schemas'

/*
 * 四象限优先级双维度选择器：
 * 左侧为「普通 / 重要」两个小圆点按钮，右侧为「不紧急 / 紧急」程度调节，
 * 顶部实时回显对应四象限标签（重要且紧急 / 重要不紧急 / 紧急不重要 / 不重要不紧急）。
 */

interface TodoPriorityPickerProps {
  value: TodoPriority
  onValueChange: (next: TodoPriority) => void
  disabled?: boolean
}

export function TodoPriorityPicker({
  value,
  onValueChange,
  disabled = false,
}: TodoPriorityPickerProps) {
  const { importance, urgency } = axesFromPriority(value)
  const meta = TODO_PRIORITY_META[value]

  function setImportance(next: TodoImportance) {
    onValueChange(priorityFromAxes(next, urgency))
  }

  function setUrgency(next: TodoUrgency) {
    onValueChange(priorityFromAxes(importance, next))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption font-semibold">优先级（四象限）</span>
        <Badge tone={meta.tone} dot>
          {meta.label}
        </Badge>
      </div>

      <div className="border-border bg-surface-sunken/70 grid grid-cols-1 gap-2 rounded-xl border p-2.5 sm:grid-cols-2">
        {/* 左侧：普通 / 重要小圆按钮 */}
        <div role="radiogroup" aria-label="重要程度" className="flex items-center gap-1.5">
          <span className="text-tiny text-muted mr-1 shrink-0 font-semibold">重要度</span>
          <AxisPill
            checked={importance === 'normal'}
            disabled={disabled}
            label="普通"
            onClick={() => setImportance('normal')}
          />
          <AxisPill
            checked={importance === 'important'}
            disabled={disabled}
            label="重要"
            accent="primary"
            onClick={() => setImportance('important')}
          />
        </div>

        {/* 右侧：不紧急 / 紧急程度调节 */}
        <div role="radiogroup" aria-label="紧急程度" className="flex items-center gap-1.5">
          <span className="text-tiny text-muted mr-1 shrink-0 font-semibold">紧急度</span>
          <AxisPill
            checked={urgency === 'normal'}
            disabled={disabled}
            label="不紧急"
            onClick={() => setUrgency('normal')}
          />
          <AxisPill
            checked={urgency === 'urgent'}
            disabled={disabled}
            label="紧急"
            accent="danger"
            onClick={() => setUrgency('urgent')}
          />
        </div>
      </div>
    </div>
  )
}

function AxisPill({
  checked,
  disabled,
  label,
  accent = 'neutral',
  onClick,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  accent?: 'neutral' | 'primary' | 'danger'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'ease-spring text-tiny flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full border px-2.5 font-semibold transition-[transform,background-color,border-color,color] duration-(--dur-fast) active:scale-95 disabled:opacity-50',
        checked
          ? accent === 'danger'
            ? 'border-danger/50 bg-danger-soft text-danger-ink'
            : accent === 'primary'
              ? 'border-primary/45 bg-primary-soft text-primary-ink'
              : 'border-border-strong bg-surface text-foreground shadow-soft'
          : 'border-border bg-surface/70 text-muted hover:bg-surface',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-3.5 items-center justify-center rounded-full border-2 transition-colors',
          checked
            ? accent === 'danger'
              ? 'border-danger bg-danger'
              : accent === 'primary'
                ? 'border-primary bg-primary'
                : 'border-foreground bg-foreground'
            : 'border-border-strong bg-transparent',
        )}
      >
        {checked && <span className="bg-surface size-1.5 rounded-full" />}
      </span>
      <span>{label}</span>
    </button>
  )
}
