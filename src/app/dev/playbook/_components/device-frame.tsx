import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * 设备外框：只用于 playbook 演示组件在手机 / 桌面上的样子。
 * 注意外框里的断点不生效（断点看的是浏览器视口），需要真实效果时缩放浏览器窗口。
 */
export function PhoneFrame({
  children,
  className,
  label = '手机 · 390',
  fluid = false,
}: {
  children: ReactNode
  className?: string
  label?: string
  /** 真实手机宽度（< sm）下去掉假手机的刘海和粗边，铺满宽度、高度跟随视口 */
  fluid?: boolean
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2', fluid && 'w-full sm:w-auto')}>
      <div
        className={cn(
          'border-foreground/85 bg-paper shadow-float relative h-[640px] w-[340px] overflow-hidden rounded-[40px] border-[6px] sm:w-[360px]',
          fluid &&
            'max-sm:h-[calc(100dvh-9rem)] max-sm:min-h-[540px] max-sm:w-full max-sm:rounded-3xl max-sm:border-2',
          className,
        )}
      >
        <span
          className={cn(
            'bg-foreground/85 absolute top-2 left-1/2 z-30 h-5 w-24 -translate-x-1/2 rounded-full',
            fluid && 'max-sm:hidden',
          )}
        />
        {children}
      </div>
      <span className="text-tiny text-subtle max-w-full text-center font-mono">{label}</span>
    </div>
  )
}

export function DesktopFrame({
  children,
  className,
  label,
  height = 460,
  minWidth = 640,
}: {
  children: ReactNode
  className?: string
  label: string
  /** 内容区高度（px），页面预览用更高的 */
  height?: number
  /** 最小宽度（px），窄屏上横向滚动 */
  minWidth?: number
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      {/* 在手机上看桌面演示时横向滚动，不撑宽页面 */}
      <div className="border-border-strong bg-surface shadow-card w-full max-w-full overflow-x-auto rounded-2xl border">
        <div style={{ minWidth }}>
          <div className="border-border bg-surface-sunken flex h-8 items-center gap-1.5 border-b px-3">
            <span className="bg-danger/70 size-2.5 rounded-full" />
            <span className="bg-diet size-2.5 rounded-full" />
            <span className="bg-exercise size-2.5 rounded-full" />
          </div>
          <div className={cn('bg-paper flex', className)} style={{ height }}>
            {children}
          </div>
        </div>
      </div>
      <span className="text-tiny text-subtle max-w-full text-center font-mono">{label}</span>
    </div>
  )
}
