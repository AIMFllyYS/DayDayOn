'use client'

import { AlertDialog } from '@base-ui/react/alert-dialog'
import { useState, type ReactNode } from 'react'
import { Button } from './button'

/*
 * 确认对话框（Base UI AlertDialog）：删除、注销、退出这类不可撤销的操作先问一句。
 * 能撤销的操作（删除待办）不弹确认，改用 toast.undo()（ui-design-system.md 第 11 节语气）。
 * 点遮罩不关闭，只能点按钮或按 Esc；确认按钮返回 Promise 时显示加载中，完成后自动关闭，失败保持打开。
 *
 * 推荐用法：在使用处懒加载（ui-primitives.md 第 3 节）。
 *   const ConfirmDialog = dynamic(() => import('@/components/ui/confirm-dialog').then((m) => m.ConfirmDialog))
 *   <ConfirmDialog open={open} onOpenChange={setOpen} title="删除这个目标？" tone="danger"
 *     confirmLabel="删除" onConfirm={() => remove.mutateAsync(id)} />
 */

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** danger：确认按钮用危险色 */
  tone?: 'default' | 'danger'
  /** 返回 Promise 时等待完成后关闭；抛错时保持打开，由调用方提示错误 */
  onConfirm: () => void | Promise<unknown>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = '确定',
  cancelLabel = '再想想',
  tone = 'default',
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false)

  async function handleConfirm() {
    setPending(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch {
      // 保持打开；错误提示由调用方负责（通常是 toast.error）
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next)
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop
          className={
            'bg-foreground/30 ease-out-soft fixed inset-0 min-h-dvh transition-opacity duration-(--dur-base) ' +
            'data-ending-style:opacity-0 data-starting-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute'
          }
        />
        <AlertDialog.Popup
          className={
            'bg-surface text-foreground shadow-float fixed top-1/2 left-1/2 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-3xl p-6 outline-none ' +
            'ease-spring transition-[scale,opacity] duration-(--dur-base) ' +
            'data-starting-style:scale-90 data-starting-style:opacity-0 ' +
            'data-ending-style:ease-in-soft data-ending-style:scale-95 data-ending-style:opacity-0'
          }
        >
          <div className="flex flex-col gap-1.5">
            <AlertDialog.Title className="text-heading font-bold">{title}</AlertDialog.Title>
            {description && (
              <AlertDialog.Description className="text-body text-muted">
                {description}
              </AlertDialog.Description>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Close
              disabled={pending}
              render={<Button variant="ghost">{cancelLabel}</Button>}
            />
            <Button
              variant={tone === 'danger' ? 'danger' : 'primary'}
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
