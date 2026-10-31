import Link from 'next/link'
import type { MouseEvent } from 'react'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { isNavActive, type NavItem } from './nav-items'

interface BottomNavProps {
  items: readonly NavItem[]
  /** 当前路径，由外壳用 usePathname() 传入 */
  currentPath: string
  onAddClick: () => void
  /** 打卡弹层是否打开："＋"旋转成"×" */
  addOpen?: boolean
  onItemClick?: (href: string, event: MouseEvent<HTMLAnchorElement>) => void
  className?: string
}

/**
 * 手机底部导航（<768px）：悬浮胶囊，"＋"打卡按钮和其他四项排在同一行，像 Dock 里的一格。
 * 2026-11-01 评审：凸出底栏的圆形"＋"太突兀，改为收在栏内的圆角方块。
 * 组件本身不定位，由应用外壳放到 fixed bottom 并处理安全区。
 */
export function BottomNav({
  items,
  currentPath,
  onAddClick,
  addOpen = false,
  onItemClick,
  className,
}: BottomNavProps) {
  const half = Math.ceil(items.length / 2)
  const left = items.slice(0, half)
  const right = items.slice(half)

  const renderItem = (item: NavItem) => {
    const active = isNavActive(item.href, currentPath)
    return (
      <li key={item.href} className="flex flex-1 justify-center">
        <Link
          href={item.href}
          aria-current={active ? 'page' : undefined}
          onClick={(e) => onItemClick?.(item.href, e)}
          className={cn(
            'text-tiny flex min-h-12 min-w-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 font-semibold',
            'transition-colors duration-(--dur-fast)',
            active ? 'text-primary-ink' : 'text-muted hover:text-foreground',
          )}
        >
          <span
            className={cn(
              'ease-spring flex h-7 w-12 items-center justify-center rounded-full transition-[background-color,transform] duration-(--dur-base)',
              active && 'bg-primary-soft scale-105',
            )}
          >
            <Icon name={item.icon} size={20} strokeWidth={active ? 2.4 : 2} />
          </span>
          {item.label}
        </Link>
      </li>
    )
  }

  return (
    <nav
      aria-label="主导航"
      className={cn('bg-surface/95 shadow-float rounded-3xl px-2 backdrop-blur-md', className)}
    >
      <ul className="flex h-16 items-center">
        {left.map(renderItem)}
        <li className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={onAddClick}
            aria-label={addOpen ? '关闭打卡' : '打卡'}
            aria-expanded={addOpen}
            className={cn(
              'bg-primary text-on-primary shadow-primary flex h-11 w-14 items-center justify-center rounded-2xl',
              'ease-spring hover:bg-primary-hover transition-[transform,background-color] duration-(--dur-base) active:scale-90',
            )}
          >
            <Icon
              name="plus"
              size={24}
              strokeWidth={2.6}
              className={cn(
                'ease-spring transition-transform duration-(--dur-base)',
                addOpen && 'rotate-45',
              )}
            />
          </button>
        </li>
        {right.map(renderItem)}
      </ul>
    </nav>
  )
}
