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
    <section className={cn('flex w-full min-w-0 flex-col gap-2', className)}>
      {title && <h3 className="text-tiny text-muted px-1 font-semibold">{title}</h3>}
      <ul className="divide-border bg-surface shadow-soft w-full min-w-0 divide-y overflow-hidden rounded-2xl">
        {children}
      </ul>
    </section>
  )
}

interface MenuItemBaseProps {
  label: string
  description?: string
  icon?: IconName
  tone?: Tone
  /** 自定义左侧元素（如颜色块、头像），提供时优先于 icon */
  leading?: ReactNode
  /** 右侧摘要文本（多级菜单行自动紧贴右箭头展示，无需手拼箭头） */
  value?: ReactNode
  /** 危险操作（退出登录、注销）用红色 */
  danger?: boolean
}

type MenuItemActionProps =
  | {
      /** 右侧交互控件（Switch / Select 等）：编译期禁止与 href / onClick 同时传入，避免 <button> 嵌套导致 SSR 水合报错 */
      control: ReactNode
      trailing?: never
      href?: never
      onClick?: never
    }
  | {
      control?: never
      /** 右侧只读状态（如徽章）；若需可交互控件请使用 control */
      trailing?: ReactNode
      href?: string
      onClick?: () => void
    }

export type MenuItemProps = MenuItemBaseProps & MenuItemActionProps

export function MenuItem({
  label,
  description,
  icon,
  tone = 'neutral',
  leading,
  value,
  control,
  trailing,
  href,
  onClick,
  danger = false,
}: MenuItemProps) {
  const rightSlot = control ?? trailing
  const isNavRow = Boolean(href || onClick)

  const body = (
    <>
      {leading ?? (icon && <IconTile icon={icon} tone={danger ? 'danger' : tone} size="sm" />)}
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
      {value !== undefined && (
        <span className="text-caption text-muted max-w-[44%] shrink-0 truncate font-normal">
          {value}
        </span>
      )}
      {rightSlot && (
        <div className="flex max-w-[56%] shrink-0 items-center justify-end">{rightSlot}</div>
      )}
      {isNavRow && !rightSlot && (
        <Icon name="chevron-right" size={18} className="text-subtle shrink-0" />
      )}
    </>
  )

  const rowClass =
    'flex min-h-14 w-full min-w-0 items-center gap-3 px-4 py-2.5 text-left transition-colors duration-(--dur-fast) hover:bg-background active:bg-surface-sunken'

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
