import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/ui/icon'
import { cn } from '@/lib/cn'

/*
 * 长得像按钮的站内链接（<a> 里不能再放 <button>）。外观与 Button 的 primary / soft 一致，md 高 44px、sm 高 36px。
 * 临时放在这里：已在 sharedChangeRequests 申请把 ButtonLink 加进 src/components/ui/button.tsx，加好后改用它。
 */

const variantClass = {
  primary: 'bg-primary text-on-primary shadow-primary hover:bg-primary-hover',
  soft: 'bg-primary-soft text-primary-ink hover:brightness-[0.97]',
} as const

const sizeClass = {
  sm: 'h-9 gap-1.5 px-3.5 text-caption',
  md: 'h-11 gap-2 px-5 text-body',
} as const

export function LinkButton({
  href,
  icon,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: {
  href: string
  icon?: IconName
  variant?: keyof typeof variantClass
  size?: keyof typeof sizeClass
  className?: string
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none',
        'ease-spring transition-[transform,background-color,filter] duration-(--dur-fast) active:scale-[0.96]',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 20} lineOnly={variant === 'primary'} />}
      {children}
    </Link>
  )
}
