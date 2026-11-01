import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/ui/icon'
import { cn } from '@/lib/cn'

/*
 * 长得像按钮的站内链接（<a> 里不能再放 <button>）。外观与 Button 的 primary / soft、md 尺寸一致。
 * 临时放在这里：已在 sharedChangeRequests 申请把 ButtonLink 加进 src/components/ui/button.tsx，
 * 加好后这里改为直接用它。
 */

const variantClass = {
  primary: 'bg-primary text-on-primary shadow-primary hover:bg-primary-hover',
  soft: 'bg-primary-soft text-primary-ink hover:brightness-[0.97]',
} as const

export function GoalLinkButton({
  href,
  icon,
  variant = 'primary',
  className,
  children,
}: {
  href: string
  icon?: IconName
  variant?: keyof typeof variantClass
  className?: string
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        'text-body inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 font-semibold select-none',
        'ease-spring transition-[transform,background-color,filter] duration-(--dur-fast) active:scale-[0.96]',
        variantClass[variant],
        className,
      )}
    >
      {icon && <Icon name={icon} size={20} lineOnly={variant === 'primary'} />}
      {children}
    </Link>
  )
}
