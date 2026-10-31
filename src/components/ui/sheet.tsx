'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { IconButton } from './button'

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  /** 底部固定操作区（主按钮等） */
  footer?: ReactNode
}

/**
 * 弹层：手机端从底部滑出，≥768px 变成居中对话框。两端共用同一份内容（见架构基线 7.2）。
 * 基于原生 <dialog>：焦点圈定、Esc 关闭、背景不可点由浏览器负责。
 * 只做了进场动画；退场动画等引入 shadcn Drawer（vaul）时再统一。
 */
export function Sheet({ open, onOpenChange, title, description, children, footer }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
    if (!open) return
    // 弹层打开时锁住背后页面的滚动，避免手机上滑动穿透
    const root = document.documentElement
    const prev = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = prev
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={() => onOpenChange(false)}
      onClick={(e) => {
        // 点在 dialog 本身（即内容区以外的遮罩）时关闭
        if (e.target === e.currentTarget) onOpenChange(false)
      }}
      className={
        'bg-surface text-foreground shadow-float fixed inset-x-0 top-auto bottom-0 m-0 max-h-[88dvh] w-full max-w-none overflow-hidden rounded-t-3xl border-0 p-0 ' +
        'open:animate-sheet-up backdrop:bg-foreground/30 backdrop:animate-fade-in ' +
        'md:open:animate-pop-in md:inset-0 md:m-auto md:h-fit md:max-h-[80dvh] md:max-w-lg md:rounded-3xl'
      }
    >
      <div className="flex max-h-[inherit] flex-col pb-(--safe-bottom) md:pb-0">
        <div className="bg-border-strong mx-auto mt-2.5 h-1.5 w-10 rounded-full md:hidden" />
        <header className="flex items-start gap-3 px-5 pt-3 pb-2 md:px-6 md:pt-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-heading font-bold">
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-caption text-muted">
                {description}
              </p>
            )}
          </div>
          <IconButton icon="x" label="关闭" size="sm" onClick={() => onOpenChange(false)} />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 md:px-6">{children}</div>
        {footer && <div className="border-border border-t px-5 py-3 md:px-6">{footer}</div>}
      </div>
    </dialog>
  )
}
