'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Avatar, AvatarStack } from '@/components/ui/avatar'
import { Icon } from '@/components/ui/icon'
import { Menu, type MenuItemDef } from '@/components/ui/menu'
import { Popover } from '@/components/ui/popover'
import { toast } from '@/components/ui/toast'
import { useCheckinLauncher } from '@/features/checkin/launcher-store'
import { AddFriendSheet } from '@/features/friend/components/add-friend-sheet'
import { FriendMeteorOverlay } from '@/features/friend/components/friend-meteor'
import { friendActions, useFriendStore } from '@/features/friend/friend-store'
import type { FriendSummary } from '@/features/friend/schemas'
import { GoalSettingSheet } from '@/features/goal/components/goal-setting-sheet'
import { useQuery } from '@/lib/api'
import { useFriendsList } from '@/lib/api/queries/friends'
import { meQuery } from '@/lib/api/queries/me'
import { cn } from '@/lib/cn'

interface TopBarUserAvatarProps {
  /** Playbook 演示时可传入模拟好友列表 */
  demoFriends?: FriendSummary[]
}

/**
 * 顶栏左上角用户与好友堆叠头像（ADR-0026）：
 * - 复用 AvatarStack：有好友时叠放展示（人数较多时最多显示 3 个 + "+N"），无好友时展示本人头像
 * - 点击弹出好友面板菜单（第一行本人，下方按顺序排列好友），点击任意行切换打卡仪表盘视角
 * - 接受好友邀请后承接流星终点，触发 Q 弹展开动效与引导气泡
 */
export function TopBarUserAvatar({ demoFriends }: TopBarUserAvatarProps = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const isDemo = demoFriends !== undefined || pathname.startsWith('/dev')
  const { data: me } = useQuery({ ...meQuery(), enabled: !isDemo })
  const { data: friendList } = useFriendsList({ enabled: !isDemo })
  const { viewingFriendId, avatarPopping, hintBubbleOpen } = useFriendStore()

  const [panelOpen, setPanelOpen] = useState(false)

  const myNickname = friendList?.me.nickname || me?.profile?.nickname || '小满'
  const myAvatar = friendList?.me.avatar ?? me?.profile?.avatar ?? 'mascot:tuan:cheer:exercise'
  const friends = demoFriends ?? friendList?.friends ?? []

  const stackNames = [myNickname, ...friends.map((f) => f.nickname)]
  const stackAvatars = [myAvatar, ...friends.map((f) => f.avatar)]

  function handleSelectTarget(targetFriendId: string | null) {
    friendActions.selectFriend(targetFriendId)
    setPanelOpen(false)
    if (targetFriendId !== null && pathname !== '/' && !pathname.startsWith('/dev')) {
      router.push('/')
    }
  }

  return (
    <div className="relative flex items-center">
      <Popover
        open={panelOpen}
        onOpenChange={(next) => {
          setPanelOpen(next)
          if (next) friendActions.dismissHintBubble()
        }}
        align="start"
        side="bottom"
        sideOffset={8}
        clean
        className="w-68 p-2"
        trigger={
          <button
            type="button"
            data-friend-avatar-anchor="true"
            aria-label={
              friends.length > 0
                ? `我和 ${friends.length} 位好友，点击切换查看打卡情况`
                : '打开我的与好友打卡面板'
            }
            style={{
              transform: avatarPopping ? 'scale(1.22)' : undefined,
              transition: 'transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            className={cn(
              'ease-spring hover:bg-surface-sunken/70 relative flex items-center rounded-full p-0.5 transition-transform active:scale-95',
              viewingFriendId !== null &&
                'ring-primary ring-offset-background ring-2 ring-offset-1',
            )}
          >
            <AvatarStack names={stackNames} avatars={stackAvatars} max={3} size="sm" />
          </button>
        }
      >
        <div className="flex flex-col gap-1">
          <div className="text-tiny text-muted flex items-center justify-between px-2.5 pt-1 pb-0.5 font-semibold">
            <span>打卡视角切换</span>
            <span>{friends.length > 0 ? `共 ${friends.length} 位好友` : '暂无好友'}</span>
          </div>

          <div className="divide-border/50 flex max-h-72 flex-col divide-y overflow-y-auto">
            {/* 第一行：置顶当前用户自己 */}
            <button
              type="button"
              onClick={() => handleSelectTarget(null)}
              className={cn(
                'hover:bg-surface-sunken flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                viewingFriendId === null && 'bg-primary-soft/60',
              )}
            >
              <Avatar name={myNickname} avatar={myAvatar} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-body text-foreground truncate font-semibold">
                    {myNickname}
                  </span>
                  <span className="bg-surface-sunken text-muted text-tiny py-0.2 shrink-0 rounded-full px-1.5 font-medium">
                    我自己
                  </span>
                </div>
                <div className="text-tiny text-muted truncate">查看我的打卡主页</div>
              </div>
              {viewingFriendId === null && (
                <Icon name="check" size={16} className="text-primary-ink shrink-0" />
              )}
            </button>

            {/* 下方按顺序展示所有好友 */}
            {friends.map((friend) => {
              const selected = viewingFriendId === friend.userId
              return (
                <button
                  key={friend.userId}
                  type="button"
                  onClick={() => handleSelectTarget(friend.userId)}
                  className={cn(
                    'hover:bg-surface-sunken flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                    selected && 'bg-primary-soft/60',
                  )}
                >
                  <Avatar
                    name={friend.nickname}
                    avatar={friend.avatar}
                    size="sm"
                    ring={friend.streak > 0}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-body text-foreground truncate font-semibold">
                      {friend.nickname}
                    </div>
                    <div className="text-tiny text-muted truncate tabular-nums">
                      今日 {friend.todayDone}/{friend.todayPlanned} 项 · 连续 {friend.streak} 天
                    </div>
                  </div>
                  {selected ? (
                    <Icon name="check" size={16} className="text-primary-ink shrink-0" />
                  ) : (
                    <Icon name="chevron-right" size={15} className="text-muted shrink-0" />
                  )}
                </button>
              )
            })}
          </div>

          {/* 底部快捷添加好友按钮 */}
          <button
            type="button"
            onClick={() => {
              setPanelOpen(false)
              friendActions.openAddSheet()
            }}
            className="text-caption text-primary-ink hover:bg-primary-soft/60 mt-0.5 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 font-semibold transition-colors"
          >
            <Icon name="plus" size={15} />
            <span>添加好友</span>
          </button>
        </div>
      </Popover>

      {/* 添加好友成功后的引导气泡提示 */}
      {hintBubbleOpen && (
        <button
          type="button"
          onClick={() => {
            friendActions.dismissHintBubble()
            setPanelOpen(true)
          }}
          className="bg-primary text-primary-foreground shadow-float animate-bounce-in absolute top-[calc(100%+0.5rem)] left-0 z-40 flex items-center gap-1.5 rounded-2xl px-3 py-1.5 whitespace-nowrap"
        >
          <span className="bg-primary absolute -top-1 left-4 size-2.5 rotate-45" />
          <Icon name="custom" size={14} className="relative z-10 shrink-0" />
          <span className="text-tiny relative z-10 font-semibold">
            点击这里可以看到好友的打卡情况～
          </span>
        </button>
      )}
    </div>
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
      onSelect: () => friendActions.openAddSheet(),
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
      <AddFriendSheet />
      <FriendMeteorOverlay />
    </>
  )
}
