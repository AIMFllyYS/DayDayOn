'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BackButton } from '@/components/layout/back-button'
import { Avatar } from '@/components/ui/avatar'
import { Badge, IconTile } from '@/components/ui/badge'
import { IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { ChatRoom } from '@/features/chat/components/chat-room'
import { friendActions } from '@/features/friend/friend-store'
import type { FriendSummary } from '@/features/friend/schemas'
import { useChatThreads, useMarkChatRead } from '@/lib/api/queries/chat'
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
 * 两级全屏通知与消息中心（Issue #20 · Issue #80 · ADR-0026）
 *
 * 视觉与交互规范：
 * - 去除外层圆角容器包裹与冗余说明文字，一级与二级均为贴边全屏社交样式；
 * - 一级顶部独立设置「打卡房间与动态」「官方与系统通知」双入口卡片；
 * - 下侧按社交会话流排布「和朋友聊天」列表；
 * - 手机端点击进入全屏二级页面（支持左上角返回与系统侧滑返回），桌面端（@3xl）左右全屏双栏联动。
 */
export function MessageCenter({ initialChannel = 'feed' }: { initialChannel?: string }) {
  const router = useRouter()
  const [activeChannelId, setActiveChannelId] = useState<string>(initialChannel)
  const [mobileLevel, setMobileLevel] = useState<1 | 2>(1)

  const { data: summary } = useNotificationSummary()
  const { data: feedData, isLoading: feedLoading } = useNotificationsList({ channel: 'feed' })
  const { data: systemData, isLoading: systemLoading } = useNotificationsList({ channel: 'system' })
  const { data: friendsData } = useFriendsList()
  const { data: chatThreadsData } = useChatThreads()
  const markReadMutation = useMarkNotificationsRead()
  const markChatReadMutation = useMarkChatRead()

  // 支持手机端系统返回手势从第 2 级回到第 1 级列表
  useEffect(() => {
    function onPopState() {
      setMobileLevel(1)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const feedItems = feedData?.items ?? []
  const systemItems = systemData?.items ?? []
  const friends = friendsData?.friends ?? []
  const chatThreads = chatThreadsData?.threads ?? []

  const feedUnread = feedItems.filter((i) => !i.readAt).length
  const systemUnread = systemItems.filter((i) => !i.readAt).length
  const chatUnread = chatThreads.reduce((sum, t) => sum + t.unreadCount, 0)
  const notificationUnread = summary?.unreadCount ?? feedUnread + systemUnread
  const totalUnread = notificationUnread + chatUnread

  const latestFeed = feedItems[0]
  const latestSystem = systemItems[0]

  const friendMap = new Map(friends.map((f) => [f.userId, f]))
  const handledUserIds = new Set<string>()
  const friendChannels: ChannelItem[] = []

  // 1. 优先载入已有聊天往来的会话（含活跃好友与只读历史归档）
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
          : '给好友发一句今日鼓励吧'

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

  const topCategories: [ChannelItem, ChannelItem] = [
    {
      id: 'feed',
      kind: 'feed',
      title: '打卡房间与动态',
      subtitle: latestFeed ? latestFeed.title : '好友打卡聚合与小窝串门动态',
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
      subtitle: latestSystem ? latestSystem.title : '版本更新公告与服务通知',
      time: latestSystem
        ? new Date(latestSystem.createdAt).toLocaleDateString([], {
            month: 'numeric',
            day: 'numeric',
          })
        : '',
      unread: systemUnread,
    },
  ]

  const allChannels: ChannelItem[] = [...topCategories, ...friendChannels]
  const activeChannel = allChannels.find((c) => c.id === activeChannelId) ?? topCategories[0]

  function handleSelectChannel(channelId: string) {
    setActiveChannelId(channelId)
    if (typeof window !== 'undefined' && window.innerWidth < 768 && mobileLevel === 1) {
      window.history.pushState({ ddoMsgLevel: 2, channelId }, '')
    }
    setMobileLevel(2)

    if (channelId === 'feed' && feedUnread > 0) {
      markReadMutation.mutate({ channel: 'feed' })
    } else if (channelId === 'system' && systemUnread > 0) {
      markReadMutation.mutate({ channel: 'system' })
    } else {
      const targetFriend = friendChannels.find((f) => f.id === channelId)
      if (targetFriend && targetFriend.unread > 0) {
        markChatReadMutation.mutate(channelId)
      }
    }
  }

  function handleBackToLevel1() {
    if (
      typeof window !== 'undefined' &&
      (window.history.state as { ddoMsgLevel?: number } | null)?.ddoMsgLevel === 2
    ) {
      window.history.back()
      return
    }
    setMobileLevel(1)
  }

  function handleMarkAllRead() {
    if (notificationUnread > 0) {
      markReadMutation.mutate({ all: true })
    }
    for (const thread of chatThreads) {
      if (thread.unreadCount > 0) {
        markChatReadMutation.mutate(thread.friendUserId)
      }
    }
  }

  function handleGoToFriendRoom(friendUserId: string) {
    friendActions.selectFriend(friendUserId)
    router.push('/')
  }

  return (
    <div className="@container flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="divide-border flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden @3xl:grid @3xl:grid-cols-[340px_1fr] @3xl:divide-x @4xl:grid-cols-[360px_1fr]">
        {/* ======================================================================
         * 第 1 级：全屏消息首页（顶部双通知入口 + 下方好友聊天列表）
         * ==================================================================== */}
        <div
          className={cn(
            'bg-background flex h-full min-h-0 flex-col',
            mobileLevel === 2 && 'hidden @3xl:flex',
          )}
        >
          {/* 一级全屏吸顶顶栏 */}
          <header className="border-border/70 bg-background/90 sticky top-0 z-20 flex shrink-0 items-center justify-between gap-2 border-b px-4 pt-[calc(var(--safe-top)+0.5rem)] pb-2.5 backdrop-blur-md md:pt-4 md:pb-3">
            <div className="flex min-w-0 items-center gap-1.5">
              <BackButton fallbackHref="/" />
              <h1 className="text-subhead md:text-heading truncate font-bold">消息与通知</h1>
              {totalUnread > 0 && (
                <span
                  data-testid="inbox-total-unread"
                  className="bg-danger text-on-primary text-tiny inline-flex h-5 shrink-0 items-center justify-center rounded-full px-2 font-mono leading-none font-bold"
                >
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={totalUnread === 0 || markReadMutation.isPending}
              className="text-tiny text-primary-ink disabled:text-subtle hover:bg-primary-soft/60 shrink-0 cursor-pointer rounded-full px-2.5 py-1 font-semibold transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              全部已读
            </button>
          </header>

          {/* 一级全屏滚动区 */}
          <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(var(--safe-bottom)+1.5rem)] md:pb-6">
            {/* 顶部独立双入口：打卡房间与动态 / 官方与系统通知 */}
            <section
              aria-label="通知分类入口"
              className="border-border/60 bg-surface/60 grid grid-cols-2 gap-2.5 border-b px-4 py-3.5"
            >
              {topCategories.map((cat) => {
                const isActive = cat.id === activeChannelId
                return (
                  <button
                    key={cat.id}
                    type="button"
                    data-testid={`notice-entry-${cat.id}`}
                    onClick={() => handleSelectChannel(cat.id)}
                    className={cn(
                      'border-border/80 bg-surface hover:bg-surface-sunken/70 relative flex min-w-0 cursor-pointer flex-col gap-2 rounded-2xl border p-3 text-left transition-all active:scale-[0.98]',
                      isActive && '@3xl:border-primary/50 @3xl:bg-primary-soft/35',
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <IconTile
                        icon={cat.kind === 'feed' ? 'sparkles' : 'megaphone'}
                        tone={cat.kind === 'feed' ? 'primary' : 'diet'}
                        size="md"
                      />
                      {cat.unread > 0 ? (
                        <span className="bg-danger text-on-primary flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-[11px] leading-none font-bold">
                          {cat.unread > 99 ? '99+' : cat.unread}
                        </span>
                      ) : (
                        <Icon name="chevron-right" size={16} className="text-subtle shrink-0" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-caption truncate font-bold">{cat.title}</p>
                      <p
                        className={cn(
                          'text-tiny mt-0.5 truncate',
                          cat.unread > 0 ? 'text-foreground font-medium' : 'text-muted',
                        )}
                      >
                        {cat.subtitle}
                      </p>
                    </div>
                  </button>
                )
              })}
            </section>

            {/* 下侧好友聊天会话列表 */}
            <section aria-label="和朋友聊天" className="flex flex-col">
              <div className="flex items-center justify-between px-4 pt-3.5 pb-1.5">
                <h2 className="text-tiny text-muted font-semibold">和朋友聊天</h2>
                {friendChannels.length > 0 && (
                  <span className="text-tiny text-subtle font-mono">
                    {friendChannels.length} 位伙伴
                  </span>
                )}
              </div>

              {friendChannels.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
                  <div className="bg-surface-sunken text-muted flex size-12 items-center justify-center rounded-full">
                    <Icon name="chat" size={22} />
                  </div>
                  <p className="text-caption text-muted font-semibold">还没有好友会话</p>
                  <p className="text-tiny text-subtle max-w-xs">
                    在排行榜或主页小窝添加伙伴后，就能在这里互相发消息鼓励啦～
                  </p>
                </div>
              ) : (
                <ul className="divide-border/50 divide-y">
                  {friendChannels.map((row) => {
                    const isActive = row.id === activeChannelId
                    return (
                      <li key={row.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectChannel(row.id)}
                          className={cn(
                            'flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors',
                            isActive
                              ? '@3xl:bg-primary-soft/55 hover:bg-surface-sunken/70'
                              : 'hover:bg-surface-sunken/70 active:bg-surface-sunken',
                          )}
                        >
                          <div className="relative shrink-0">
                            <Avatar
                              name={row.title}
                              avatar={row.avatar}
                              size="md"
                              className={cn(row.isFrozen && 'opacity-65')}
                            />
                            {row.unread > 0 && (
                              <span className="bg-danger ring-background absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span className="text-body truncate font-bold">{row.title}</span>
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
                                  'text-caption truncate',
                                  row.unread > 0 ? 'text-foreground font-semibold' : 'text-muted',
                                )}
                              >
                                {row.subtitle}
                              </p>
                              {row.unread > 0 && (
                                <span className="bg-danger text-on-primary flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full px-1.5 font-mono text-[10px] leading-none font-bold">
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
              )}
            </section>
          </div>
        </div>

        {/* ======================================================================
         * 第 2 级：全屏通知流详情或全屏 1v1 好友私聊室
         * ==================================================================== */}
        {activeChannel.kind === 'friend' ? (
          <div
            className={cn(
              'bg-background flex h-full min-h-0 flex-1 flex-col',
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
              onBack={handleBackToLevel1}
            />
          </div>
        ) : (
          <div
            className={cn(
              'bg-background flex h-full min-h-0 flex-1 flex-col',
              mobileLevel === 1 && 'hidden @3xl:flex',
            )}
          >
            {/* 第 2 级全屏吸顶顶栏 */}
            <header className="border-border bg-surface/95 sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 border-b px-4 pt-[calc(var(--safe-top)+0.5rem)] pb-2.5 backdrop-blur-md @3xl:pt-3.5 @3xl:pb-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="@3xl:hidden">
                  <IconButton
                    icon="chevron-left"
                    label="返回消息列表"
                    size="sm"
                    onClick={handleBackToLevel1}
                  />
                </div>
                <IconTile
                  icon={activeChannel.kind === 'feed' ? 'sparkles' : 'megaphone'}
                  tone={activeChannel.kind === 'feed' ? 'primary' : 'diet'}
                  size="sm"
                />
                <div className="min-w-0">
                  <h2 className="text-subhead truncate font-bold">{activeChannel.title}</h2>
                  <p className="text-tiny text-muted truncate">
                    {activeChannel.kind === 'feed'
                      ? '好友打卡动态聚合与小窝互动足迹'
                      : 'DayDayOn 官方更新公告与系统通知'}
                  </p>
                </div>
              </div>

              {activeChannel.kind === 'feed' && feedUnread > 0 && (
                <button
                  type="button"
                  onClick={() => markReadMutation.mutate({ channel: 'feed' })}
                  className="text-tiny text-primary-ink shrink-0 cursor-pointer font-semibold hover:underline"
                >
                  全部已读
                </button>
              )}
              {activeChannel.kind === 'system' && systemUnread > 0 && (
                <button
                  type="button"
                  onClick={() => markReadMutation.mutate({ channel: 'system' })}
                  className="text-tiny text-primary-ink shrink-0 cursor-pointer font-semibold hover:underline"
                >
                  全部已读
                </button>
              )}
            </header>

            {/* 第 2 级全屏滚动内容流 */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(var(--safe-bottom)+1.5rem)] md:px-6 md:pb-8">
              <div className="mx-auto w-full max-w-2xl">
                {activeChannel.kind === 'feed' ? (
                  feedLoading ? (
                    <div className="text-tiny text-muted flex h-48 items-center justify-center">
                      加载动态中…
                    </div>
                  ) : feedItems.length === 0 ? (
                    <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
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
                          <Card key={item.id} variant="outline" className="p-3.5">
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
                  <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
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
          </div>
        )}
      </div>
    </div>
  )
}
