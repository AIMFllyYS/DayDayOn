import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/ui/icon'
import { cn } from '@/lib/cn'

/*
 * 长得像按钮的站内链接（<a> 里不能再放 <button>）。外观与 Button 的 primary / soft 一致，md 高 44px；sm 手机上也是 44px，桌面端 36px。
 * 临时放在这里：已在 sharedChangeRequests 申请把 ButtonLink 加进 src/components/ui/button.tsx，加好后改用它。
 */

const variantClass = {
  primary: 'bg-primary text-on-primary shadow-primary hover:bg-primary-hover',
  soft: 'bg-primary-soft text-primary-ink hover:brightness-[0.97]',
} as const

const sizeClass = {
  sm: 'h-11 gap-1.5 px-3.5 text-caption md:h-9',
  md: 'h-11 gap-2 px-5 text-body',
} as const

export function LinkButton({
  href,
  icon,
  variant = 'primary',
  size = 'md',
  className,
  onClick,
  children,
}: {
  href: string
  icon?: IconName
  variant?: keyof typeof variantClass
  size?: keyof typeof sizeClass
  className?: string
  /** 跳转前要做的事（例如关闭弹层） */
  onClick?: () => void
  children: ReactNode
}) {
  const classes = cn(
    'inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none',
    'ease-spring transition-[transform,background-color,filter] duration-(--dur-fast) active:scale-[0.96]',
    variantClass[variant],
    sizeClass[size],
    className,
  )
  const body = (
    <>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 20} lineOnly={variant === 'primary'} />}
      {children}
    </>
  )
  // 站外链接（GitHub Release 等）用普通 <a>：next/link 只用于站内路由
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} onClick={onClick} className={classes} rel="noopener noreferrer">
        {body}
      </a>
    )
  }
  return (
    <Link href={href} onClick={onClick} className={classes}>
      {body}
    </Link>
  )
}
