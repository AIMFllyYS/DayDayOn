import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface TopBarProps {
  title: ReactNode
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

/** 页面顶栏：每个页面一个，手机端标题居中且高度紧凑，桌面端居左 */
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
        'relative z-20 flex items-center justify-between px-4 pt-[calc(var(--safe-top)+0.375rem)] pb-1.5 md:justify-start md:gap-2 md:px-8 md:pt-6 md:pb-3',
        sticky && 'bg-background/85 sticky top-0 backdrop-blur-md',
        className,
      )}
    >
      <div className="relative z-10 flex min-h-8 min-w-0 items-center justify-start">{leading}</div>

      <div className="pointer-events-none absolute inset-x-0 flex flex-col items-center justify-center px-20 text-center md:pointer-events-auto md:static md:inset-auto md:min-w-0 md:flex-1 md:items-start md:px-0 md:text-left">
        {eyebrow && <p className="text-tiny text-muted font-semibold">{eyebrow}</p>}
        <h1 className="text-subhead md:text-title truncate font-bold">{title}</h1>
      </div>

      <div className="relative z-10 flex min-h-8 min-w-0 items-center justify-end">{actions}</div>
    </header>
  )
}
