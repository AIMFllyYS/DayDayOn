'use client'

import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'

export interface NotificationBellBadgeProps {
  unreadCount?: number
  hasLightDot?: boolean
  label?: string
  size?: 'sm' | 'md'
  className?: string
  onClick?: () => void
}

/**
 * 顶栏铃铛未读角标组件（Issue #20 · ADR-0026 · Decision #4）
 *
 * 视觉与设计契约：
 * - 纯白 text-on-primary (#fffaf3) + 固定柔和红底 bg-danger (#e06464)
 * - 4 种视觉形态：
 *   1. unreadCount=0 且 !hasLightDot：完全干净的铃铛
 *   2. hasLightDot=true 且 unreadCount=0：小红点轻提示
 *   3. unreadCount 1~99：精准显示未读数字
 *   4. unreadCount > 99：溢出状态显示 "99+"
 */
export function NotificationBellBadge({
  unreadCount = 0,
  hasLightDot = false,
  label = '消息与通知',
  size = 'sm',
  className,
  onClick,
}: NotificationBellBadgeProps) {
  const showCount = unreadCount > 0
  const showDot = !showCount && hasLightDot
  const countLabel = unreadCount > 99 ? '99+' : String(unreadCount)
  const a11yLabel = showCount
    ? `${label}（${unreadCount} 条未读）`
    : showDot
      ? `${label}（有新动态）`
      : label

  return (
    <button
      type="button"
      aria-label={a11yLabel}
      title={a11yLabel}
      onClick={onClick}
      className={cn(
        'ease-spring text-foreground hover:bg-surface-sunken relative inline-flex shrink-0 items-center justify-center rounded-full transition-[transform,background-color] duration-(--dur-fast) select-none active:scale-95',
        size === 'sm' ? 'size-8.5' : 'size-11',
        className,
      )}
    >
      {/* 紧贴 21/22 铃铛本体定位：角标左下角贴合铃铛右上肩部，数字变长时向右延展 */}
      <span className="relative inline-flex items-center justify-center">
        <Icon name="bell" size={size === 'sm' ? 21 : 22} className="-translate-y-px" />
        {showCount && (
          <span
            aria-hidden
            data-testid="notification-badge-count"
            className="bg-danger text-on-primary ring-surface pointer-events-none absolute -top-1.5 left-2.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[10px] leading-none font-bold ring-2"
          >
            {countLabel}
          </span>
        )}
        {showDot && (
          <span
            aria-hidden
            data-testid="notification-badge-dot"
            className="bg-danger ring-surface pointer-events-none absolute -top-0.5 right-0 size-2 rounded-full ring-2"
          />
        )}
      </span>
    </button>
  )
}
