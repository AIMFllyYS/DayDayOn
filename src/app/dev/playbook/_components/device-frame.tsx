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
}: {
  children: ReactNode
  className?: string
  label?: string
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          'border-foreground/85 bg-paper shadow-float relative h-[640px] w-[340px] overflow-hidden rounded-[40px] border-[6px] sm:w-[360px]',
          className,
        )}
      >
        <span className="bg-foreground/85 absolute top-2 left-1/2 z-30 h-5 w-24 -translate-x-1/2 rounded-full" />
        {children}
      </div>
      <span className="text-tiny text-subtle font-mono">{label}</span>
    </div>
  )
}

export function DesktopFrame({
  children,
  className,
  label,
}: {
  children: ReactNode
  className?: string
  label: string
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      {/* 在手机上看桌面演示时横向滚动，不撑宽页面 */}
      <div className="border-border-strong bg-surface shadow-card overflow-x-auto rounded-2xl border">
        <div className="min-w-[640px]">
          <div className="border-border bg-surface-sunken flex h-8 items-center gap-1.5 border-b px-3">
            <span className="bg-danger/70 size-2.5 rounded-full" />
            <span className="bg-diet size-2.5 rounded-full" />
            <span className="bg-exercise size-2.5 rounded-full" />
          </div>
          <div className={cn('bg-paper flex h-[460px]', className)}>{children}</div>
        </div>
      </div>
      <span className="text-tiny text-subtle font-mono">{label}</span>
    </div>
  )
}
