'use client'

import { AlertDialog } from '@base-ui/react/alert-dialog'
import { useState, type ReactNode } from 'react'
import { Button } from './button'
import { useAnimatedOpen } from './use-animated-open'

/*
 * 确认对话框（Base UI AlertDialog）：删除、注销、退出这类不可撤销的操作先问一句。
 * 能撤销的操作（删除待办）不弹确认，改用 toast.undo()（ui-design-system.md 第 11 节语气）。
 * 点遮罩不关闭，只能点按钮或按 Esc；确认按钮返回 Promise 时显示加载中，完成后自动关闭，失败保持打开。
 * 内置 useAnimatedOpen：即便首次在 open=true 状态下懒加载挂载，也能完整播放缩放弹出过渡。
 *
 * 推荐用法：在使用处懒加载并传 loading: () => null（ui-primitives.md 第 3 节）。
 *   const ConfirmDialog = dynamic(
 *     () => import('@/components/ui/confirm-dialog').then((m) => m.ConfirmDialog),
 *     { loading: () => null },
 *   )
 *   <ConfirmDialog open={open} onOpenChange={setOpen} title="删除这个目标？" tone="danger"
 *     confirmLabel="删除" onConfirm={() => remove.mutateAsync(id)} />
 */

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** 纯文字说明（渲染成 <p>，作为对话框的 aria-describedby），不要放表单控件 */
  description?: ReactNode
  /** 说明下方的额外内容（例如二次确认输入框），不进 <p>、不进 aria-describedby */
  children?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** danger：确认按钮用危险色 */
  tone?: 'default' | 'danger'
  /** split：移动端也保持左下取消、右下确认的并排等宽布局（如接受好友邀请二次确认） */
  buttonLayout?: 'responsive' | 'split'
  /** centered：标题与说明居中对齐 */
  centered?: boolean
  /** md：内容较多时（如更新说明）加宽到 max-w-md；默认 sm */
  size?: 'sm' | 'md'
  /** 确认成功后是否自动关闭弹窗（默认 true；应用内更新下载等需保持打开展示进度的场景传 false） */
  closeOnConfirm?: boolean
  /** 返回 Promise 时等待完成后关闭；抛错时保持打开，由调用方提示错误 */
  onConfirm: () => void | Promise<unknown>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = '确定',
  cancelLabel = '再想想',
  tone = 'default',
  buttonLayout = 'responsive',
  centered = false,
  size = 'sm',
  closeOnConfirm = true,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false)
  const animatedOpen = useAnimatedOpen(open)

  async function handleConfirm() {
    setPending(true)
    try {
      await onConfirm()
      if (closeOnConfirm) onOpenChange(false)
    } catch {
      // 保持打开；错误提示由调用方负责（通常是 toast.error）
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog.Root
      open={animatedOpen}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next)
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop
          className={
            'bg-foreground/30 ease-out-soft fixed inset-0 z-50 min-h-dvh transition-opacity duration-(--dur-base) ' +
            'data-ending-style:opacity-0 data-starting-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute'
          }
        />
        <AlertDialog.Popup
          className={
            'bg-surface text-foreground shadow-float fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-3xl p-6 outline-none ' +
            (size === 'md' ? 'max-w-md ' : 'max-w-sm ') +
            'ease-spring transition-[scale,opacity] duration-(--dur-base) ' +
            'data-starting-style:scale-90 data-starting-style:opacity-0 ' +
            'data-ending-style:ease-in-soft data-ending-style:scale-95 data-ending-style:opacity-0'
          }
        >
          <div
            className={
              centered ? 'flex flex-col items-center gap-1.5 text-center' : 'flex flex-col gap-1.5'
            }
          >
            <AlertDialog.Title className="text-heading font-bold">{title}</AlertDialog.Title>
            {description && (
              <AlertDialog.Description className="text-body text-muted">
                {description}
              </AlertDialog.Description>
            )}
          </div>
          {children}
          <div
            className={
              buttonLayout === 'split'
                ? 'grid grid-cols-2 gap-3'
                : 'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'
            }
          >
            <AlertDialog.Close
              disabled={pending}
              render={
                <Button
                  variant={buttonLayout === 'split' ? 'secondary' : 'ghost'}
                  className={buttonLayout === 'split' ? 'w-full' : undefined}
                >
                  {cancelLabel}
                </Button>
              }
            />
            <Button
              variant={tone === 'danger' ? 'danger' : 'primary'}
              className={buttonLayout === 'split' ? 'w-full' : undefined}
              loading={pending}
              onClick={handleConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
