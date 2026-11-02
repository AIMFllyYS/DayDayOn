'use client'

import { AppPage } from '@/components/layout/app-page'
import type { MascotCharacter } from '@/components/mascot/mascot-svg'
import { IconButton } from '@/components/ui/button'
import { newIdempotencyKey } from '@/lib/api/fetcher'
import { useMe } from '@/lib/api/queries/me'
import { BUSINESS_TIME_ZONE } from '@/lib/time'
import { useAgentUi, useAgentUiState } from '../agent-store'
import { useAgentChat } from '../chat-context'
import { AgentMessages } from './agent-messages'
import { Composer } from './composer'
import { ConversationHistoryPopover } from './conversation-history-popover'

/*
 * Agent 全屏页（/agent）：和弹窗共用同一个 useChat 状态。
 * - 顶栏：左侧箭头＋「返回」，顶部中间「团团 AI打卡搭子」，右侧「历史对话」与「新对话」。
 * - 布局贴合视口真实底部（fitViewport），消息区独立滚动，底部输入框真正居底。
 */

export function AgentFullscreen() {
  const { messages, status, error, isLoadingHistory, retry, send } = useAgentChat()
  const { deepThink } = useAgentUiState()
  const ui = useAgentUi()
  const { data: me } = useMe()
  const character: MascotCharacter = me?.preferences.mascot === 'dun' ? 'dun' : 'tuan'
  const petName = character === 'dun' ? '墩墩' : '团团'
  const timeZone = me?.profile.timeZone ?? BUSINESS_TIME_ZONE

  return (
    <AppPage
      title={
        <span className="inline-flex items-baseline gap-1.5 font-bold">
          <span>{petName}</span>
          <span className="text-subtle text-caption font-normal">AI打卡搭子</span>
        </span>
      }
      backHref="/"
      showBackText
      fitViewport
      actions={
        <div className="flex items-center gap-1">
          <ConversationHistoryPopover
            timeZone={timeZone}
            openPanelOnReset={false}
            renderTrigger={(open) => (
              <IconButton
                icon="clock"
                label="历史对话"
                size="sm"
                variant={open ? 'soft' : 'ghost'}
              />
            )}
          />
          <IconButton
            icon="plus"
            label="新对话"
            size="sm"
            variant="ghost"
            onClick={() => ui.newConversation({ openPanel: false })}
          />
        </div>
      }
    >
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* 消息滚动区：全高贯穿到底部，底部留出浮动输入框的高度的安全 padding，允许向上滑动穿透 */}
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-0 pt-2 pb-[calc(var(--safe-bottom,0px)+6.5rem)] md:pb-28">
          <div className="mx-auto max-w-2xl">
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
        </div>

        {/* 底部悬浮输入层：无任何独立实色背景，浮动挂载，消息向上滑时可从背后穿透滑过 */}
        <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-10 mx-auto w-full max-w-2xl px-0 pb-[calc(var(--safe-bottom,0px)+0.75rem)] md:pb-4">
          <Composer variant="fullscreen" />
        </div>
      </div>
    </AppPage>
  )
}
