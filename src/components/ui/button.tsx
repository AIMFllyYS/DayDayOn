import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { Icon, type IconName } from './icon'

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

/*
 * primary 是深色低饱和的实底 + 奶油色字，只给一个区域里唯一的主操作；
 * 其余操作优先用 soft（浅底 + 深字，和徽章同一套配色），大面积实底会显得廉价（2026-11-01 评审）。
 */
const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary shadow-primary hover:bg-primary-hover',
  secondary:
    'bg-surface text-foreground border border-border-strong shadow-soft hover:bg-background',
  soft: 'bg-primary-soft text-primary-ink hover:brightness-[0.97]',
  ghost: 'text-foreground hover:bg-surface-sunken',
  danger: 'bg-danger-soft text-danger-ink hover:brightness-[0.97]',
}

// 实底按钮上的图标只画描边：22% 的同色色块叠在实底上会发灰
const solidVariants = new Set<ButtonVariant>(['primary'])

// md 高 44px，满足触控区域下限。sm 在手机宽度下也是 44px，只在 md 断点（桌面）以上收成 36px
const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-11 gap-1.5 px-3.5 text-caption md:h-9',
  md: 'h-11 gap-2 px-5 text-body',
  lg: 'h-13 gap-2 px-6 text-subhead',
}

const iconOnlySizeClass: Record<ButtonSize, string> = {
  sm: 'size-11 md:size-9',
  md: 'size-11',
  lg: 'size-13',
}

const iconSize: Record<ButtonSize, number> = { sm: 16, md: 20, lg: 22 }

// 按下时缩小、松开时用 spring 曲线回弹，是全站统一的"按压"手感
const baseClass =
  'inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none ' +
  'transition-[transform,background-color,filter,box-shadow] duration-(--dur-fast) ease-spring ' +
  'active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconName
  /** 加载中：显示转圈并禁用，按钮宽度不变 */
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(baseClass, variantClass[variant], sizeClass[size], className)}
      {...rest}
    >
      {loading ? (
        <Icon name="loader" size={iconSize[size]} className="animate-spin-slow" />
      ) : (
        icon && <Icon name={icon} size={iconSize[size]} lineOnly={solidVariants.has(variant)} />
      )}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName
  /** 图标按钮必须有可读名称 */
  label: string
  variant?: ButtonVariant
  size?: ButtonSize
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(baseClass, variantClass[variant], iconOnlySizeClass[size], className)}
      {...rest}
    >
      <Icon
        name={icon}
        size={iconSize[size]}
        lineOnly={solidVariants.has(variant)}
        strokeWidth={solidVariants.has(variant) ? 2.4 : 2}
      />
    </button>
  )
}
