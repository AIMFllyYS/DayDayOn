import type { KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'
import { themes, type ThemeId } from '@/lib/theme'
import { Icon } from './icon'

interface ThemePickerProps {
  value: ThemeId
  onValueChange: (id: ThemeId) => void
  /** 只显示色块（侧栏、顶栏里用）；默认带名称 */
  compact?: boolean
  className?: string
}

/**
 * 主题色选择。每个色块自己带 data-theme，用该主题的 primary 上色，所以这里不写任何色值。
 * 方向键可切换（radiogroup）。
 */
export function ThemePicker({
  value,
  onValueChange,
  compact = false,
  className,
}: ThemePickerProps) {
  const index = Math.max(
    0,
    themes.findIndex((t) => t.id === value),
  )

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0
    if (step === 0) return
    e.preventDefault()
    const nextIndex = (index + step + themes.length) % themes.length
    const next = themes[nextIndex]
    if (!next) return
    onValueChange(next.id)
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label="主题色"
      onKeyDown={onKeyDown}
      className={cn('flex w-full min-w-0 flex-wrap', compact ? 'gap-1' : 'gap-2', className)}
    >
      {themes.map((t) => {
        const selected = t.id === value
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t.label}
            title={t.label}
            tabIndex={selected ? 0 : -1}
            data-theme={t.id}
            onClick={() => onValueChange(t.id)}
            className={cn(
              'ease-spring flex items-center gap-2 rounded-full transition-[transform,background-color] duration-(--dur-fast) active:scale-95',
              compact ? 'size-9 justify-center' : 'h-10 pr-3 pl-1.5 sm:pr-3.5',
              !compact &&
                (selected ? 'bg-primary-soft text-primary-ink' : 'hover:bg-surface-sunken'),
            )}
          >
            <span
              className={cn(
                'bg-primary text-on-primary flex size-7 shrink-0 items-center justify-center rounded-full',
                selected && 'ring-primary-soft ring-4',
              )}
            >
              {selected && <Icon name="check" size={14} strokeWidth={2.8} />}
            </span>
            {!compact && <span className="text-caption font-semibold">{t.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
