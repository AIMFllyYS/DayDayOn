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
 * 底部弹层：手机和桌面都从底部向上滑出（2026-11-01 评审：打卡入口要像菜单一样从下往上拉）。
 * 手机贴底全宽；≥768px 宽度收到 lg，离底部留 16px，像一张浮起来的卡片。
 * 基于原生 <dialog>：焦点圈定、背景不可点由浏览器负责；Esc、点遮罩、关闭按钮都先播退场动画再关闭。
 * M1 换成 Base UI Drawer 时对外接口不变（ui-primitives.md 第 4 节）。
 */
export function Sheet({ open, onOpenChange, title, description, children, footer }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    // 退场动画播放期间 dialog 仍然打开，data-closing 驱动退场动画，结束后才真正 close()
    if (open) {
      delete dialog.dataset.closing
      if (!dialog.open) dialog.showModal()
      // 弹层打开时锁住背后页面的滚动，避免手机上滑动穿透
      const root = document.documentElement
      const prev = root.style.overflow
      root.style.overflow = 'hidden'
      return () => {
        root.style.overflow = prev
      }
    }
    if (!dialog.open) return
    // 系统开启"减少动态效果"时动画只有 1ms，animationend 照常触发；兜底计时防止事件丢失
    dialog.dataset.closing = ''
    const finish = () => {
      delete dialog.dataset.closing
      dialog.close()
    }
    const fallback = window.setTimeout(finish, 400)
    dialog.addEventListener('animationend', finish, { once: true })
    return () => {
      window.clearTimeout(fallback)
      dialog.removeEventListener('animationend', finish)
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        // Esc：拦下浏览器的立即关闭，交给上面的退场动画
        e.preventDefault()
        onOpenChange(false)
      }}
      onClick={(e) => {
        // 点在 dialog 本身（即内容区以外的遮罩）时关闭
        if (e.target === e.currentTarget) onOpenChange(false)
      }}
      className={
        'bg-surface text-foreground shadow-float fixed inset-x-0 top-auto bottom-0 m-0 max-h-[88dvh] w-full max-w-none overflow-hidden rounded-t-3xl border-0 p-0 ' +
        'open:animate-sheet-up backdrop:bg-foreground/30 backdrop:animate-fade-in ' +
        'data-closing:animate-sheet-down data-closing:backdrop:animate-fade-out ' +
        'md:right-0 md:bottom-4 md:left-0 md:mx-auto md:max-h-[80dvh] md:max-w-lg md:rounded-3xl'
      }
    >
      <div className="flex max-h-[inherit] flex-col pb-(--safe-bottom) md:pb-0">
        <div className="bg-border-strong mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full" />
        <header className="flex items-start gap-3 px-5 pt-2 pb-3 md:px-6">
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
