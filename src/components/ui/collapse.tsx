import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/*
 * 折叠容器原子组件（全站复用：打卡文件夹卡、待办分组小面板等）：
 * - 用 CSS grid-template-rows: 0fr → 1fr 实现平滑高度过渡，内容无需测量像素高度；
 * - 收起时设置 inert，避免键盘 Tab 与读屏聚焦到隐藏区域；
 * - unmountOnCollapse 开启时收起态不挂载子 DOM，显著降低长列表折叠区的首屏节点开销。
 */

export interface CollapseProps {
  open: boolean
  children: ReactNode
  /** 收起时不挂载子节点（适合包含分页列表的重内容区） */
  unmountOnCollapse?: boolean
  className?: string
}

export function Collapse({ open, children, unmountOnCollapse = false, className }: CollapseProps) {
  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-(--dur-base) ease-out',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        className,
      )}
    >
      <div className="min-h-0 overflow-hidden" inert={!open}>
        {(!unmountOnCollapse || open) && children}
      </div>
    </div>
  )
}
