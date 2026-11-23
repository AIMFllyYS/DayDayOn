'use client'

import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'

/*
 * 待办页右下角悬浮加号球（FAB）：
 * - 置顶覆盖页面内容、底部导航与常规悬浮层（z-[45]），保证随时单手一点即可新建；
 * - 当抽屉或确认弹窗打开时通过 hidden 平滑退让，避免遮挡弹层底部的提交按钮。
 */

interface TodoFabProps {
  onClick: () => void
  hidden?: boolean
  /** Playbook 演示框内使用 absolute 定位代替整屏 fixed */
  contained?: boolean
}

export function TodoFab({ onClick, hidden = false, contained = false }: TodoFabProps) {
  return (
    <button
      type="button"
      aria-label="新建待办"
      title="新建待办"
      inert={hidden || undefined}
      onClick={onClick}
      className={cn(
        'ease-spring bg-primary text-on-primary shadow-primary hover:bg-primary-hover flex size-13 items-center justify-center rounded-full transition-[transform,opacity,background-color] duration-(--dur-base) active:scale-90',
        contained
          ? 'sticky right-0 bottom-4 z-[45] ml-auto'
          : 'fixed right-4 bottom-[calc(var(--safe-bottom)+5.5rem)] z-[45] md:right-8 md:bottom-8',
        hidden && 'pointer-events-none scale-75 opacity-0',
      )}
    >
      <Icon name="plus" size={24} strokeWidth={2.5} lineOnly />
    </button>
  )
}
