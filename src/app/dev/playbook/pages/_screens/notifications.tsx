'use client'

import { useRef, useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'

type PreviewChannelId = 'feed' | 'system' | 'ayou' | 'nanfeng'

interface PreviewChannel {
  id: PreviewChannelId
  kind: 'feed' | 'system' | 'friend' | 'unfriended'
  title: string
  subtitle: string
  time: string
  unread: number
  avatar?: string
}

const PREVIEW_CHANNELS: PreviewChannel[] = [
  {
    id: 'feed',
    kind: 'feed',
    title: '打卡与房间动态',
    subtitle: '阿柚 完成了「晨间慢跑」等 3 项打卡 · 七七 派绵绵来问候你',
    time: '5 分钟前',
    unread: 3,
  },
  {
    id: 'system',
    kind: 'system',
    title: '官方与系统通知',
    subtitle: '新伙伴「绵绵」与「柚柚」已加入陪伴注册表～',
    time: '昨天',
    unread: 1,
  },
  {
    id: 'ayou',
    kind: 'friend',
    title: '阿柚',
    subtitle: '晚上一起背完最后 30 个单词呀！',
    time: '12:40',
    unread: 2,
    avatar: 'mascot:tuan:cheer:diet',
  },
  {
    id: 'nanfeng',
    kind: 'unfriended',
    title: '南风',
    subtitle: '周末愉快，下次再约跑步！',
    time: '10月24日',
    unread: 0,
    avatar: 'mascot:you:happy:exercise',
  },
]

/**
 * `/notifications` 二级页面预览（Issue #20 · #26）
 * 手机端窄屏：第 1 级消息列表 → 点击进入第 2 级详情/私聊；
 * 桌面端宽屏（@3xl）：左列表 + 右详情双栏自适应。
 */
export function NotificationsScreen() {
  const [channels, setChannels] = useState<PreviewChannel[]>(PREVIEW_CHANNELS)
  const [activeId, setActiveId] = useState<PreviewChannelId>('feed')
  const [mobileLevel, setMobileLevel] = useState<1 | 2>(1)
  const [replyText, setReplyText] = useState('')
  const msgSeq = useRef(10)
  const [ayouMessages, setAyouMessages] = useState([
    { id: '1', from: 'friend' as const, text: '早安！我刚跑完 30 分钟～', time: '08:16' },
    { id: '2', from: 'me' as const, text: '太棒啦！我准备开始看书了', time: '08:20' },
    { id: '3', from: 'friend' as const, text: '晚上一起背完最后 30 个单词呀！', time: '12:40' },
  ])

  const activeChannel = channels.find((c) => c.id === activeId) ?? channels[0]
  const totalUnread = channels.reduce((sum, c) => sum + c.unread, 0)

  function openChannel(id: PreviewChannelId) {
    setActiveId(id)
    setMobileLevel(2)
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)))
  }

  function markAllRead() {
    setChannels((prev) => prev.map((c) => ({ ...c, unread: 0 })))
  }

  function sendAyouMessage() {
    const trimmed = replyText.trim()
    if (!trimmed) return
    const nextId = ++msgSeq.current
    setAyouMessages((prev) => [
      ...prev,
      { id: `m-${nextId}`, from: 'me', text: trimmed, time: '刚刚' },
    ])
    setReplyText('')
  }

  return (
    <div className="@container">
      <div className="border-border bg-surface shadow-card overflow-hidden rounded-3xl border @3xl:grid @3xl:min-h-[520px] @3xl:grid-cols-[290px_1fr] @3xl:divide-x">
        {/* 第 1 级：消息与通知总列表（手机端 level=1 时显示，桌面端常驻左栏） */}
        <div
          className={cn('flex flex-col justify-between', mobileLevel === 2 && 'hidden @3xl:flex')}
        >
          <div>
            <div className="border-border flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-caption font-bold">全部会话与频道</span>
                {totalUnread > 0 && (
                  <span className="bg-danger text-on-primary text-tiny inline-flex h-5 items-center justify-center rounded-full px-2 font-mono leading-none font-bold">
                    {totalUnread} 未读
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={markAllRead}
                disabled={totalUnread === 0}
                className="text-tiny text-primary-ink disabled:text-subtle font-semibold"
              >
                全部已读
              </button>
            </div>

            <ul className="divide-border/60 divide-y p-2">
              {channels.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => openChannel(row.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors',
                      row.id === activeId
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
                        <Avatar
                          name={row.title}
                          avatar={row.avatar}
                          size="md"
                          className={cn(row.kind === 'unfriended' && 'opacity-60')}
                        />
                      )}
                      {row.unread > 0 && (
                        <span className="bg-danger ring-surface absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-caption truncate font-bold">{row.title}</span>
                          {row.kind === 'unfriended' && <Badge tone="neutral">已解除</Badge>}
                        </div>
                        <span className="text-tiny text-subtle shrink-0 font-mono">{row.time}</span>
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
                            {row.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-border bg-surface-sunken/50 text-tiny text-muted border-t px-4 py-2.5">
            点击任意行钻取进入第 2 级详情
          </div>
        </div>

        {/* 第 2 级：具体通知流或好友 1v1 聊天室 */}
        <div
          className={cn(
            'bg-paper flex min-h-[440px] flex-col justify-between',
            mobileLevel === 1 && 'hidden @3xl:flex',
          )}
        >
          <div className="border-border bg-surface flex items-center justify-between gap-2 border-b px-4 py-2.5">
            <div className="flex items-center gap-2">
              <div className="@3xl:hidden">
                <IconButton
                  icon="chevron-left"
                  label="返回列表"
                  size="sm"
                  onClick={() => setMobileLevel(1)}
                />
              </div>
              <div>
                <h4 className="text-caption font-bold">{activeChannel.title}</h4>
                <p className="text-tiny text-muted">
                  {activeChannel.kind === 'feed'
                    ? '5 分钟聚合打卡动态与小窝互动'
                    : activeChannel.kind === 'system'
                      ? '官方公告与安全通知'
                      : activeChannel.kind === 'unfriended'
                        ? '已解除好友 · 历史会话只读归档'
                        : '纯文本鼓励与治愈贴纸（≤300 字）'}
                </p>
              </div>
            </div>
          </div>

          {activeChannel.kind === 'feed' ? (
            <div className="flex-1 space-y-2.5 p-3.5">
              <Card variant="outline" className="space-y-1.5 p-3.5">
                <div className="flex items-center justify-between">
                  <Badge tone="exercise" icon="check">
                    5 分钟内连打 3 项
                  </Badge>
                  <span className="text-tiny text-subtle font-mono">08:15</span>
                </div>
                <p className="text-caption font-semibold">
                  阿柚 刚刚完成了「晨间慢跑 30 分钟」等 3 项今日打卡！
                </p>
              </Card>
              <Card variant="outline" className="space-y-1.5 p-3.5">
                <div className="flex items-center justify-between">
                  <Badge tone="sleep" icon="megaphone">
                    打卡问候
                  </Badge>
                  <span className="text-tiny text-subtle font-mono">14:20</span>
                </div>
                <p className="text-caption font-semibold">
                  七七 派绵绵来问候：「今天的小目标还差 1 个就圆满啦～」
                </p>
              </Card>
              <Card variant="sunken" className="flex items-center gap-2.5 p-3">
                <IconTile icon="footprints" tone="study" size="sm" />
                <p className="text-tiny text-muted">
                  豆豆 带着墩墩来你的小窝看了一眼（24h 内多次来访静默合并）
                </p>
              </Card>
            </div>
          ) : activeChannel.kind === 'system' ? (
            <div className="flex-1 space-y-2.5 p-3.5">
              <Card variant="plain" className="space-y-1.5 p-3.5">
                <Badge tone="diet" icon="sparkles">
                  版本上新
                </Badge>
                <p className="text-caption font-bold">新伙伴「绵绵」与「柚柚」加入陪伴注册表</p>
                <p className="text-tiny text-muted">
                  前往「我的 → 陪伴伙伴」即可体验 4 只糯米团子，切换伙伴不会覆盖你最初设定的头像。
                </p>
              </Card>
            </div>
          ) : (
            <div className="flex flex-1 flex-col justify-between">
              <div className="flex-1 space-y-2.5 p-3.5">
                {ayouMessages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'flex items-end gap-2',
                      m.from === 'me' ? 'justify-end' : 'justify-start',
                    )}
                  >
                    {m.from === 'friend' && (
                      <Avatar name={activeChannel.title} avatar={activeChannel.avatar} size="sm" />
                    )}
                    {m.from === 'me' && (
                      <div className="text-subtle flex shrink-0 flex-col items-end gap-0.5 pb-0.5 text-[10px] leading-none">
                        <span className="text-primary-ink flex items-center gap-0.5 font-semibold">
                          <Icon name="check-double" size={12} />
                          <span>已读</span>
                        </span>
                        <span className="font-mono">{m.time}</span>
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[75%] rounded-2xl border px-3.5 py-2',
                        m.from === 'me'
                          ? 'border-primary/20 bg-primary-soft text-foreground rounded-br-sm shadow-2xs'
                          : 'border-border/60 bg-surface shadow-soft text-foreground rounded-bl-sm',
                      )}
                    >
                      <p className="text-caption">{m.text}</p>
                    </div>
                    {m.from === 'friend' && (
                      <span className="text-subtle shrink-0 pb-0.5 font-mono text-[10px] leading-none">
                        {m.time}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {activeChannel.kind === 'unfriended' ? (
                <div className="border-border bg-surface-sunken text-tiny text-muted flex items-center justify-center gap-1.5 border-t px-3 py-3 font-semibold">
                  <Icon name="user-x" size={14} />
                  <span>你们已解除好友关系，无法继续发送消息</span>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    sendAyouMessage()
                  }}
                  className="border-border bg-surface flex items-center gap-2 border-t p-2.5"
                >
                  <button
                    type="button"
                    aria-label="治愈快捷语与表情"
                    title="治愈快捷语与表情"
                    onClick={() => setReplyText('今天也要给自己一个大大的拥抱～')}
                    className="border-border bg-surface-sunken text-foreground hover:bg-primary-soft/60 ease-spring flex size-9.5 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95"
                  >
                    <Icon name="smile" size={22} />
                  </button>
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="发送一句温柔鼓励（≤300字）…"
                    className="border-border bg-surface-sunken text-caption h-9.5 min-w-0 flex-1 rounded-full border px-3.5 outline-none"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    icon="send"
                    disabled={replyText.trim().length === 0}
                  >
                    发送
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
