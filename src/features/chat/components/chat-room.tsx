'use client'

import { useEffect, useRef, useState } from 'react'
import { Mascot } from '@/components/mascot/mascot'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import type { ChatMessageDto } from '@/features/chat/schemas'
import { isApiError } from '@/lib/api'
import { useChatMessages, useSendChatMessage } from '@/lib/api/queries/chat'
import { cn } from '@/lib/cn'

export interface ChatRoomProps {
  friendUserId: string
  friendNickname: string
  friendAvatar: string | null
  friendStreak?: number
  isFrozenProp?: boolean
  onBack?: () => void
  showBackButton?: boolean
  onReportMessage?: (message: ChatMessageDto) => void
}

interface LocalOptimisticMessage {
  tempId: string
  content: string
  createdAt: string
  status: 'sending' | 'error'
  error?: string
}

const HEALING_PHRASES = [
  '今天一起加油呀！✨',
  '记得按时喝水休息～🍵',
  '你已经很棒啦！🌟',
  '早点休息，晚安！🌙',
  '给你的坚持比个大拇指👍',
]

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString)
    if (Number.isNaN(d.getTime())) return ''
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
  } catch {
    return ''
  }
}

/**
 * 1v1 好友私聊会话室（Issue #25 · #26 · Decision #4 & #6）
 *
 * 核心规范：
 * 1. 外部左侧状态机：我方发送气泡左侧显示「已读」、「发送中…」、「未送达·重试」状态；
 * 2. 解除好友只读归档（Decision #6）：isFrozen 为 true 时展示横幅与置灰禁用输入框；
 * 3. 敏感词温柔拦截与草稿保留：命中 CONTENT_SENSITIVE (422) 时温和提示，严格保留输入框草稿文字不被清空。
 */
