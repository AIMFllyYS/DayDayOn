import { cn } from '@/lib/cn'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** 读屏名称；界面上有可见标签时用 aria-labelledby 关联也可以 */
  label: string
  disabled?: boolean
  className?: string
}

export function Switch({ checked, onCheckedChange, label, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        // 外层 44px 高保证触控区域，视觉上的轨道是 28px
        'group inline-flex h-11 w-14 shrink-0 items-center justify-center disabled:opacity-50',
        className,
      )}
    >
      <span
        className={cn(
          'ease-standard relative h-7 w-12 rounded-full transition-colors duration-(--dur-base)',
          checked ? 'bg-primary' : 'bg-border-strong',
        )}
      >
        <span
          className={cn(
            'bg-surface shadow-soft absolute top-0.5 left-0.5 size-6 rounded-full',
            'ease-spring transition-transform duration-(--dur-base) group-active:scale-90',
            checked && 'translate-x-5',
          )}
        />
      </span>
    </button>
  )
}
