'use client'

import { useRef, useState } from 'react'
import { Mascot } from '@/components/mascot/mascot'
import { MascotSvg, type MascotRegistryCharacter } from '@/components/mascot/mascot-svg'
import { Avatar } from '@/components/ui/avatar'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { moduleMeta, type ModuleTone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'

/* ============================================================================
 * 1. 顶栏铃铛未读角标组件原型（Issue #20）
 * ========================================================================== */

export function NotificationBellBadge({
  unreadCount = 0,
  hasLightDot = false,
  label = '消息与通知',
  onClick,
}: {
  unreadCount?: number
  hasLightDot?: boolean
  label?: string
  onClick?: () => void
}) {
  const showCount = unreadCount > 0
  const showDot = !showCount && hasLightDot
  const countLabel = unreadCount > 99 ? '99+' : String(unreadCount)
  const a11yLabel = showCount
    ? `${label}（${unreadCount} 条未读）`
    : showDot
      ? `${label}（有新动态）`
      : label

  return (
    <button
      type="button"
      aria-label={a11yLabel}
      title={a11yLabel}
      onClick={onClick}
      className="ease-spring text-foreground hover:bg-surface-sunken relative inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-[transform,background-color] duration-(--dur-fast) select-none active:scale-95"
    >
      {/* 紧贴 22×22 铃铛本体定位：角标左下角始终贴合铃铛右上肩部，数字变长时向右自然延展 */}
      <span className="relative inline-flex items-center justify-center">
        <Icon name="bell" size={22} />
        {showCount && (
          <span
            aria-hidden
            className="bg-danger text-on-primary ring-surface pointer-events-none absolute -top-1.5 left-2.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[10px] leading-none font-bold ring-2"
          >
            {countLabel}
          </span>
        )}
        {showDot && (
          <span
            aria-hidden
            className="bg-danger ring-surface pointer-events-none absolute -top-0.5 right-0 size-2 rounded-full ring-2"
          />
        )}
      </span>
    </button>
  )
}

/* ============================================================================
 * 2. 二级通知动态卡片（5min 打卡聚合 / 宠物互动 / 24h 造访足迹）（Issue #19 / #20 / #22）
 * ========================================================================== */

export function FeedCardsShowcase({ compact = false }: { compact?: boolean } = {}) {
  const [expandedAgg, setExpandedAgg] = useState(true)
  const [repliedPoke, setRepliedPoke] = useState(false)

  const aggregatedItems: { tone: ModuleTone; title: string; time: string }[] = [
    { tone: 'exercise', title: '晨间慢跑 30 分钟', time: '08:12' },
    { tone: 'diet', title: '好好吃无糖燕麦早餐', time: '08:14' },
    { tone: 'study', title: '早读背诵 40 个核心词', time: '08:15' },
  ]

  return (
    <div className="@container">
      <div className={cn('grid gap-3', !compact && '@2xl:grid-cols-2')}>
        {/* 卡片 A：5 分钟滑动窗口聚合打卡动态 */}
        <Card
          variant="outline"
          data-ann="playbook.social.feed-cards.aggregated-checkin"
          className="flex flex-col justify-between gap-3"
        >
          <div className="flex items-start gap-3">
            <div className="relative shrink-0">
              <Avatar name="阿柚" avatar="mascot:tuan:cheer:diet" size="md" ring />
              <span className="bg-danger ring-surface absolute -top-0.5 -left-0.5 size-2.5 rounded-full ring-2" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-caption font-bold">阿柚</span>
                  <Badge tone="exercise" icon="check">
                    5 分钟内连打 3 项
                  </Badge>
                </div>
                <span className="text-tiny text-subtle shrink-0 font-mono">08:15</span>
              </div>
              <p className="text-caption text-foreground mt-1 leading-relaxed">
                阿柚 刚刚一口气完成了 <span className="font-bold">晨间慢跑 30 分钟</span> 等 3
                项今日打卡！
              </p>

              {/* 聚合明细折叠区 */}
              {expandedAgg && (
                <ul className="bg-surface-sunken mt-2.5 grid gap-1.5 rounded-xl p-2.5">
                  {aggregatedItems.map((item) => (
                    <li key={item.title} className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <IconTile icon={moduleMeta[item.tone].icon} tone={item.tone} size="sm" />
                        <span className="text-tiny truncate font-semibold">{item.title}</span>
                      </div>
                      <span className="text-tiny text-subtle shrink-0 font-mono">{item.time}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="border-border flex flex-wrap items-center justify-between gap-2 border-t pt-2.5">
            <button
              type="button"
              onClick={() => setExpandedAgg((v) => !v)}
              className="text-tiny text-muted hover:text-foreground font-semibold"
            >
              {expandedAgg ? '收起打卡明细 ↑' : '展开全部 3 项明细 ↓'}
            </button>
            <Button size="sm" variant="secondary" icon="sparkles">
              去ta小窝夸夸
            </Button>
          </div>
        </Card>

        {/* 卡片 B：宠物互动与温柔提醒通知 */}
        <div className="grid gap-3">
          <Card
            variant="outline"
            data-ann="playbook.social.feed-cards.pet-remind"
            className="flex items-start gap-3"
          >
            <div className="relative shrink-0">
              <Avatar name="七七" avatar="mascot:mian:sleepy:sleep" size="md" />
              <span className="bg-surface shadow-soft absolute -right-1.5 -bottom-1 rounded-full p-0.5">
                <MascotSvg character="mian" mood="happy" size={22} />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-caption font-bold">七七 · 绵绵</span>
                  <Badge tone="sleep" icon="megaphone">
                    打卡问候
                  </Badge>
                </div>
                <span className="text-tiny text-subtle shrink-0 font-mono">14:20</span>
              </div>
              <p className="text-caption text-foreground mt-1 leading-relaxed">
                七七 派绵绵来问候：「今天的小目标还差 1 个就圆满啦，一起加油～」
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={repliedPoke ? 'secondary' : 'primary'}
                  icon={repliedPoke ? 'check' : 'hand'}
                  onClick={() => setRepliedPoke(true)}
                >
                  {repliedPoke ? '已回戳绵绵' : '回戳一下'}
                </Button>
                <Button size="sm" variant="ghost">
                  去完成待办
                </Button>
              </div>
            </div>
          </Card>

          {/* 卡片 C：24h 静默去重造访足迹 */}
          <Card
            variant="sunken"
            data-ann="playbook.social.feed-cards.visit-footprint"
            className="flex items-center justify-between gap-3 py-3"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <IconTile icon="footprints" tone="study" size="sm" />
              <div className="min-w-0">
                <p className="text-caption font-semibold">
                  豆豆 带着墩墩来你的小窝看了一眼，留下了小脚印
                </p>
                <p className="text-tiny text-muted">
                  24 小时内多次造访静默合并更新时间，不重复打扰 · 最近 18:05
                </p>
              </div>
            </div>
            <Badge tone="neutral" className="shrink-0">
              足迹
            </Badge>
          </Card>
        </div>
      </div>
    </div>
  )
}

/* ============================================================================
 * 3. 两级消息与通知中心完整交互沙盒（手机端钻取 vs 桌面端双栏，Decision #4 & #6）
 * ========================================================================== */

type ChannelId = 'feed' | 'system' | 'ayou' | 'doudou' | 'nanfeng'

interface InboxRowItem {
  id: ChannelId
  kind: 'channel-feed' | 'channel-system' | 'friend-active' | 'friend-unfriended'
  title: string
  subtitle: string
  time: string
  unread: number
  avatar?: string
  mascot?: MascotRegistryCharacter
  streak?: number
}

interface ChatMsg {
  id: string
  sender: 'me' | 'friend'
  text: string
  time: string
  status?: 'sending' | 'sent' | 'read' | 'failed'
}

const INITIAL_INBOX: InboxRowItem[] = [
  {
    id: 'feed',
    kind: 'channel-feed',
    title: '打卡与房间动态',
    subtitle: '阿柚 完成了「晨间慢跑」等 3 项打卡 · 七七 派绵绵来问候你',
    time: '5 分钟前',
    unread: 3,
  },
  {
    id: 'system',
    kind: 'channel-system',
    title: '官方与系统通知',
    subtitle: '手账上新：新伙伴「绵绵」与「柚柚」正式入驻陪伴注册表～',
    time: '昨天',
    unread: 1,
  },
  {
    id: 'ayou',
    kind: 'friend-active',
    title: '阿柚',
    subtitle: '晚上一起背完最后 30 个单词呀！',
    time: '12:40',
    unread: 2,
    avatar: 'mascot:tuan:cheer:diet',
    mascot: 'tuan',
    streak: 14,
  },
  {
    id: 'doudou',
    kind: 'friend-active',
    title: '豆豆',
    subtitle: '[互动] 给你的团团投喂了一颗草莓大福～',
    time: '昨天',
    unread: 0,
    avatar: 'mascot:dun:happy:study',
    mascot: 'dun',
    streak: 6,
  },
  {
    id: 'nanfeng',
    kind: 'friend-unfriended',
    title: '南风',
    subtitle: '周末愉快，下次再约跑步！',
    time: '10月24日',
    unread: 0,
    avatar: 'mascot:you:happy:exercise',
    mascot: 'you',
  },
]

const INITIAL_CHATS: Record<string, ChatMsg[]> = {
  ayou: [
    {
      id: 'm1',
      sender: 'friend',
      text: '早安！我刚跑完 30 分钟，今天天气超舒服～',
      time: '08:16',
    },
    {
      id: 'm2',
      sender: 'me',
      text: '太厉害了！我刚吃完早饭，准备开始看书啦',
      time: '08:20',
      status: 'read',
    },
    {
      id: 'm3',
      sender: 'friend',
      text: '晚上一起背完最后 30 个单词呀！',
      time: '12:40',
    },
  ],
  doudou: [
    {
      id: 'd1',
      sender: 'friend',
      text: '路过你的小窝，顺手给团团喂了个草莓大福🍓',
      time: '昨天 19:10',
    },
    {
      id: 'd2',
      sender: 'me',
      text: '哈哈谢谢豆豆！团团开心得转圈圈了～',
      time: '昨天 19:15',
      status: 'read',
    },
  ],
  nanfeng: [
    {
      id: 'n1',
      sender: 'friend',
      text: '这周的运动计划我先告一段落啦。',
      time: '10月24日',
    },
    {
      id: 'n2',
      sender: 'me',
      text: '周末愉快，下次再约跑步！',
      time: '10月24日',
      status: 'read',
    },
  ],
}

const HEALING_PHRASES = [
  '今天也要给自己一个大大的拥抱～',
  '看到你打卡我也充满干劲啦！',
  '累了就早点休息，明天我们继续',
  '摸摸头，哪怕完成一小步也很棒！',
]

export function TwoLevelNotificationCenterDemo() {
  const [viewport, setViewport] = useState<'mobile' | 'desktop'>('mobile')
  const [inbox, setInbox] = useState<InboxRowItem[]>(INITIAL_INBOX)
  const [activeId, setActiveId] = useState<ChannelId>('feed')
  // 手机端：level 1 = 列表页，level 2 = 详情页
  const [mobileLevel, setMobileLevel] = useState<1 | 2>(1)
  const [chats, setChats] = useState<Record<string, ChatMsg[]>>(INITIAL_CHATS)
  const [draft, setDraft] = useState('')
  const [showPhrases, setShowPhrases] = useState(false)
  const [reportingMsg, setReportingMsg] = useState<ChatMsg | null>(null)
  const [reportSubmitted, setReportSubmitted] = useState(false)
  const msgSeq = useRef(100)

  const totalUnread = inbox.reduce((sum, item) => sum + item.unread, 0)
  const activeItem = inbox.find((item) => item.id === activeId) ?? inbox[0]

  function selectChannel(id: ChannelId) {
    setActiveId(id)
    setMobileLevel(2)
    setReportingMsg(null)
    setReportSubmitted(false)
    // 进入后清除该频道的未读红点
    setInbox((prev) => prev.map((row) => (row.id === id ? { ...row, unread: 0 } : row)))
  }

  function markAllRead() {
    setInbox((prev) => prev.map((row) => ({ ...row, unread: 0 })))
  }

  function restoreUnreadDemo() {
    setInbox(INITIAL_INBOX)
    setChats(INITIAL_CHATS)
    setMobileLevel(1)
    setReportingMsg(null)
    setReportSubmitted(false)
  }

  function sendChatMessage(textToSend: string) {
    const trimmed = textToSend.trim()
    if (!trimmed || activeItem.kind !== 'friend-active') return
    const nextId = ++msgSeq.current
    const newMsg: ChatMsg = {
      id: `msg-${nextId}`,
      sender: 'me',
      text: trimmed,
      time: '刚刚',
      status: 'read',
    }
    setChats((prev) => ({
      ...prev,
      [activeId]: [...(prev[activeId] ?? []), newMsg],
    }))
    setInbox((prev) =>
      prev.map((row) =>
        row.id === activeId ? { ...row, subtitle: trimmed, time: '刚刚', unread: 0 } : row,
      ),
    )
    setDraft('')
    setShowPhrases(false)
  }

  return (
    <div className="grid gap-4">
      {/* 顶部模式切换器与状态说明 */}
      <div className="border-border bg-surface flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            options={[
              { value: 'mobile', label: '手机端（一级列表 → 二级详情钻取）' },
              { value: 'desktop', label: '桌面端（左列表 + 右详情双栏）' },
            ]}
            value={viewport}
            onValueChange={(v) => setViewport(v)}
            label="切换视口模式"
            size="sm"
          />
          {viewport === 'mobile' && (
            <Badge tone={mobileLevel === 1 ? 'primary' : 'exercise'}>
              当前层级：
              {mobileLevel === 1 ? '第 1 级 · 消息总列表' : `第 2 级 · ${activeItem.title}`}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={restoreUnreadDemo}>
            重置未读红点演示
          </Button>
        </div>
      </div>

      {/* 主容器：手机端窄框 vs 桌面端双栏宽框 */}
      <div
        data-ann="playbook.social.two-level-app.frame"
        className={cn(
          'border-border bg-paper shadow-card mx-auto w-full overflow-hidden rounded-3xl border transition-all',
          viewport === 'mobile' ? 'max-w-[400px]' : 'max-w-5xl',
        )}
      >
        <div
          className={cn(
            'min-h-[540px]',
            viewport === 'desktop'
              ? 'divide-border grid grid-cols-[320px_1fr] divide-x'
              : 'flex flex-col',
          )}
        >
          {/* ==================== 第 1 级：消息与通知总列表 ==================== */}
          {(viewport === 'desktop' || mobileLevel === 1) && (
            <div className="bg-surface flex flex-col justify-between">
              <div>
                {/* 一级顶栏 */}
                <div className="border-border flex items-center justify-between border-b px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-heading font-bold">消息与通知</h3>
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
                    className="text-tiny text-primary-ink disabled:text-subtle font-semibold hover:underline disabled:no-underline"
                  >
                    全部已读
                  </button>
                </div>

                {/* 顶部独立两项通知入口：打卡房间与动态 / 官方与系统通知 */}
                <div className="border-border/60 bg-surface/60 grid grid-cols-2 gap-2.5 border-b px-4 py-3">
                  {inbox
                    .filter((row) => row.kind === 'channel-feed' || row.kind === 'channel-system')
                    .map((row) => {
                      const isSelected = viewport === 'desktop' && row.id === activeId
                      return (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => selectChannel(row.id)}
                          className={cn(
                            'border-border/80 bg-surface hover:bg-surface-sunken/70 flex min-w-0 flex-col gap-2 rounded-2xl border p-3 text-left transition-colors',
                            isSelected && 'border-primary/50 bg-primary-soft/35',
                          )}
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <IconTile
                              icon={row.kind === 'channel-feed' ? 'sparkles' : 'megaphone'}
                              tone={row.kind === 'channel-feed' ? 'primary' : 'diet'}
                              size="md"
                            />
                            {row.unread > 0 ? (
                              <span className="bg-danger text-on-primary flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-[11px] leading-none font-bold">
                                {row.unread}
                              </span>
                            ) : (
                              <Icon name="chevron-right" size={16} className="text-subtle" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-caption truncate font-bold">
                              {row.kind === 'channel-feed' ? '打卡房间与动态' : row.title}
                            </p>
                            <p className="text-tiny text-muted mt-0.5 truncate">{row.subtitle}</p>
                          </div>
                        </button>
                      )
                    })}
                </div>

                {/* 下侧好友私聊会话 */}
                <div className="px-4 pt-3 pb-1">
                  <p className="text-tiny text-muted font-semibold">和朋友聊天</p>
                </div>

                <ul className="divide-border/60 divide-y">
                  {inbox
                    .filter((row) => row.kind !== 'channel-feed' && row.kind !== 'channel-system')
                    .map((row) => {
                      const isSelected = viewport === 'desktop' && row.id === activeId
                      return (
                        <li key={row.id}>
                          <button
                            type="button"
                            onClick={() => selectChannel(row.id)}
                            className={cn(
                              'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                              isSelected
                                ? 'bg-primary-soft/65'
                                : 'hover:bg-surface-sunken active:bg-surface-sunken',
                            )}
                          >
                            <div className="relative shrink-0">
                              <Avatar
                                name={row.title}
                                avatar={row.avatar}
                                size="md"
                                className={cn(row.kind === 'friend-unfriended' && 'opacity-60')}
                              />
                              {row.unread > 0 && (
                                <span className="bg-danger ring-surface absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="text-caption truncate font-bold">
                                    {row.title}
                                  </span>
                                  {row.kind === 'friend-unfriended' && (
                                    <Badge tone="neutral">已解除好友</Badge>
                                  )}
                                </div>
                                <span className="text-tiny text-subtle shrink-0 font-mono">
                                  {row.time}
                                </span>
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
                                {row.unread > 0 ? (
                                  <span className="bg-danger text-on-primary flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 font-mono text-[10px] leading-none font-bold">
                                    {row.unread}
                                  </span>
                                ) : row.kind === 'friend-active' ? (
                                  <Icon
                                    name="check-double"
                                    size={14}
                                    className="text-subtle shrink-0"
                                  />
                                ) : null}
                              </div>
                            </div>
                          </button>
                        </li>
                      )
                    })}
                </ul>
              </div>
            </div>
          )}

          {/* ==================== 第 2 级：具体通知详情或 1v1 好友私聊 ==================== */}
          {(viewport === 'desktop' || mobileLevel === 2) && (
            <div className="bg-paper flex min-h-[540px] flex-col justify-between">
              {/* 二级顶栏（手机端带返回按钮） */}
              <div className="border-border bg-surface flex items-center justify-between gap-2 border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  {viewport === 'mobile' && (
                    <IconButton
                      icon="chevron-left"
                      label="返回消息列表"
                      size="sm"
                      onClick={() => setMobileLevel(1)}
                    />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-subhead font-bold">{activeItem.title}</h4>
                      {activeItem.streak && (
                        <Badge tone="diet" icon="flame">
                          {activeItem.streak} 天
                        </Badge>
                      )}
                      {activeItem.kind === 'friend-unfriended' && (
                        <Badge tone="neutral">只读历史归档</Badge>
                      )}
                    </div>
                    <p className="text-tiny text-muted">
                      {activeItem.kind === 'channel-feed'
                        ? '好友打卡里程碑（5 分钟聚合）、宠物轻互动与房间脚印'
                        : activeItem.kind === 'channel-system'
                          ? 'DayDayOn 官方更新与账号安全通知'
                          : activeItem.kind === 'friend-unfriended'
                            ? '你们已解除好友关系，历史聊天记录仅供查阅'
                            : '仅支持治愈纯文本与快捷短语 · 单条 ≤ 300 字'}
                    </p>
                  </div>
                </div>

                {activeItem.kind === 'friend-active' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="flag"
                    onClick={() => {
                      const list = chats[activeId] ?? []
                      const target = list.find((m) => m.sender === 'friend') ?? list[0]
                      if (target) setReportingMsg(target)
                    }}
                  >
                    举报
                  </Button>
                )}
              </div>

              {/* 二级主体内容区 */}
              {activeItem.kind === 'channel-feed' ? (
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  <FeedCardsShowcase compact={viewport === 'mobile'} />
                </div>
              ) : activeItem.kind === 'channel-system' ? (
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  <Card variant="plain" className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge tone="diet" icon="sparkles">
                        版本公告
                      </Badge>
                      <span className="text-tiny text-subtle font-mono">2026-11-02</span>
                    </div>
                    <h5 className="text-subhead font-bold">
                      新伙伴「绵绵」与「柚柚」加入陪伴注册表！
                    </h5>
                    <p className="text-caption text-muted leading-relaxed">
                      现在你可以在「我的 →
                      陪伴伙伴」中随时切换团团、墩墩、绵绵（云朵睡帽）或柚柚（黄油贝雷帽）。切换陪伴伙伴不会覆盖你最初设定的个人头像。
                    </p>
                  </Card>
                  <Card variant="plain" className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge tone="study" icon="shield">
                        社区守则
                      </Badge>
                      <span className="text-tiny text-subtle font-mono">常驻提示</span>
                    </div>
                    <h5 className="text-subhead font-bold">温柔陪伴，守护纯净手账空间</h5>
                    <p className="text-caption text-muted leading-relaxed">
                      好友小窝与私信仅对双向确认的好友开放。如果遇到打扰，可随时在好友房间右上角解除好友，或在聊天页内发起举报。
                    </p>
                  </Card>
                </div>
              ) : reportingMsg ? (
                /* 内嵌式举报视图（遵守 ui-design-system.md 第 7 节：弹层里不再叠弹层） */
                <div className="flex-1 space-y-4 p-4">
                  <Card variant="outline" className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge tone="danger" icon="flag">
                        内嵌举报视图（不叠二级弹窗）
                      </Badge>
                      <button
                        type="button"
                        onClick={() => setReportingMsg(null)}
                        className="text-tiny text-muted hover:text-foreground font-semibold"
                      >
                        返回会话
                      </button>
                    </div>
                    <p className="text-caption font-bold">举报 {activeItem.title} 发送的消息：</p>
                    <blockquote className="bg-surface-sunken text-tiny text-muted rounded-xl p-3">
                      “{reportingMsg.text}”
                    </blockquote>
                    {reportSubmitted ? (
                      <div className="bg-success-soft text-success-ink text-caption rounded-xl p-3 font-semibold">
                        ✓ 已收到你的反馈，我们会尽快核实处理，感谢守护温暖社区。
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          {['垃圾广告 / 刷屏', '不友善或冒犯言语', '骚扰行为', '其他违规内容'].map(
                            (reason) => (
                              <button
                                key={reason}
                                type="button"
                                onClick={() => setReportSubmitted(true)}
                                className="border-border bg-surface hover:bg-primary-soft hover:text-primary-ink text-tiny rounded-xl border px-3 py-2 text-left font-semibold transition-colors"
                              >
                                {reason}
                              </button>
                            ),
                          )}
                        </div>
                        <p className="text-tiny text-subtle">
                          注：同一条消息每人仅可提交 1 次举报，系统自动保存被举报消息快照。
                        </p>
                      </>
                    )}
                  </Card>
                </div>
              ) : (
                /* 1v1 好友私聊消息流 */
                <div className="flex flex-1 flex-col justify-between">
                  <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    <div className="text-center">
                      <span className="bg-surface-sunken text-tiny text-muted inline-block rounded-full px-3 py-1">
                        仅展示纯文本与治愈贴纸 · 按 cursor 向前翻页加载历史
                      </span>
                    </div>

                    {(chats[activeId] ?? []).map((m) => {
                      const isMe = m.sender === 'me'
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            'flex items-end gap-2',
                            isMe ? 'justify-end' : 'justify-start',
                          )}
                        >
                          {!isMe && (
                            <Avatar name={activeItem.title} avatar={activeItem.avatar} size="sm" />
                          )}
                          {/* 我方消息：状态与时间统一置放在气泡左侧外部 */}
                          {isMe && (
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
                              'max-w-[75%] rounded-2xl border px-3.5 py-2.5',
                              isMe
                                ? 'border-primary/20 bg-primary-soft text-foreground rounded-br-sm shadow-2xs'
                                : 'border-border/60 bg-surface shadow-soft text-foreground rounded-bl-sm',
                            )}
                          >
                            <p className="text-caption leading-relaxed break-words">{m.text}</p>
                          </div>
                          {/* 对方消息：时间置放在气泡右侧外部 */}
                          {!isMe && (
                            <span className="text-subtle shrink-0 pb-0.5 font-mono text-[10px] leading-none">
                              {m.time}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* 底部输入栏：区分「正常好友」与「已解除好友冻结态（Decision #6）」 */}
                  {activeItem.kind === 'friend-unfriended' ? (
                    <div
                      data-ann="playbook.social.two-level-app.frozen-bar"
                      className="border-border bg-surface-sunken text-caption text-muted flex items-center justify-center gap-2 border-t px-4 py-3.5 text-center font-semibold"
                    >
                      <Icon name="user-x" size={16} />
                      <span>你们已解除好友关系，无法继续发送消息</span>
                    </div>
                  ) : (
                    <div className="border-border bg-surface border-t p-3">
                      {showPhrases && (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {HEALING_PHRASES.map((phrase) => (
                            <button
                              key={phrase}
                              type="button"
                              onClick={() => sendChatMessage(phrase)}
                              className="bg-primary-soft text-primary-ink text-tiny hover:bg-primary/20 rounded-full px-3 py-1 font-semibold transition-colors"
                            >
                              {phrase}
                            </button>
                          ))}
                        </div>
                      )}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          sendChatMessage(draft)
                        }}
                        className="flex items-center gap-2"
                      >
                        <button
                          type="button"
                          aria-label="治愈快捷语与表情"
                          title="治愈快捷语与表情"
                          onClick={() => setShowPhrases((v) => !v)}
                          className={cn(
                            'ease-spring flex size-10 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95',
                            showPhrases
                              ? 'border-primary/30 bg-primary-soft text-primary-ink'
                              : 'border-border bg-surface-sunken text-foreground hover:bg-primary-soft/60',
                          )}
                        >
                          <Icon name="smile" size={24} />
                        </button>
                        <input
                          type="text"
                          value={draft}
                          maxLength={300}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder={`给 ${activeItem.title} 发一句鼓励吧（≤300字）…`}
                          className="border-border bg-surface-sunken text-caption focus:border-primary h-10 min-w-0 flex-1 rounded-full border px-4 outline-none"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          icon="send"
                          disabled={draft.trim().length === 0}
                        >
                          发送
                        </Button>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ============================================================================
 * 4. 1v1 聊天消息气泡状态机与空状态样本（Issue #25 / #26）
 * ========================================================================== */

export function ChatBubbleStatesDemo() {
  const [retried, setRetried] = useState(false)

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card
        variant="outline"
        data-ann="playbook.social.chat-states.bubbles"
        className="bg-paper space-y-3.5 p-4"
      >
        <p className="text-tiny text-muted font-semibold">
          4 种消息状态（我方采用主题浅色气泡，已读 / 发送中 / 重试状态统一置放于气泡左侧）
        </p>

        {/* 1. 对方消息（暖白底色） */}
        <div className="flex items-end gap-2">
          <Avatar name="阿柚" avatar="mascot:tuan:cheer:diet" size="sm" />
          <div className="border-border/60 bg-surface shadow-soft text-foreground max-w-[75%] rounded-2xl rounded-bl-sm border px-3.5 py-2.5">
            <p className="text-caption">今天单词背完啦，给你比个心！</p>
          </div>
          <span className="text-subtle shrink-0 pb-0.5 font-mono text-[10px] leading-none">
            20:14
          </span>
        </div>

        {/* 2. 我方已读（主题浅色底 + 左侧已读状态） */}
        <div className="flex items-end justify-end gap-2">
          <div className="text-subtle flex shrink-0 flex-col items-end gap-0.5 pb-0.5 text-[10px] leading-none">
            <span className="text-primary-ink flex items-center gap-0.5 font-semibold">
              <Icon name="check-double" size={12} />
              <span>已读</span>
            </span>
            <span className="font-mono">20:15</span>
          </div>
          <div className="border-primary/20 bg-primary-soft text-foreground max-w-[75%] rounded-2xl rounded-br-sm border px-3.5 py-2.5 shadow-2xs">
            <p className="text-caption">收到了！我还有 10 分钟平板支撑～</p>
          </div>
        </div>

        {/* 3. 乐观更新发送中（左侧显示发送中状态） */}
        <div className="flex items-end justify-end gap-2">
          <div className="text-muted flex shrink-0 flex-col items-end gap-0.5 pb-0.5 text-[10px] leading-none">
            <span className="flex items-center gap-1 font-semibold">
              <Icon name="clock" size={11} />
              <span>发送中…</span>
            </span>
            <span className="font-mono">20:16</span>
          </div>
          <div className="border-primary/15 bg-primary-soft/75 text-foreground max-w-[75%] rounded-2xl rounded-br-sm border px-3.5 py-2.5">
            <p className="text-caption">做完运动去洗个热水澡✨</p>
          </div>
        </div>

        {/* 4. 发送失败 + 点击幂等重试（左侧显示未送达与点击重试按钮） */}
        <div className="flex items-end justify-end gap-2">
          {retried ? (
            <div className="text-subtle flex shrink-0 flex-col items-end gap-0.5 pb-0.5 text-[10px] leading-none">
              <span className="text-success-ink flex items-center gap-0.5 font-semibold">
                <Icon name="check" size={12} />
                <span>已重试送达</span>
              </span>
              <span className="font-mono">20:17</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setRetried(true)}
              className="bg-danger-soft text-danger-ink text-tiny hover:bg-danger/20 mb-0.5 flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-semibold transition-colors"
            >
              <Icon name="alert" size={13} />
              <span>未送达 · 点击重试</span>
            </button>
          )}
          <div
            className={cn(
              'max-w-[72%] rounded-2xl rounded-br-sm border px-3.5 py-2.5',
              retried
                ? 'border-primary/20 bg-primary-soft text-foreground shadow-2xs'
                : 'border-danger/50 bg-primary-soft/60 text-foreground',
            )}
          >
            <p className="text-caption">晚安，明天见！</p>
          </div>
        </div>
      </Card>

      {/* 空状态展示 */}
      <Card
        variant="outline"
        data-ann="playbook.social.chat-states.empty"
        className="bg-paper flex flex-col items-center justify-center gap-2 p-6 text-center"
      >
        <Mascot character="mian" mood="sleepy" size={84} floating />
        <p className="text-subhead font-bold">信箱干干净净</p>
        <p className="text-caption text-muted max-w-xs">
          去好友的小窝逛逛，戳戳ta的陪伴伙伴，或者送出一句今日鼓励吧～
        </p>
      </Card>
    </div>
  )
}

/* ============================================================================
 * 5. 本地 DFA 敏感词温柔拦截与 24h 禁言冷却演示（Issue #23 / #24）
 * ========================================================================== */

const DEMO_SENSITIVE_ROOTS = ['刷单', '兼职加微', '笨蛋', '赌博']

/**
 * 演示用 DFA + 跨噪音字符匹配（跳过 <= 3 个非中英文符号）
 */
function detectSensitiveDemo(input: string): string | null {
  const normalized = input.toLowerCase()
  // 去噪检测：剔除夹杂的特殊符号、下划线、空格
  const stripped = normalized.replace(/[^\u4e00-\u9fa5a-z0-9]/g, '')
  for (const word of DEMO_SENSITIVE_ROOTS) {
    if (normalized.includes(word) || stripped.includes(word)) {
      return word
    }
  }
  return null
}

export function SafetyModerationDemo() {
  const [text, setText] = useState('笨_蛋，今天怎么还不打卡')
  const [hitCount, setHitCount] = useState(1)
  const matchedWord = detectSensitiveDemo(text)
  const isMuted = hitCount >= 5

  const presets = [
    { label: '正常鼓励语', value: '今天一起坚持背完 30 个单词呀！' },
    { label: '含拆字绕过变体（笨_蛋）', value: '笨_蛋，今天怎么还不打卡' },
    { label: '含灰产导流词（刷单）', value: '日结兼职加微一起做刷单任务' },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card
        variant="outline"
        data-ann="playbook.social.safety.dfa-tester"
        className="flex flex-col justify-between gap-3"
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <Badge tone="study" icon="shield">
              纯本地 DFA 引擎 · 0 AI 额度消耗
            </Badge>
            <span className="text-tiny text-muted font-mono">24h 累计触发：{hitCount} / 5</span>
          </div>
          <p className="text-caption text-muted mt-2">
            支持全半角归一、繁简归一及跨 <code className="font-mono">&lt;= 3</code>{' '}
            个噪音字符跳字检测。拦截时<strong>保留用户输入草稿不清空</strong>，方便用户直接修改。
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setText(p.value)}
                className="bg-surface-sunken hover:bg-primary-soft hover:text-primary-ink text-tiny rounded-full px-3 py-1 font-semibold transition-colors"
              >
                填入：{p.label}
              </button>
            ))}
          </div>

          <div className="mt-3">
            <input
              type="text"
              value={text}
              disabled={isMuted}
              onChange={(e) => setText(e.target.value)}
              className="border-border bg-surface-sunken text-caption focus:border-primary h-10 w-full rounded-xl border px-3.5 outline-none disabled:opacity-60"
            />
          </div>

          {matchedWord ? (
            <div className="bg-warning-soft text-warning-ink text-tiny mt-2.5 flex items-start gap-2 rounded-xl p-3 font-semibold">
              <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
              <div>
                <p>
                  这句话可能包含不友善或敏感词汇（命中示例：「{matchedWord}」），换个温柔的说法吧～
                </p>
                <p className="mt-0.5 font-normal opacity-85">
                  返回结构：HTTP 422 · code: &quot;CONTENT_SENSITIVE&quot;（不记录明文日志）
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-success-soft text-success-ink text-tiny mt-2.5 flex items-center gap-2 rounded-xl p-3 font-semibold">
              <Icon name="check" size={16} />
              <span>内容温和合规，可直接发送</span>
            </div>
          )}
        </div>

        <div className="border-border flex items-center justify-between border-t pt-2.5">
          <button
            type="button"
            onClick={() => setHitCount((c) => Math.min(5, c + 1))}
            className="text-tiny text-muted hover:text-foreground font-semibold"
          >
            模拟触发拦截计数 (+1)
          </button>
          <button
            type="button"
            onClick={() => {
              setHitCount(1)
              setText('今天一起坚持背完 30 个单词呀！')
            }}
            className="text-tiny text-primary-ink font-semibold hover:underline"
          >
            重置计数
          </button>
        </div>
      </Card>

      {/* 右侧：触发 5 次后的 24h 禁言冷却状态（USER_MUTED） */}
      <Card
        variant="outline"
        data-ann="playbook.social.safety.muted-banner"
        className="flex flex-col justify-between gap-3"
      >
        <div>
          <div className="flex items-center justify-between">
            <Badge tone="danger" icon="alert">
              防刷屏与禁言冷却（USER_MUTED）
            </Badge>
            <span className="text-tiny text-subtle font-mono">HTTP 403</span>
          </div>
          <p className="text-caption text-muted mt-2">
            24 小时内累计触发 5 次敏感词拦截，或 10 秒内发送超过 5
            条消息时，自动进入临时冷却保护状态。
          </p>

          <div className="border-danger/30 bg-danger-soft text-danger-ink mt-4 rounded-2xl border p-4">
            <div className="flex items-center gap-2 font-bold">
              <Icon name="clock" size={18} />
              <span>发送功能休息中（冷却至 明天 14:30）</span>
            </div>
            <p className="text-tiny mt-1 leading-relaxed opacity-90">
              由于短时间内多次触发社区安全提醒，私信与互动发送已暂时进入 24
              小时冷静期。期间你仍可正常完成个人打卡。
            </p>
          </div>
        </div>

        <div className="bg-surface-sunken text-tiny text-muted rounded-xl p-3">
          安全审计边界：后台仅存 <code className="font-mono">contentHash (SHA-256)</code> 与规则分类{' '}
          <code className="font-mono">matchedCategory</code>，不落盘用户违规原文。
        </div>
      </Card>
    </div>
  )
}
