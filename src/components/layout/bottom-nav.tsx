'use client'

import Link from 'next/link'
import { useState, type MouseEvent } from 'react'
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
 * 计算当前高亮项在 5 格底栏中的槽位索引（0: 主页, 1: 待办, 2: 打卡"+", 3: 排行, 4: 我的）
 */
function getActiveSlotIndex(items: readonly NavItem[], path: string): number {
  const half = Math.ceil(items.length / 2)
  for (let i = 0; i < half; i++) {
    if (isNavActive(items[i]!.href, path)) return i
  }
  for (let i = half; i < items.length; i++) {
    if (isNavActive(items[i]!.href, path)) return i + 1
  }
  return -1
}

/**
 * 手机底部导航（<768px）：悬浮胶囊，"＋"打卡按钮和其他四项排在同一行，像 Dock 里的一格。
 * - 选中高亮：圆形滑块同时包裹图标与文字，点击不同项时以 spring 弹性曲线缓动滑至对应位置，带有 Q 弹质感。
 * - 组件本身不定位，由应用外壳放到 fixed bottom 并处理安全区。
 */
export function BottomNav({
  items,
  currentPath,
  onAddClick,
  addOpen = false,
  onItemClick,
  className,
}: BottomNavProps) {
  const [prevPath, setPrevPath] = useState(currentPath)
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null)

  // 外部路径发生变化时，清除乐观更新状态
  if (currentPath !== prevPath) {
    setPrevPath(currentPath)
    setOptimisticPath(null)
  }

  const effectivePath = optimisticPath ?? currentPath
  const activeSlot = getActiveSlotIndex(items, effectivePath)

  const half = Math.ceil(items.length / 2)
  const left = items.slice(0, half)
  const right = items.slice(half)

  const renderItem = (item: NavItem) => {
    const active = isNavActive(item.href, effectivePath)
    return (
      <li key={item.href} className="relative z-10 flex flex-1 justify-center">
        <Link
          href={item.href}
          aria-current={active ? 'page' : undefined}
          onClick={(e) => {
            setOptimisticPath(item.href)
            onItemClick?.(item.href, e)
          }}
          className={cn(
            'text-tiny flex min-h-12 min-w-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 font-semibold select-none',
            'transition-colors duration-(--dur-fast) active:scale-95',
            active ? 'text-primary-ink' : 'text-muted hover:text-foreground',
          )}
        >
          <span className="flex items-center justify-center">
            <Icon name={item.icon} size={20} strokeWidth={active ? 2.4 : 2} />
          </span>
          <span className="leading-none">{item.label}</span>
        </Link>
      </li>
    )
  }

  return (
    <nav
      aria-label="主导航"
      className={cn('bg-surface/95 shadow-float rounded-3xl px-2 backdrop-blur-md', className)}
    >
      <ul className="relative flex h-16 items-center">
        {/* 滑动高亮圆形滑块：包裹图标与文字，通过 spring 缓动滑至所选位置 */}
        {activeSlot >= 0 && (
          <div
            aria-hidden="true"
            className="ease-spring pointer-events-none absolute inset-y-0 left-0 z-0 flex w-1/5 items-center justify-center transition-transform duration-(--dur-slow)"
            style={{
              transform: `translateX(${activeSlot * 100}%)`,
            }}
          >
            <div className="bg-primary-soft shadow-soft size-13 rounded-full" />
          </div>
        )}

        {left.map(renderItem)}

        <li className="relative z-10 flex flex-1 justify-center">
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
