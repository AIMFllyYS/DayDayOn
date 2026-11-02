'use client'

import { forwardRef, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { MascotCharacter } from '@/components/mascot/mascot-svg'
import { Icon } from '@/components/ui/icon'
import { newIdempotencyKey } from '@/lib/api/fetcher'
import { useAgentConversations } from '@/lib/api/queries/agent'
import { useMe } from '@/lib/api/queries/me'
import { cn } from '@/lib/cn'
import { BUSINESS_TIME_ZONE } from '@/lib/time'
import { useAgentUi, useAgentUiState } from '../agent-store'
import { useAgentChat } from '../chat-context'
import { AgentMessages } from './agent-messages'
import { Composer } from './composer'
import { ConversationHistoryPopover } from './conversation-history-popover'

/*
 * Agent 弹窗：点击悬浮团团后弹出。
 * 手机：顶部留 1/4、左侧留 1/5；桌面：右下角卡片。
 * 顶部导航栏：左上角放大全屏按钮，右侧接标题「团团」，右侧为历史 / 新对话 / 关闭。
 * 历史对话使用 Popover 挂载到 Portal，z-[60] 顶层渲染，防止被容器截断。
 */

export function AgentPanel() {
  const { panelOpen, conversationId, deepThink } = useAgentUiState()
  const ui = useAgentUi()
  const router = useRouter()
  const { messages, status, error, isLoadingHistory, retry, send } = useAgentChat()
  const conversations = useAgentConversations()
  const { data: me } = useMe()
  const character: MascotCharacter = me?.preferences.mascot === 'dun' ? 'dun' : 'tuan'
  const petName = character === 'dun' ? '墩墩' : '团团'
  const timeZone = me?.profile.timeZone ?? BUSINESS_TIME_ZONE
  const panelRef = useRef<HTMLDivElement>(null)

  if (!panelOpen) return null

  const title = conversations.data?.items.find((c) => c.id === conversationId)?.title ?? petName

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`${petName}对话`}
      className={cn(
        'bg-surface shadow-float border-border animate-fade-up fixed z-50 flex flex-col overflow-hidden rounded-3xl border',
        // 手机：顶部留 1/4（25vh）、左侧留 1/5（20vw）；桌面：右下角卡片
        'top-[25vh] right-3 bottom-[calc(var(--safe-bottom,0px)+5.25rem)] left-[20vw]',
        'md:top-auto md:right-6 md:bottom-6 md:left-auto md:h-[min(74vh,700px)] md:w-[min(26rem,92vw)]',
      )}
    >
      {/* 顶部小导航栏：左上角为放大按钮，紧随标题 */}
      <header className="border-border flex items-center gap-1 border-b px-2 py-1.5">
        <NavButton
          label="全屏放大"
          onClick={() => {
            ui.closePanel()
            router.push('/agent')
          }}
        >
          <Icon name="maximize" size={15} lineOnly />
        </NavButton>

        <span className="text-caption text-foreground min-w-0 flex-1 truncate px-1 font-semibold">
          {title}
        </span>

        <ConversationHistoryPopover
          timeZone={timeZone}
          openPanelOnReset={true}
          renderTrigger={(open) => (
            <NavButton label="历史对话" active={open}>
              <Icon name="clock" size={15} lineOnly />
            </NavButton>
          )}
        />

        <NavButton label="新对话" onClick={() => ui.newConversation({ openPanel: true })}>
          <Icon name="plus" size={15} lineOnly />
        </NavButton>
        <NavButton label="关闭" onClick={() => ui.closePanel()}>
          <Icon name="x" size={15} lineOnly />
        </NavButton>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* 消息滚动区：全高贯穿到底部，底部留出浮动输入框的高度的安全 padding，允许向上滑动穿透 */}
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pt-3 pb-24">
          <AgentMessages
            messages={messages}
            status={status}
            error={error}
            isLoadingHistory={isLoadingHistory}
            onRetry={retry}
            character={character}
            onQuickPrompt={(text) =>
              send(text, undefined, { deepThink, idempotencyKey: newIdempotencyKey() })
            }
          />
        </div>

        {/* 底部悬浮输入层：无任何独立实色背景，浮动挂载，消息向上滑时可从背后穿透滑过 */}
        <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-10 p-2.5 pb-[calc(var(--safe-bottom,0px)+0.5rem)]">
          <Composer variant="panel" />
        </div>
      </div>
    </div>
  )
}

interface NavButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  active?: boolean
  children: React.ReactNode
}

const NavButton = forwardRef<HTMLButtonElement, NavButtonProps>(function NavButton(
  { label, onClick, active, children, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'text-muted hover:bg-surface-sunken hover:text-foreground flex size-8 items-center justify-center rounded-full transition-colors',
        active && 'bg-surface-sunken text-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
})
