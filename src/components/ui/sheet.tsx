'use client'

import { Dialog } from '@base-ui/react/dialog'
import { Drawer } from '@base-ui/react/drawer'
import { useSyncExternalStore, type ReactNode } from 'react'
import { IconButton } from './button'

/*
 * 底部弹层（ui-primitives.md 第 4 节）。对外接口沿用原生 <dialog> 版本，调用方不用改。
 * - < 768px：Base UI Drawer，向下滑动关闭；内含 VirtualKeyboardProvider，软键盘弹出时滚动让聚焦的输入框可见。
 * - ≥ 768px：Base UI Dialog，收到 lg 宽，离底部 16px，同样从下往上滑出（2026-11-01 评审）。
 * 焦点圈定、背景滚动锁定、Esc、点遮罩关闭由 Base UI 负责；进退场用 data-starting-style / data-ending-style 过渡。
 *
 * 推荐用法：弹层代码不进首屏，在使用处懒加载（ui-primitives.md 第 3 节）：
 *   const CheckinSheet = dynamic(() => import('./checkin-sheet').then((m) => m.CheckinSheet))
 * 抽屉里有自己处理横向拖动的区域（轮播）加 data-base-ui-swipe-ignore="x"；完全不参与滑动关闭的加 data-base-ui-swipe-ignore。
 * 自定义样式里用到软键盘高度时写 var(--drawer-keyboard-inset, 0px)，必须带默认值。
 */

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  /** 底部固定操作区（主按钮等） */
  footer?: ReactNode
}

const DESKTOP_QUERY = '(min-width: 768px)'

function subscribeDesktop(onChange: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

/** 服务端和首帧按手机渲染；弹层默认关闭，切换不会造成可见的闪动 */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  )
}

// iOS 26 Safari 的遮罩要用 absolute 才能盖满可视区域（配合 globals.css 的 body { position: relative }）
const backdropClass =
  'bg-foreground/30 fixed inset-0 min-h-dvh transition-opacity duration-(--dur-slow) ease-out-soft ' +
  'data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-(--dur-base) data-ending-style:ease-in-soft ' +
  'supports-[-webkit-touch-callout:none]:absolute'

export function Sheet(props: SheetProps) {
  const desktop = useIsDesktop()
  return desktop ? <DialogSheet {...props} /> : <DrawerSheet {...props} />
}

function DrawerSheet({ open, onOpenChange, title, description, children, footer }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={(next) => onOpenChange(next)} swipeDirection="down">
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal>
          <Drawer.Backdrop
            className={
              backdropClass +
              ' opacity-[calc(1-var(--drawer-swipe-progress,0))] data-swiping:duration-0'
            }
          />
          <Drawer.Viewport className="fixed inset-0 flex items-end justify-center">
            {/*
             * --bleed：弹层底部多出一截藏在屏幕外，向上拖动时底部不会露出缝隙。
             * 拖动时跟随 --drawer-swipe-movement-y；松手关闭的时长按滑动力度缩放。
             */}
            <Drawer.Popup
              className={
                'bg-surface text-foreground shadow-float relative flex w-full flex-col overflow-hidden rounded-t-3xl outline-none [--bleed:3rem] ' +
                'mb-[calc(var(--bleed)*-1)] max-h-[calc(88dvh+var(--bleed))] pb-[calc(var(--bleed)+var(--safe-bottom))] ' +
                'ease-out-soft [transform:translateY(var(--drawer-swipe-movement-y,0px))] transition-transform duration-(--dur-slow) ' +
                'data-swiping:duration-0 data-swiping:select-none ' +
                'data-starting-style:[transform:translateY(calc(100%-var(--bleed)))] ' +
                'data-ending-style:ease-in-soft data-ending-style:[transform:translateY(calc(100%-var(--bleed)))] ' +
                'data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*var(--dur-slow))]'
              }
            >
              <div
                aria-hidden
                className="bg-border-strong mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full"
              />
              <Drawer.Content className="flex min-h-0 flex-1 flex-col">
                <SheetHeader
                  title={<Drawer.Title className="text-heading font-bold">{title}</Drawer.Title>}
                  description={
                    description && (
                      <Drawer.Description className="text-caption text-muted">
                        {description}
                      </Drawer.Description>
                    )
                  }
                  onClose={() => onOpenChange(false)}
                />
                <SheetLayout footer={footer}>{children}</SheetLayout>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  )
}

function DialogSheet({ open, onOpenChange, title, description, children, footer }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop className={backdropClass} />
        <Dialog.Popup
          className={
            'bg-surface text-foreground shadow-float fixed inset-x-0 bottom-4 mx-auto flex max-h-[80dvh] w-[calc(100%-2rem)] max-w-lg flex-col overflow-hidden rounded-3xl outline-none ' +
            'ease-out-soft transition-[translate] duration-(--dur-slow) ' +
            'data-ending-style:translate-y-[calc(100%+2rem)] data-starting-style:translate-y-[calc(100%+2rem)] ' +
            'data-ending-style:ease-in-soft data-ending-style:duration-(--dur-base)'
          }
        >
          <div className="h-3 shrink-0" />
          <SheetHeader
            title={<Dialog.Title className="text-heading font-bold">{title}</Dialog.Title>}
            description={
              description && (
                <Dialog.Description className="text-caption text-muted">
                  {description}
                </Dialog.Description>
              )
            }
            onClose={() => onOpenChange(false)}
          />
          <SheetLayout footer={footer}>{children}</SheetLayout>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function SheetHeader({
  title,
  description,
  onClose,
}: {
  title: ReactNode
  description: ReactNode
  onClose: () => void
}) {
  return (
    <header className="flex shrink-0 items-start gap-3 px-5 pt-2 pb-3 md:px-6">
      <div className="min-w-0 flex-1">
        {title}
        {description}
      </div>
      <IconButton icon="x" label="关闭" onClick={onClose} className="-mt-1.5 -mr-2" />
    </header>
  )
}

function SheetLayout({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 md:px-6">
        {children}
      </div>
      {footer && <div className="border-border shrink-0 border-t px-5 py-3 md:px-6">{footer}</div>}
    </>
  )
}
