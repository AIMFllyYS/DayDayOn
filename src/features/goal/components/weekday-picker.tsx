import { cn } from '@/lib/cn'
import { WEEKDAY_OPTIONS } from '../format'

interface WeekdayPickerProps {
  /** ISO 星期 1–7 */
  value: readonly number[]
  onValueChange: (value: number[]) => void
  /** 读屏名称 */
  label?: string
  /** 对应 Field 的 htmlFor：第一个按钮用这个 id，点标签时聚焦到它 */
  id?: string
  invalid?: boolean
  className?: string
}

/**
 * 计划星期：七个可切换的圆形按钮（周一在前）。至少保留一天由 schema 校验，
 * 这里允许全部取消，方便"先清空再选"。
 */
export function WeekdayPicker({
  value,
  onValueChange,
  label = '计划星期',
  id,
  invalid = false,
  className,
}: WeekdayPickerProps) {
  const selected = new Set(value)

  function toggle(day: number) {
    const next = new Set(selected)
    if (next.has(day)) next.delete(day)
    else next.add(day)
    onValueChange([...next].sort((a, b) => a - b))
  }

  return (
    <div role="group" aria-label={label} className={cn('grid grid-cols-7 gap-1.5', className)}>
      {WEEKDAY_OPTIONS.map((d, i) => {
        const on = selected.has(d.value)
        return (
          <button
            key={d.value}
            id={i === 0 ? id : undefined}
            type="button"
            aria-pressed={on}
            aria-label={`周${d.label}`}
            onClick={() => toggle(d.value)}
            className={cn(
              'text-caption ease-spring mx-auto flex size-11 items-center justify-center rounded-full font-semibold',
              'transition-[transform,background-color,color] duration-(--dur-fast) active:scale-[0.92]',
              on
                ? 'bg-primary text-on-primary shadow-soft'
                : 'bg-surface-sunken text-muted hover:text-foreground',
              invalid && !on && 'ring-danger-soft ring-2',
            )}
          >
            {d.label}
          </button>
        )
      })}
    </div>
  )
}
