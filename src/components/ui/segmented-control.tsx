import type { KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'

export interface SegmentOption<V extends string> {
  value: V
  label: string
}

interface SegmentedControlProps<V extends string> {
  options: readonly SegmentOption<V>[]
  value: V
  onValueChange: (value: V) => void
  label: string
  size?: 'sm' | 'md'
  className?: string
}

/**
 * 分段切换：页面内的视图切换（日 / 周 / 月、清单 / 时间日志）。
 * 选项等宽，滑块按下标平移；方向键可切换（WAI-ARIA radiogroup）。
 */
export function SegmentedControl<V extends string>({
  options,
  value,
  onValueChange,
  label,
  size = 'md',
  className,
}: SegmentedControlProps<V>) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    e.preventDefault()
    const next = options[(index + step + options.length) % options.length]
    if (!next) return
    onValueChange(next.value)
    const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    buttons[(index + step + options.length) % options.length]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'bg-surface-sunken relative grid rounded-full p-1',
        size === 'sm' ? 'h-9' : 'h-11',
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="bg-surface shadow-soft ease-spring absolute top-1 bottom-1 left-1 rounded-full transition-transform duration-(--dur-base)"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((o, i) => {
        const selected = i === index
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onValueChange(o.value)}
            className={cn(
              'relative z-10 rounded-full px-3 font-semibold transition-colors duration-(--dur-fast)',
              size === 'sm' ? 'text-tiny' : 'text-caption',
              selected ? 'text-foreground' : 'text-muted hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
