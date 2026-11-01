import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { IconTile } from './badge'
import { Icon, type IconName } from './icon'
import type { Tone } from './tone'

interface MenuListProps {
  /** 分组标题，例如"偏好设置" */
  title?: string
  children: ReactNode
  className?: string
}

/** 菜单列表：「我的」页设置项、弹层里的选项列表。一组放在一张卡片里，组内用细线分隔 */
export function MenuList({ title, children, className }: MenuListProps) {
  return (
    <section className={cn('flex flex-col gap-2', className)}>
      {title && <h3 className="text-tiny text-muted px-1 font-semibold">{title}</h3>}
      <ul className="divide-border bg-surface shadow-soft divide-y overflow-hidden rounded-2xl">
        {children}
      </ul>
    </section>
  )
}

interface MenuItemProps {
  label: string
  description?: string
  icon?: IconName
  tone?: Tone
  /** 右侧的值或控件（开关、徽章、当前值） */
  trailing?: ReactNode
  href?: string
  onClick?: () => void
  /** 危险操作（退出登录、注销）用红色 */
  danger?: boolean
}

export function MenuItem({
  label,
  description,
  icon,
  tone = 'neutral',
  trailing,
  href,
  onClick,
  danger = false,
}: MenuItemProps) {
  const body = (
    <>
      {icon && <IconTile icon={icon} tone={danger ? 'danger' : tone} size="sm" />}
      <span className="min-w-0 flex-1">
        <span
          className={cn('block truncate font-semibold', danger && 'text-danger-ink')}
          title={label}
        >
          {label}
        </span>
        {description && (
          <span className="text-tiny text-muted block truncate" title={description}>
            {description}
          </span>
        )}
      </span>
      {trailing && <div className="flex shrink-0 items-center">{trailing}</div>}
      {(href || onClick) && !trailing && (
        <Icon name="chevron-right" size={18} className="text-subtle shrink-0" />
      )}
    </>
  )

  const rowClass =
    'flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-(--dur-fast) hover:bg-background active:bg-surface-sunken'

  if (href) {
    return (
      <li>
        <Link href={href} className={rowClass}>
          {body}
        </Link>
      </li>
    )
  }
  if (onClick) {
    return (
      <li>
        <button type="button" onClick={onClick} className={rowClass}>
          {body}
        </button>
      </li>
    )
  }
  return <li className={cn(rowClass, 'hover:bg-transparent active:bg-transparent')}>{body}</li>
}
