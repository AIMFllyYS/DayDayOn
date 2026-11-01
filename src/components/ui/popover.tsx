'use client'

import { Popover as BasePopover } from '@base-ui/react/popover'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { popupSurfaceClass } from './popup-styles'

/*
 * 气泡（Base UI Popover）：点一下弹出一小块说明或轻量操作，例如"这个数字怎么算的"。
 * 需要用户确认或填表的内容用 Sheet；纯操作列表用 Menu。
 * 点外面、按 Esc 关闭，焦点回到触发按钮。
 *
 * 推荐用法：在使用处懒加载（ui-primitives.md 第 3 节）。
 *   <Popover trigger={<IconButton icon="bulb" label="说明" size="sm" />} title="连续天数">
 *     补卡不计入连续天数。
 *   </Popover>
 * trigger 必须是能接收 ref 和事件的按钮元素（Button / IconButton / <button>）。
 */

interface PopoverProps {
  trigger: ReactElement
  title?: string
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  /** 受控时传入 */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

export function Popover({
  trigger,
  title,
  children,
  side = 'bottom',
  align = 'center',
  open,
  onOpenChange,
  className,
}: PopoverProps) {
  return (
    <BasePopover.Root open={open} onOpenChange={onOpenChange ? (o) => onOpenChange(o) : undefined}>
      <BasePopover.Trigger render={trigger} />
      <BasePopover.Portal>
        <BasePopover.Positioner sideOffset={8} side={side} align={align} className="z-10">
          <BasePopover.Popup
            className={cn(
              popupSurfaceClass,
              'max-w-[min(var(--available-width),20rem)] p-4',
              className,
            )}
          >
            {title && (
              <BasePopover.Title className="text-subhead mb-1 font-bold">{title}</BasePopover.Title>
            )}
            <BasePopover.Description render={<div />} className="text-caption text-muted">
              {children}
            </BasePopover.Description>
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  )
}
