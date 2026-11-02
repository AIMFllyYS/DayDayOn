'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { useAgentConversations } from '@/lib/api/queries/agent'
import { useAgentUi, useAgentUiState } from '../agent-store'
import { useAgentChat } from '../chat-context'
import { AgentMessages } from './agent-messages'
import { Composer } from './composer'

/*
 * Agent 弹窗：点击悬浮团团后，从团团所在角落弹出。
 * 手机：顶部留 1/3、左侧留 1/4；桌面：右下角卡片。顶部小导航栏：历史 / 新对话 / 全屏 / 关闭。
 */

export function AgentPanel() {
  const { panelOpen, conversationId } = useAgentUiState()
  const ui = useAgentUi()
  const router = useRouter()
  const { messages, status } = useAgentChat()
  const [historyOpen, setHistoryOpen] = useState(false)
  const conversations = useAgentConversations()
  const panelRef = useRef<HTMLDivElement>(null)

  if (!panelOpen) return null

  const title =
    conversations.data?.items.find((c) => c.id === conversationId)?.title ?? '和团团聊聊'

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="团团对话"
      className={cn(
        'bg-surface shadow-float border-border animate-fade-up fixed z-50 flex flex-col overflow-hidden rounded-3xl border',
        // 手机：顶部留 1/3、左侧留 1/4；桌面：右下角卡片
        'top-[33vh] right-3 bottom-[calc(var(--safe-bottom,0px)+6rem)] left-[24vw]',
        'md:top-auto md:right-6 md:bottom-6 md:left-auto md:h-[min(72vh,680px)] md:w-[min(26rem,92vw)]',
      )}
    >
      {/* 顶部小导航栏 */}
      <header className="border-border flex items-center gap-1 border-b px-2 py-1.5">
        <span className="text-caption text-muted min-w-0 flex-1 truncate px-1.5">{title}</span>

        <div className="relative">
          <NavButton
            label="历史对话"
            onClick={() => setHistoryOpen((v) => !v)}
            active={historyOpen}
          >
            <Icon name="clock" size={15} lineOnly />
          </NavButton>
          {historyOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setHistoryOpen(false)} />
              <div className="bg-surface shadow-float border-border absolute top-full right-0 z-20 mt-1 max-h-72 w-64 overflow-auto rounded-2xl border p-1.5">
                {conversations.data?.items.length === 0 && (
                  <p className="text-caption text-subtle px-2 py-3 text-center">还没有对话</p>
                )}
                {conversations.data?.items.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      ui.setConversation(c.id)
                      setHistoryOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left',
                      c.id === conversationId ? 'bg-primary-soft' : 'hover:bg-surface-sunken',
                    )}
                  >
                    <span className="text-caption min-w-0 flex-1 truncate">{c.title}</span>
                    <span className="text-tiny text-subtle shrink-0">
                      {new Date(c.lastMessageAt).toLocaleDateString('zh-CN', {
                        month: 'numeric',
                        day: 'numeric',
                      })}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <NavButton label="新对话" onClick={() => ui.newConversation()}>
          <Icon name="plus" size={15} lineOnly />
        </NavButton>
        <NavButton label="全屏" onClick={() => router.push('/agent')}>
          <Icon name="menu" size={15} lineOnly />
        </NavButton>
        <NavButton label="关闭" onClick={() => ui.closePanel()}>
          <Icon name="x" size={15} lineOnly />
        </NavButton>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <AgentMessages messages={messages} status={status} />
      </div>

      <div className="border-border border-t p-2.5">
        <Composer />
      </div>
    </div>
  )
}

function NavButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string
  onClick: () => void
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'text-muted hover:bg-surface-sunken hover:text-foreground flex size-8 items-center justify-center rounded-full transition-colors',
        active && 'bg-surface-sunken text-foreground',
      )}
    >
      {children}
    </button>
  )
}
