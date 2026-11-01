'use client'

import { Toast } from '@base-ui/react/toast'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icon, type IconName } from './icon'

/*
 * 提示消息（Base UI Toast，ADR-0006）。全站只有一个 Provider，挂在根布局（ToastProvider）。
 * Toast 是唯一不懒加载的弹层：随根布局常驻（ui-primitives.md 第 3 节）。
 *
 * 用法：任何地方（组件、mutation 回调、非 React 代码）都调用 `toast`，不需要 hook：
 *   toast.success('打卡成功')
 *   toast.error(errorMessage(err))                        // 文案只来自 src/lib/api/error-messages.ts
 *   toast.promise(save(), { loading: '保存中…', success: '保存好了', error: (e) => errorMessage(e) })
 *   toast.undo('已删除待办', { onUndo: () => restore(id) }) // 5 秒内可撤销（PRD 2.10）
 * 同一件事的提示传同一个 id，会原地更新而不是叠一条新的。
 * 手机在顶部（不挡底栏），桌面在右下角；向上 / 向右滑动关闭，F6 跳到提示区域。
 */

type ToastKind = 'success' | 'error' | 'info' | 'loading' | 'undo'

/** 全局 toast 管理器：React 树外也能 add / close / update / promise */
export const toastManager = Toast.createToastManager()

interface ToastOptions {
  description?: ReactNode
  /** 同 id 原地更新 */
  id?: string
  /** 毫秒；0 表示不自动消失 */
  timeout?: number
}

interface UndoOptions extends ToastOptions {
  onUndo: () => void
  /** 没有撤销、提示自然消失或被关掉时调用（例如延迟提交删除） */
  onExpire?: () => void
  /** 按钮文字，默认"撤销" */
  label?: string
}

type PromiseMessage<T> = string | ((value: T) => string)

function add(type: ToastKind, title: ReactNode, options: ToastOptions = {}) {
  return toastManager.add({
    ...options,
    title,
    type,
    priority: type === 'error' ? 'high' : 'low',
  })
}

export const toast = {
  success: (title: ReactNode, options?: ToastOptions) => add('success', title, options),
  error: (title: ReactNode, options?: ToastOptions) => add('error', title, options),
  info: (title: ReactNode, options?: ToastOptions) => add('info', title, options),
  /** 加载中 → 成功 / 失败三态；返回原 Promise，失败时照常 reject */
  promise<T>(
    promise: Promise<T>,
    messages: { loading: string; success: PromiseMessage<T>; error: PromiseMessage<unknown> },
  ): Promise<T> {
    const resolve = <V,>(m: PromiseMessage<V>, v: V) => ({
      title: typeof m === 'function' ? m(v) : m,
    })
    return toastManager.promise(promise, {
      loading: { title: messages.loading },
      success: (value: T) => resolve(messages.success, value),
      error: (err: unknown) => ({ ...resolve(messages.error, err), priority: 'high' as const }),
    })
  },
  /** 可撤销的操作：带"撤销"按钮，默认 5 秒 */
  undo(title: ReactNode, { onUndo, onExpire, label = '撤销', ...options }: UndoOptions) {
    let undone = false
    const id = toastManager.add({
      timeout: 5000,
      ...options,
      title,
      type: 'undo',
      actionProps: {
        children: label,
        onClick: () => {
          undone = true
          onUndo()
          toastManager.close(id)
        },
      },
      onClose: () => {
        if (!undone) onExpire?.()
      },
    })
    return id
  },
  update: toastManager.update,
  close: (id?: string) => toastManager.close(id),
}

const kindIcon: Record<ToastKind, { icon: IconName; className: string }> = {
  success: { icon: 'check', className: 'bg-success-soft text-success-ink' },
  error: { icon: 'alert', className: 'bg-danger-soft text-danger-ink' },
  info: { icon: 'bell', className: 'bg-primary-soft text-primary-ink' },
  loading: { icon: 'loader', className: 'bg-surface-sunken text-muted' },
  undo: { icon: 'trash', className: 'bg-surface-sunken text-muted' },
}

function isKind(t: string | undefined): t is ToastKind {
  return t !== undefined && t in kindIcon
}

/** 根布局里包一次；children 原样渲染，不影响静态预渲染 */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider toastManager={toastManager} limit={3}>
      {children}
      <Toast.Portal>
        <Toast.Viewport
          className={
            'fixed inset-x-0 top-[calc(var(--safe-top)+0.75rem)] mx-auto flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 outline-none ' +
            'md:inset-x-auto md:top-auto md:right-6 md:bottom-6 md:mx-0 md:w-90 md:flex-col-reverse'
          }
        >
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}

function ToastList() {
  const { toasts } = Toast.useToastManager()
  return toasts.map((t) => {
    const kind = isKind(t.type) ? t.type : 'info'
    const { icon, className } = kindIcon[kind]
    return (
      <Toast.Root
        key={t.id}
        toast={t}
        swipeDirection={['up', 'right']}
        className={
          'bg-surface text-foreground shadow-float border-border relative rounded-2xl border select-none ' +
          '[transform:translate(var(--toast-swipe-movement-x,0px),var(--toast-swipe-movement-y,0px))] ' +
          'ease-out-soft transition-[transform,opacity] duration-(--dur-slow) data-swiping:duration-0 ' +
          'data-starting-style:[transform:translateY(-1rem)] data-starting-style:opacity-0 md:data-starting-style:[transform:translateY(1rem)] ' +
          'data-ending-style:ease-in-soft data-ending-style:opacity-0 data-ending-style:duration-(--dur-base) ' +
          'data-[swipe-direction=right]:data-ending-style:[transform:translateX(calc(var(--toast-swipe-movement-x,0px)+110%))] ' +
          'data-[swipe-direction=up]:data-ending-style:[transform:translateY(calc(var(--toast-swipe-movement-y,0px)-110%))] ' +
          'data-limited:hidden'
        }
      >
        <Toast.Content className="flex items-center gap-3 py-2 pr-2 pl-3">
          <span
            className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', className)}
          >
            <Icon
              name={icon}
              size={18}
              className={kind === 'loading' ? 'animate-spin-slow' : undefined}
            />
          </span>
          <div className="min-w-0 flex-1 py-1">
            <Toast.Title className="text-body font-semibold" />
            <Toast.Description className="text-caption text-muted" />
          </div>
          <Toast.Action className="text-caption text-primary-ink hover:bg-primary-soft inline-flex h-11 shrink-0 items-center rounded-full px-4 font-semibold transition-colors duration-(--dur-fast)" />
          <Toast.Close
            aria-label="关闭提示"
            className="text-muted hover:bg-surface-sunken hover:text-foreground inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-(--dur-fast)"
          >
            <Icon name="x" size={16} />
          </Toast.Close>
        </Toast.Content>
      </Toast.Root>
    )
  })
}
