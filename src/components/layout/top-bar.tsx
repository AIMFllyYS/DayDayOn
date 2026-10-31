import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface TopBarProps {
  title: string
  /** 标题上方的小字，例如日期"10 月 31 日 周六" */
  eyebrow?: string
  /** 左侧：返回按钮 */
  leading?: ReactNode
  /** 右侧：图标按钮组 */
  actions?: ReactNode
  /** 吸顶时背景半透明模糊；放在 playbook 里演示时可关闭 */
  sticky?: boolean
  className?: string
}

/** 页面顶栏：每个页面一个，标题即页面名（和导航项文字一致） */
export function TopBar({
  title,
  eyebrow,
  leading,
  actions,
  sticky = true,
  className,
}: TopBarProps) {
  return (
    <header
      className={cn(
        'z-20 flex items-center gap-2 px-4 pt-[calc(var(--safe-top)+0.75rem)] pb-3 md:px-8 md:pt-6',
        sticky && 'bg-background/85 sticky top-0 backdrop-blur-md',
        className,
      )}
    >
      {leading}
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="text-tiny text-muted font-semibold">{eyebrow}</p>}
        <h1 className="text-title truncate font-bold">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </header>
  )
}
