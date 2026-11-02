'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Badge, IconTile } from '@/components/ui/badge'
import { IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { ChatRoom } from '@/features/chat/components/chat-room'
import { friendActions } from '@/features/friend/friend-store'
import type { FriendSummary } from '@/features/friend/schemas'
import { useChatThreads } from '@/lib/api/queries/chat'
import { useFriendsList } from '@/lib/api/queries/friends'
import {
  useMarkNotificationsRead,
  useNotificationsList,
  useNotificationSummary,
} from '@/lib/api/queries/notifications'
import { cn } from '@/lib/cn'
import {
  CheckinAggregateCard,
  PetInteractionCard,
  SystemNoticeCard,
  VisitFootprintCard,
} from './feed-cards'

export type ChannelId = 'feed' | 'system' | (string & {})

export interface ChannelItem {
  id: string
  kind: 'feed' | 'system' | 'friend'
  title: string
  subtitle: string
  time: string
  unread: number
  avatar?: string | null
  friend?: FriendSummary
  isFrozen?: boolean
}

/**
 * 两级通知与消息中心核心组件（Issue #20 · ADR-0026 · Confirmed Decision #4）
 *
 * 响应式布局规范：
 * - 手机端（窄屏）：钻取式导航。第 1 级查看消息与频道列表；点击进入第 2 级详情并隐藏底栏；
 * - 桌面端（@3xl 宽屏）：左右双栏自适应并列展示。
 */
export function MessageCenter({ initialChannel = 'feed' }: { initialChannel?: string }) {
  const router = useRouter()
  const [activeChannelId, setActiveChannelId] = useState<string>(initialChannel)
  const [mobileLevel, setMobileLevel] = useState<1 | 2>(1)

  // 接口数据
  const { data: summary } = useNotificationSummary()
  const { data: feedData, isLoading: feedLoading } = useNotificationsList({ channel: 'feed' })
  const { data: systemData, isLoading: systemLoading } = useNotificationsList({ channel: 'system' })
  const { data: friendsData } = useFriendsList()
  const { data: chatThreadsData } = useChatThreads()
  const markReadMutation = useMarkNotificationsRead()

  const feedItems = feedData?.items ?? []
  const systemItems = systemData?.items ?? []
  const friends = friendsData?.friends ?? []
  const chatThreads = chatThreadsData?.threads ?? []

  // 计算频道未读数
  const feedUnread = feedItems.filter((i) => !i.readAt).length
  const systemUnread = systemItems.filter((i) => !i.readAt).length
  const chatUnread = chatThreads.reduce((sum, t) => sum + t.unreadCount, 0)
  const totalUnread =
    (summary?.unreadCount ?? 0) > 0 ? summary!.unreadCount : feedUnread + systemUnread + chatUnread

  // 构造第 1 级渠道列表
  const latestFeed = feedItems[0]
  const latestSystem = systemItems[0]

  const friendMap = new Map(friends.map((f) => [f.userId, f]))
  const handledUserIds = new Set<string>()

  const friendChannels: ChannelItem[] = []

  // 1. 优先载入所有已有聊天往来的会话（包含活跃好友与已解除好友只读归档）
  for (const thread of chatThreads) {
    handledUserIds.add(thread.friendUserId)
    const friendInfo = friendMap.get(thread.friendUserId)
    const subtitle = thread.isFrozen
      ? thread.lastMessage
        ? `[只读归档] ${thread.lastMessage.content}`
        : '已解除好友 · 只读历史归档'
      : thread.lastMessage
        ? thread.lastMessage.content
        : friendInfo
          ? `今日完成 ${friendInfo.todayDone}/${friendInfo.todayPlanned} 项 · 连续 ${friendInfo.streak} 天`
          : '点击进入私聊会话'

    const timeStr = thread.lastMessage
      ? new Date(thread.lastMessage.createdAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : ''

    friendChannels.push({
      id: thread.friendUserId,
      kind: 'friend',
      title: thread.friend.nickname,
      subtitle,
      time: timeStr,
      unread: thread.unreadCount,
      avatar: thread.friend.avatar,
      friend: friendInfo,
      isFrozen: thread.isFrozen,
    })
  }

  // 2. 载入尚未有过聊天记录的活跃好友
  for (const friend of friends) {
    if (!handledUserIds.has(friend.userId)) {
      friendChannels.push({
        id: friend.userId,
        kind: 'friend',
        title: friend.nickname,
        subtitle: `今日已完成 ${friend.todayDone}/${friend.todayPlanned} 项 · 连续 ${friend.streak} 天`,
        time: '',
        unread: 0,
        avatar: friend.avatar,
        friend,
        isFrozen: false,
      })
    }
  }

  const channels: ChannelItem[] = [
    {
      id: 'feed',
      kind: 'feed',
      title: '打卡与房间动态',
      subtitle: latestFeed ? latestFeed.title : '暂无最新好友打卡动态',
      time: latestFeed
        ? new Date(latestFeed.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '',
      unread: feedUnread,
    },
    {
      id: 'system',
      kind: 'system',
      title: '官方与系统通知',
      subtitle: latestSystem ? latestSystem.title : 'DayDayOn 治愈伙伴持续守护中',
      time: latestSystem
        ? new Date(latestSystem.createdAt).toLocaleDateString([], {
            month: 'numeric',
            day: 'numeric',
          })
        : '',
      unread: systemUnread,
    },
    ...friendChannels,
  ]

  const activeChannel = channels.find((c) => c.id === activeChannelId) ?? channels[0]

  // 进入某频道时，标记已读
  function handleSelectChannel(channelId: string) {
    setActiveChannelId(channelId)
    setMobileLevel(2)

    if (channelId === 'feed' && feedUnread > 0) {
      markReadMutation.mutate({ channel: 'feed' })
    } else if (channelId === 'system' && systemUnread > 0) {
      markReadMutation.mutate({ channel: 'system' })
    }
  }

  function handleMarkAllRead() {
    markReadMutation.mutate({ all: true })
  }

  function handleGoToFriendRoom(friendUserId: string) {
    friendActions.selectFriend(friendUserId)
    router.push('/')
  }

  return (
    <div className="@container w-full">
      <div className="border-border bg-surface shadow-card overflow-hidden rounded-3xl border @3xl:grid @3xl:min-h-[580px] @3xl:grid-cols-[300px_1fr] @3xl:divide-x">
        {/* ======================================================================
         * 第 1 级：消息与频道总列表（手机端 level=1 时展示，桌面端左栏常驻）
         * ==================================================================== */}
        <div
          className={cn('flex flex-col justify-between', mobileLevel === 2 && 'hidden @3xl:flex')}
        >
          <div className="flex flex-col">
            <div className="border-border flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-caption font-bold">全部会话与频道</span>
                {totalUnread > 0 && (
                  <span
                    data-testid="inbox-total-unread"
                    className="bg-danger text-on-primary text-tiny inline-flex h-5 items-center justify-center rounded-full px-2 font-mono leading-none font-bold"
                  >
                    {totalUnread > 99 ? '99+' : totalUnread} 未读
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={totalUnread === 0 || markReadMutation.isPending}
                className="text-tiny text-primary-ink disabled:text-subtle cursor-pointer font-semibold hover:underline disabled:cursor-not-allowed"
              >
                全部已读
              </button>
            </div>

            <ul className="divide-border/60 divide-y p-2">
              {channels.map((row) => {
                const isActive = row.id === activeChannelId
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectChannel(row.id)}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors',
                        isActive
                          ? '@3xl:bg-primary-soft/65 hover:bg-surface-sunken'
                          : 'hover:bg-surface-sunken',
                      )}
                    >
                      <div className="relative shrink-0">
                        {row.kind === 'feed' ? (
                          <IconTile icon="sparkles" tone="primary" size="md" />
                        ) : row.kind === 'system' ? (
                          <IconTile icon="megaphone" tone="diet" size="md" />
                        ) : (
                          <Avatar name={row.title} avatar={row.avatar} size="md" />
                        )}
                        {row.unread > 0 && (
                          <span className="bg-danger ring-surface absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-caption truncate font-bold">{row.title}</span>
                            {row.isFrozen && <Badge tone="neutral">归档</Badge>}
                          </div>
                          {row.time && (
                            <span className="text-tiny text-subtle shrink-0 font-mono">
                              {row.time}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <p
                            className={cn(
                              'text-tiny truncate',
                              row.unread > 0 ? 'text-foreground font-semibold' : 'text-muted',
                            )}
                          >
                            {row.subtitle}
                          </p>
                          {row.unread > 0 && (
                            <span className="bg-danger text-on-primary flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 font-mono text-[10px] leading-none font-bold">
                              {row.unread > 99 ? '99+' : row.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="border-border bg-surface-sunken/40 text-tiny text-muted border-t px-4 py-2.5">
            点击任意会话进入第 2 级互动
          </div>
        </div>

        {/* ======================================================================
         * 第 2 级：频道动态流详情或 1v1 好友互动室
         * ==================================================================== */}
        {activeChannel.kind === 'friend' ? (
          <div
            className={cn(
              'bg-paper flex min-h-[500px] flex-1 flex-col justify-between',
              mobileLevel === 1 && 'hidden @3xl:flex',
            )}
          >
            <ChatRoom
              friendUserId={activeChannel.id}
              friendNickname={activeChannel.title}
              friendAvatar={activeChannel.avatar ?? null}
              friendStreak={activeChannel.friend?.streak}
              isFrozenProp={activeChannel.isFrozen}
              showBackButton={mobileLevel === 2}
              onBack={() => setMobileLevel(1)}
            />
          </div>
        ) : (
          <div
            className={cn(
              'bg-paper flex min-h-[500px] flex-col justify-between',
              mobileLevel === 1 && 'hidden @3xl:flex',
            )}
          >
            {/* 第 2 级顶栏 */}
            <div className="border-border bg-surface flex items-center justify-between gap-2 border-b px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="@3xl:hidden">
                  <IconButton
                    icon="chevron-left"
                    label="返回消息列表"
                    size="sm"
                    onClick={() => setMobileLevel(1)}
                  />
                </div>
                <div>
                  <h3 className="text-caption font-bold">{activeChannel.title}</h3>
                  <p className="text-tiny text-muted">
                    {activeChannel.kind === 'feed'
                      ? '5 分钟聚合打卡动态与小窝互动'
                      : '版本上新与安全服务通知'}
                  </p>
                </div>
              </div>

              {activeChannel.kind === 'feed' && feedUnread > 0 && (
                <button
                  type="button"
                  onClick={() => markReadMutation.mutate({ channel: 'feed' })}
                  className="text-tiny text-primary-ink cursor-pointer font-semibold hover:underline"
                >
                  本频道已读
                </button>
              )}
            </div>

            {/* 第 2 级内容流 */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeChannel.kind === 'feed' ? (
                feedLoading ? (
                  <div className="text-tiny text-muted flex h-48 items-center justify-center">
                    加载动态中…
                  </div>
                ) : feedItems.length === 0 ? (
                  <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
                    <div className="bg-surface-sunken text-muted flex size-12 items-center justify-center rounded-full">
                      <Icon name="sparkles" size={24} />
                    </div>
                    <p className="text-caption text-muted font-semibold">暂无好友动态</p>
                    <p className="text-tiny text-subtle">
                      和好友一起打卡或造访小窝，动态会实时显示在这里～
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {feedItems.map((item) => {
                      if (item.kind === 'checkin_aggregate') {
                        return (
                          <CheckinAggregateCard
                            key={item.id}
                            notification={item}
                            onGoToRoom={handleGoToFriendRoom}
                          />
                        )
                      }
                      if (item.kind === 'pet_interaction') {
                        return (
                          <PetInteractionCard
                            key={item.id}
                            notification={item}
                            onReplyPoke={handleGoToFriendRoom}
                          />
                        )
                      }
                      if (item.kind === 'visit_footprint') {
                        return <VisitFootprintCard key={item.id} notification={item} />
                      }
                      return (
                        <Card key={item.id} variant="outline" className="p-3">
                          <p className="text-caption font-bold">{item.title}</p>
                          <p className="text-tiny text-muted mt-1">{item.content}</p>
                        </Card>
                      )
                    })}
                  </div>
                )
              ) : systemLoading ? (
                <div className="text-tiny text-muted flex h-48 items-center justify-center">
                  加载系统通知中…
                </div>
              ) : systemItems.length === 0 ? (
                <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
                  <div className="bg-surface-sunken text-muted flex size-12 items-center justify-center rounded-full">
                    <Icon name="megaphone" size={24} />
                  </div>
                  <p className="text-caption text-muted font-semibold">暂无官方通知</p>
                  <p className="text-tiny text-subtle">重要公告与版本更新将在这里呈现</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {systemItems.map((item) => (
                    <SystemNoticeCard key={item.id} notification={item} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
