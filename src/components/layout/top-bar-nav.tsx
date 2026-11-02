'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Icon } from '@/components/ui/icon'
import { Menu, type MenuItemDef } from '@/components/ui/menu'
import { toast } from '@/components/ui/toast'
import { useCheckinLauncher } from '@/features/checkin/launcher-store'
import { GoalSettingSheet } from '@/features/goal/components/goal-setting-sheet'
import { useQuery } from '@/lib/api'
import { meQuery } from '@/lib/api/queries/me'

/** 顶栏左上角用户小头像：点击可直达「我的」主页 */
export function TopBarUserAvatar() {
  const { data: me } = useQuery(meQuery())
  const nickname = me?.profile?.nickname || '小满'
  const avatar = me?.profile?.avatar ?? 'mascot:tuan:cheer:exercise'

  return (
    <Link
      href="/me"
      aria-label="前往我的主页"
      title={nickname}
      className="ease-spring ring-border flex size-8.5 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 transition-transform hover:scale-105 active:scale-95"
    >
      <Avatar name={nickname} avatar={avatar} size="sm" />
    </Link>
  )
}

const actionBtnClass =
  'ease-spring text-foreground hover:bg-surface-sunken flex size-8.5 shrink-0 items-center justify-center rounded-full transition-[transform,background-color] duration-(--dur-fast) active:scale-95'

/** 顶栏右上角操作区：通知按钮 + 微信风格加号下拉菜单 */
export function TopBarActions() {
  const launcher = useCheckinLauncher()
  const [goalSheetOpen, setGoalSheetOpen] = useState(false)

  const items: MenuItemDef[] = [
    {
      icon: 'user',
      label: '添加好友',
      onSelect: () => toast.info('添加好友功能正在开发中'),
    },
    {
      icon: 'flame',
      label: '立即打卡',
      onSelect: () => launcher.open('list'),
    },
    {
      icon: 'sliders',
      label: '设置目标',
      onSelect: () => setGoalSheetOpen(true),
    },
  ]

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="通知"
          title="通知"
          onClick={() => toast.info('暂无新通知')}
          className={actionBtnClass}
        >
          <Icon name="bell" size={21} className="shrink-0 -translate-y-px" />
        </button>
        <Menu
          trigger={
            <button type="button" aria-label="更多操作" title="更多操作" className={actionBtnClass}>
              <Icon name="plus" size={21} strokeWidth={2.2} className="shrink-0" />
            </button>
          }
          items={items}
          align="end"
          side="bottom"
        />
      </div>
      <GoalSettingSheet open={goalSheetOpen} onOpenChange={setGoalSheetOpen} />
    </>
  )
}
