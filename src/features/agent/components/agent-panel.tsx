'use client'

import { forwardRef, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { Popover } from '@/components/ui/popover'
import { cn } from '@/lib/cn'
import { useAgentConversations } from '@/lib/api/queries/agent'
import { useAgentUi, useAgentUiState } from '../agent-store'
import { useAgentChat } from '../chat-context'
import { AgentMessages } from './agent-messages'
import { Composer } from './composer'

/*
 * Agent 弹窗：点击悬浮团团后弹出。
 * 手机：顶部留 1/4、左侧留 1/5；桌面：右下角卡片。
 * 顶部导航栏：左上角放大全屏按钮，右侧接标题「团团」，右侧为历史 / 新对话 / 关闭。
 * 历史对话使用 Popover 挂载到 Portal，z-[60] 顶层渲染，防止被容器截断。
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

  const title = conversations.data?.items.find((c) => c.id === conversationId)?.title ?? '团团'

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="团团对话"
      className={cn(
        'bg-surface shadow-float border-border animate-fade-up fixed z-50 flex flex-col overflow-hidden rounded-3xl border',
        // 手机：顶部留 1/4（25vh）、左侧留 1/5（20vw）；桌面：右下角卡片
        'top-[25vh] right-3 bottom-[calc(var(--safe-bottom,0px)+5.25rem)] left-[20vw]',
        'md:top-auto md:right-6 md:bottom-6 md:left-auto md:h-[min(74vh,700px)] md:w-[min(26rem,92vw)]',
      )}
    >
      {/* 顶部小导航栏：左上角为放大按钮，紧随标题「团团」 */}
      <header className="border-border flex items-center gap-1 border-b px-2 py-1.5">
        <NavButton label="全屏放大" onClick={() => router.push('/agent')}>
          <Icon name="maximize" size={15} lineOnly />
        </NavButton>

        <span className="text-caption text-foreground min-w-0 flex-1 truncate px-1 font-semibold">
          {title}
        </span>

        <Popover
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          side="bottom"
          align="end"
          sideOffset={6}
          positionerClassName="z-[60]"
          clean
          className="shadow-float max-h-72 w-64 max-w-[calc(100vw-1.5rem)] overflow-y-auto"
          trigger={
            <NavButton label="历史对话" active={historyOpen}>
              <Icon name="clock" size={15} lineOnly />
            </NavButton>
          }
        >
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
                'flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors',
                c.id === conversationId
                  ? 'bg-primary-soft text-foreground'
                  : 'text-muted hover:bg-surface-sunken hover:text-foreground',
              )}
            >
              <span className="text-caption min-w-0 flex-1 truncate font-medium">{c.title}</span>
              <span className="text-tiny text-subtle shrink-0">
                {new Date(c.lastMessageAt).toLocaleDateString('zh-CN', {
                  month: 'numeric',
                  day: 'numeric',
                })}
              </span>
            </button>
          ))}
        </Popover>

        <NavButton label="新对话" onClick={() => ui.newConversation()}>
          <Icon name="plus" size={15} lineOnly />
        </NavButton>
        <NavButton label="关闭" onClick={() => ui.closePanel()}>
          <Icon name="x" size={15} lineOnly />
        </NavButton>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <AgentMessages messages={messages} status={status} />
      </div>

      {/* 底部输入框与消息区之间无分隔线 */}
      <div className="p-2.5 pt-1">
        <Composer variant="panel" />
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