export function ChatRoom({
  friendUserId,
  friendNickname,
  friendAvatar,
  friendStreak,
  isFrozenProp = false,
  onBack,
  showBackButton = false,
  onReportMessage,
}: ChatRoomProps) {
  const [draft, setDraft] = useState('')
  const [showPhrases, setShowPhrases] = useState(false)
  const [moderationNotice, setModerationNotice] = useState<string | null>(null)
  const [localSending, setLocalSending] = useState<LocalOptimisticMessage[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, refetch } = useChatMessages({ friendUserId })
  const sendMutation = useSendChatMessage()

  const serverMessages = data?.messages ?? []
  const isFrozen = isFrozenProp || (data?.isFrozen ?? false)
  const displayNickname = data?.friend?.nickname || friendNickname
  const displayAvatar = data?.friend?.avatar !== undefined ? data.friend.avatar : friendAvatar

  // 消息按时间升序展示（旧在顶，新在底）
  const chronologicalMessages = [...serverMessages].reverse()

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [serverMessages.length, localSending.length])

  // 执行消息发送
  async function handleSend(textToSend: string) {
    const trimmed = textToSend.trim()
    if (!trimmed || isFrozen) return

    setModerationNotice(null)

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const optimisticMsg: LocalOptimisticMessage = {
      tempId,
      content: trimmed,
      createdAt: new Date().toISOString(),
      status: 'sending',
    }

    setLocalSending((prev) => [...prev, optimisticMsg])

    try {
      await sendMutation.mutateAsync({
        friendUserId,
        input: { content: trimmed },
      })
      // 成功发送：清空草稿与当前临时消息
      setDraft('')
      setLocalSending((prev) => prev.filter((m) => m.tempId !== tempId))
      void refetch()
    } catch (err: unknown) {
      if (isApiError(err)) {
        if (err.code === 'CONTENT_SENSITIVE') {
          // 命中敏感词：温和横幅提示，并严格保留当前用户输入的草稿
          setModerationNotice('内容包含不当词汇，请修改后重试')
          // 移除发送中占位气泡
          setLocalSending((prev) => prev.filter((m) => m.tempId !== tempId))
          return
        }
        if (err.code === 'FRIEND_RELATION_FROZEN') {
          // 双方已解除好友
          setModerationNotice('双方已不是好友，无法发送新私聊消息')
          setLocalSending((prev) => prev.filter((m) => m.tempId !== tempId))
          return
        }
        if (err.code === 'USER_MUTED') {
          setModerationNotice(err.message || '发言过于频繁或多次触发违规，已暂时静音，请稍后再试')
          setLocalSending((prev) => prev.filter((m) => m.tempId !== tempId))
          return
        }
      }

      // 普通网络或服务器错误：标记为「未送达·重试」
      setLocalSending((prev) =>
        prev.map((m) =>
          m.tempId === tempId ? { ...m, status: 'error' as const, error: '未送达' } : m,
        ),
      )
    }
  }

  // 重试未送达的消息
  async function handleRetry(msg: LocalOptimisticMessage) {
    setLocalSending((prev) =>
      prev.map((m) => (m.tempId === msg.tempId ? { ...m, status: 'sending' as const } : m)),
    )
    try {
      await sendMutation.mutateAsync({
        friendUserId,
        input: { content: msg.content },
      })
      setLocalSending((prev) => prev.filter((m) => m.tempId !== msg.tempId))
      void refetch()
    } catch {
      setLocalSending((prev) =>
        prev.map((m) => (m.tempId === msg.tempId ? { ...m, status: 'error' as const } : m)),
      )
    }
  }

  return (
    <div
      data-testid="chat-room"
      className="bg-background flex h-full min-h-0 w-full max-w-full min-w-0 flex-1 flex-col justify-between overflow-hidden"
    >
      {/* 1. 私聊室全屏吸顶顶栏 */}
      <div
        className={cn(
          'border-border bg-surface/95 sticky top-0 z-10 flex w-full max-w-full min-w-0 shrink-0 items-center justify-between gap-2 overflow-hidden border-b px-4 pb-2.5 backdrop-blur-md',
          showBackButton ? 'pt-[calc(var(--safe-top)+0.5rem)] @3xl:pt-3' : 'pt-3',
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {showBackButton && onBack && (
            <div className="shrink-0">
              <IconButton icon="chevron-left" label="返回消息列表" size="sm" onClick={onBack} />
            </div>
          )}
          <Avatar name={displayNickname} avatar={displayAvatar} size="sm" className="shrink-0" />
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
              <h4 className="text-caption truncate font-bold">{displayNickname}</h4>
              {friendStreak !== undefined && friendStreak > 0 && (
                <Badge tone="diet" icon="flame" className="shrink-0">
                  {friendStreak} 天
                </Badge>
              )}
              {isFrozen && (
                <Badge tone="neutral" className="shrink-0">
                  已解除好友 · 只读归档
                </Badge>
              )}
            </div>
            <p className="text-tiny text-muted truncate">
              {isFrozen
                ? '你们已解除好友关系，历史聊天记录仅供查阅'
                : '纯文本陪伴鼓励 · 单条 ≤ 300 字'}
            </p>
          </div>
        </div>

        {!isFrozen && onReportMessage && (
          <div className="shrink-0">
            <Button
              size="sm"
              variant="ghost"
              icon="flag"
              onClick={() => {
                const lastFriendMsg = [...serverMessages].find((m) => !m.isMine)
                if (lastFriendMsg) {
                  onReportMessage(lastFriendMsg)
                }
              }}
            >
              举报
            </Button>
          </div>
        )}
      </div>

      {/* 2. Decision #6 冻结模式提示横幅 */}
      {isFrozen && (
        <div
          data-testid="chat-frozen-banner"
          className="border-border bg-surface-sunken text-tiny text-muted flex w-full max-w-full min-w-0 items-center justify-center gap-2 border-b px-4 py-2 text-center font-semibold"
        >
          <Icon name="user-x" size={14} className="shrink-0" />
          <span className="truncate">双方已解除好友关系，历史聊天记录仅供存档查阅</span>
        </div>
      )}

      {/* 3. 敏感词温柔拦截提示条 */}
      {moderationNotice && (
        <div
          data-testid="chat-moderation-notice"
          className="bg-danger-soft text-danger-ink border-danger/20 text-tiny flex w-full max-w-full min-w-0 items-center justify-between gap-2 border-b px-4 py-2 font-semibold"
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <Icon name="alert" size={14} className="shrink-0" />
            <span className="break-words">{moderationNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setModerationNotice(null)}
            className="text-tiny shrink-0 cursor-pointer hover:underline"
          >
            知道了
          </button>
        </div>
      )}

      {/* 4. 消息气泡流区域 */}
      <div className="min-h-0 w-full max-w-full min-w-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto overscroll-x-none p-4">
        {isLoading ? (
          <div className="text-tiny text-muted flex h-48 items-center justify-center">
            加载聊天记录中…
          </div>
        ) : chronologicalMessages.length === 0 && localSending.length === 0 ? (
          /* 空状态 */
          <div
            data-testid="chat-empty-state"
            className="flex h-56 flex-col items-center justify-center gap-2 p-4 text-center"
          >
            <Mascot character="mian" mood="sleepy" size={72} floating />
            <p className="text-caption font-bold">信箱干干净净</p>
            <p className="text-tiny text-muted max-w-xs">
              送出一句今日鼓励，或者和好友聊聊今天的打卡心得吧～
            </p>
          </div>
        ) : (
          <>
            <div className="text-center">
              <span className="bg-surface-sunken text-tiny text-muted inline-block max-w-full truncate rounded-full px-3 py-1">
                仅展示纯文本与治愈表情 · 服务器零媒体落盘
              </span>
            </div>

            {/* 服务端返回的消息 */}
            {chronologicalMessages.map((m) => {
              const isMe = m.isMine ?? false
              return (
                <div
                  key={m.id}
                  data-testid={`chat-message-${m.id}`}
                  className={cn(
                    'flex w-full min-w-0 items-end gap-2',
                    isMe ? 'justify-end' : 'justify-start',
                  )}
                >
                  {!isMe && (
                    <Avatar
                      name={displayNickname}
                      avatar={displayAvatar}
                      size="sm"
                      className="shrink-0"
                    />
                  )}

                  {/* 我方消息：左侧外部状态机（已读 / 已送达 + 时间） */}
                  {isMe && (
                    <div className="text-subtle flex shrink-0 flex-col items-end gap-0.5 pb-0.5 text-[10px] leading-none">
                      {m.readAt ? (
                        <span
                          data-testid="chat-status-read"
                          className="text-primary-ink flex items-center gap-0.5 font-semibold"
                        >
                          <Icon name="check-double" size={12} />
                          <span>已读</span>
                        </span>
                      ) : (
                        <span
                          data-testid="chat-status-delivered"
                          className="text-muted flex items-center gap-0.5 font-semibold"
                        >
                          <Icon name="check" size={12} />
                          <span>已送达</span>
                        </span>
                      )}
                      <span className="font-mono">{formatTime(m.createdAt)}</span>
                    </div>
                  )}

                  {/* 消息气泡本体 */}
                  <div
                    className={cn(
                      'max-w-[75%] min-w-0 overflow-hidden rounded-2xl border px-3.5 py-2.5',
                      isMe
                        ? 'border-primary/20 bg-primary-soft text-foreground rounded-br-sm shadow-2xs'
                        : 'border-border/60 bg-surface shadow-soft text-foreground rounded-bl-sm',
                    )}
                  >
                    <p className="text-caption leading-relaxed [overflow-wrap:anywhere] break-words">
                      {m.content}
                    </p>
                  </div>

                  {/* 对方消息：右侧外部显示时间 */}
                  {!isMe && (
                    <span className="text-subtle shrink-0 pb-0.5 font-mono text-[10px] leading-none">
                      {formatTime(m.createdAt)}
                    </span>
                  )}
                </div>
              )
            })}

            {/* 本地乐观发送中的消息（左侧外部显示「发送中…」或「未送达·重试」） */}
            {localSending.map((m) => (
              <div key={m.tempId} className="flex w-full min-w-0 items-end justify-end gap-2">
                {m.status === 'sending' ? (
                  <div
                    data-testid="chat-status-sending"
                    className="text-muted flex shrink-0 flex-col items-end gap-0.5 pb-0.5 text-[10px] leading-none"
                  >
                    <span className="flex items-center gap-1 font-semibold">
                      <Icon name="clock" size={11} />
                      <span>发送中…</span>
                    </span>
                    <span className="font-mono">{formatTime(m.createdAt)}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    data-testid="chat-status-retry"
                    onClick={() => handleRetry(m)}
                    className="bg-danger-soft text-danger-ink text-tiny hover:bg-danger/20 mb-0.5 flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 font-semibold transition-colors"
                  >
                    <Icon name="alert" size={13} />
                    <span>未送达 · 重试</span>
                  </button>
                )}

                <div
                  className={cn(
                    'max-w-[75%] min-w-0 overflow-hidden rounded-2xl rounded-br-sm border px-3.5 py-2.5',
                    m.status === 'sending'
                      ? 'border-primary/15 bg-primary-soft/75 text-foreground'
                      : 'border-danger/50 bg-primary-soft/60 text-foreground',
                  )}
                >
                  <p className="text-caption leading-relaxed [overflow-wrap:anywhere] break-words">
                    {m.content}
                  </p>
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 5. 底部输入栏：已解除好友置灰禁用 vs 正常好友输入 */}
      {isFrozen ? (
        <div
          data-testid="chat-frozen-input-bar"
          className="border-border bg-surface-sunken text-caption text-muted flex shrink-0 items-center justify-center gap-2 border-t px-4 pt-3.5 pb-[calc(var(--safe-bottom)+0.875rem)] text-center font-semibold @3xl:pb-3.5"
        >
          <Icon name="user-x" size={16} />
          <span>已解除好友关系，无法发送新消息</span>
        </div>
      ) : (
        <div className="border-border bg-surface shrink-0 border-t px-3.5 pt-2.5 pb-[calc(var(--safe-bottom)+0.75rem)] @3xl:p-3">
          {/* 治愈快捷短语抽屉 */}
          {showPhrases && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {HEALING_PHRASES.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => {
                    setDraft(phrase)
                    setShowPhrases(false)
                  }}
                  className="bg-primary-soft text-primary-ink text-tiny hover:bg-primary/20 cursor-pointer rounded-full px-3 py-1 font-semibold transition-colors"
                >
                  {phrase}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleSend(draft)
            }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              aria-label="治愈快捷语与表情"
              title="治愈快捷语与表情"
              onClick={() => setShowPhrases((v) => !v)}
              className={cn(
                'ease-spring flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-all active:scale-95',
                showPhrases
                  ? 'border-primary/30 bg-primary-soft text-primary-ink'
                  : 'border-border bg-surface-sunken text-foreground hover:bg-primary-soft/60',
              )}
            >
              <Icon name="smile" size={22} />
            </button>

            <input
              type="text"
              data-testid="chat-input"
              value={draft}
              maxLength={300}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`给 ${displayNickname} 发一句鼓励吧（≤300字）…`}
              className="border-border bg-surface-sunken text-caption focus:border-primary h-10 min-w-0 flex-1 rounded-full border px-4 outline-none"
            />

            <Button
              type="submit"
              data-testid="chat-send-btn"
              size="sm"
              icon="send"
              disabled={draft.trim().length === 0 || sendMutation.isPending}
            >
              发送
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}
