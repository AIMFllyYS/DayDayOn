'use client'

import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'

/*
 * 待办页右下角悬浮加号球（FAB）：
 * - 正式页面通过 createPortal 挂载到 document.body，彻底脱离 AppPage 的 @container（container-type: inline-size
 *   会为后代建立新的 fixed 包含块，导致按钮沉到长列表底部）；
 * - 挂在 body 且 z-[35]：稳定覆盖 <div class="isolate"> 内的所有页面内容、底栏与悬浮团团，同时自然位于
 *   Sheet（z-40）/ ConfirmDialog（z-50）/ Menu（z-50）等模态弹层下方；
 * - 当抽屉或确认弹窗打开时仍通过 hidden 平滑退让。
 */

interface TodoFabProps {
  onClick: () => void
  hidden?: boolean
  /** Playbook 演示框内使用容器内粘性定位代替整屏 Portal fixed */
  contained?: boolean
}

const emptySubscribe = () => () => {}

function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}

export function TodoFab({ onClick, hidden = false, contained = false }: TodoFabProps) {
  const isClient = useIsClient()

  const button = (
    <button
      type="button"
      aria-label="新建待办"
      title="新建待办"
      inert={hidden || undefined}
      onClick={onClick}
      className={cn(
        'ease-spring bg-primary text-on-primary shadow-primary hover:bg-primary-hover flex size-13 items-center justify-center rounded-full transition-[transform,opacity,background-color] duration-(--dur-base) active:scale-90',
        contained
          ? 'sticky right-0 bottom-4 z-[35] ml-auto'
          : 'fixed right-4 bottom-[calc(var(--safe-bottom)+5.5rem)] z-[35] md:right-8 md:bottom-8',
        hidden && 'pointer-events-none scale-75 opacity-0',
      )}
    >
      <Icon name="plus" size={24} strokeWidth={2.5} lineOnly />
    </button>
  )

  if (contained) return button
  if (!isClient) return null
  return createPortal(button, document.body)
}
