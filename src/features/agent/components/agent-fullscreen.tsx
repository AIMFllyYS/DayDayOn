'use client'

import { AppPage } from '@/components/layout/app-page'
import { useAgentChat } from '../chat-context'
import { AgentMessages } from './agent-messages'
import { Composer } from './composer'

/*
 * Agent 全屏页（/agent）：和弹窗共用同一个 useChat 状态。
 * - 顶栏：左侧箭头＋「返回」，顶部中间「团团 AI打卡搭子」（搭子为浅灰小字）。
 * - 布局贴合视口真实底部（fitViewport），消息区独立滚动，底部输入框真正居底。
 */

export function AgentFullscreen() {
  const { messages, status } = useAgentChat()
  return (
    <AppPage
      title={
        <span className="inline-flex items-baseline gap-1.5 font-bold">
          <span>团团</span>
          <span className="text-subtle text-caption font-normal">AI打卡搭子</span>
        </span>
      }
      backHref="/"
      showBackText
      fitViewport
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          <div className="mx-auto max-w-2xl">
            <AgentMessages messages={messages} status={status} />
          </div>
        </div>
        <div className="mx-auto w-full max-w-2xl px-0 pt-2 pb-[calc(var(--safe-bottom,0px)+0.75rem)] md:pb-4">
          <Composer variant="fullscreen" />
        </div>
      </div>
    </AppPage>
  )
}
