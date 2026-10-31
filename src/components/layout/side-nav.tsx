import Link from 'next/link'
import type { MouseEvent, ReactNode } from 'react'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { BrandMark, BrandWordmark } from './brand'
import { isNavActive, type NavItem } from './nav-items'

/**
 * auto：768–1024px 只显示图标，≥1024px 展开文字（架构基线 7.2）
 * compact / expanded：强制某一种形态，用于 playbook 演示
 */
export type SideNavMode = 'auto' | 'compact' | 'expanded'

const widthClass: Record<SideNavMode, string> = {
  auto: 'w-20 lg:w-64',
  compact: 'w-20',
  expanded: 'w-64',
}

const labelClass: Record<SideNavMode, string> = {
  auto: 'sr-only lg:not-sr-only',
  compact: 'sr-only',
  expanded: '',
}

const expandedOnly: Record<SideNavMode, string> = {
  auto: 'hidden lg:flex',
  compact: 'hidden',
  expanded: 'flex',
}

interface SideNavProps {
  items: readonly NavItem[]
  currentPath: string
  onAddClick: () => void
  mode?: SideNavMode
  /** 底部区域：额度、用户卡片 */
  footer?: ReactNode
  onItemClick?: (href: string, event: MouseEvent<HTMLAnchorElement>) => void
  className?: string
}

/** 桌面侧栏（≥768px）：品牌 + 打卡按钮 + 导航 + 底部信息。组件不定位，由外壳决定 sticky */
export function SideNav({
  items,
  currentPath,
  onAddClick,
  mode = 'auto',
  footer,
  onItemClick,
  className,
}: SideNavProps) {
  return (
    <nav
      aria-label="主导航"
      className={cn(
        'border-border bg-surface/70 flex h-full flex-col gap-6 overflow-y-auto border-r px-3 py-5',
        widthClass[mode],
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2.5 px-2">
        <BrandMark size={36} />
        <BrandWordmark className={labelClass[mode]} />
      </div>

      <button
        type="button"
        onClick={onAddClick}
        aria-label="打卡"
        className={cn(
          'bg-primary text-on-primary shadow-primary flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl font-semibold',
          'ease-spring hover:bg-primary-hover transition-[transform,background-color] duration-(--dur-fast) active:scale-[0.96]',
        )}
      >
        <Icon name="plus" size={22} strokeWidth={2.6} />
        <span className={labelClass[mode]}>打卡</span>
      </button>

      <ul className="flex shrink-0 flex-col gap-1">
        {items.map((item) => {
          const active = isNavActive(item.href, currentPath)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                title={item.label}
                aria-current={active ? 'page' : undefined}
                onClick={(e) => onItemClick?.(item.href, e)}
                className={cn(
                  'relative flex h-12 items-center gap-3 rounded-2xl px-3.5 font-semibold',
                  'transition-colors duration-(--dur-fast)',
                  mode === 'compact' && 'justify-center',
                  mode === 'auto' && 'justify-center lg:justify-start',
                  active
                    ? 'bg-primary-soft text-primary-ink'
                    : 'text-muted hover:bg-surface-sunken hover:text-foreground',
                )}
              >
                <Icon name={item.icon} size={22} strokeWidth={active ? 2.4 : 2} />
                <span className={labelClass[mode]}>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      {footer && <div className={cn('mt-auto flex-col gap-3', expandedOnly[mode])}>{footer}</div>}
    </nav>
  )
}
