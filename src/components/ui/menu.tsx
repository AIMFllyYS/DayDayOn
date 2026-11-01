'use client'

import { Menu as BaseMenu } from '@base-ui/react/menu'
import type { ReactElement } from 'react'
import { cn } from '@/lib/cn'
import { Icon, type IconName } from './icon'
import { popupItemClass, popupSurfaceClass } from './popup-styles'

/*
 * 菜单（Base UI Menu）：一个触发按钮后面藏着几条操作，例如卡片右上角的"更多"。
 * 设置页那种常驻列表用 MenuList（menu-list.tsx），不是这个。
 * 方向键移动、回车选择、Esc 关闭、首字母跳转由 Base UI 负责。
 *
 * 推荐用法：在使用处懒加载（ui-primitives.md 第 3 节）。
 *   <Menu trigger={<IconButton icon="menu" label="更多操作" />} items={[
 *     { label: '编辑', icon: 'edit', onSelect: edit },
 *     { label: '删除', icon: 'trash', danger: true, onSelect: askDelete },
 *   ]} />
 * trigger 必须是能接收 ref 和事件的按钮元素（Button / IconButton / <button>）。
 */

export interface MenuItemDef {
  label: string
  icon?: IconName
  onSelect: () => void
  /** 危险操作（删除、退出），用危险色 */
  danger?: boolean
  disabled?: boolean
}

interface MenuProps {
  trigger: ReactElement
  /** 用 null 分隔成几组 */
  items: readonly (MenuItemDef | null)[]
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom'
}

export function Menu({ trigger, items, align = 'end', side = 'bottom' }: MenuProps) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={6} align={align} side={side} className="z-10">
          <BaseMenu.Popup className={cn(popupSurfaceClass, 'min-w-44 p-1.5')}>
            {items.map((item, i) =>
              item === null ? (
                <BaseMenu.Separator key={`sep-${i}`} className="bg-border mx-2 my-1 h-px" />
              ) : (
                <BaseMenu.Item
                  key={item.label}
                  disabled={item.disabled}
                  onClick={item.onSelect}
                  className={cn(
                    popupItemClass,
                    'pr-5 font-semibold',
                    item.danger && 'text-danger-ink data-highlighted:bg-danger-soft',
                  )}
                >
                  {item.icon && <Icon name={item.icon} size={18} />}
                  {item.label}
                </BaseMenu.Item>
              ),
            )}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  )
}
