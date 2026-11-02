'use client'

import { AppPage } from '@/components/layout/app-page'
import { useAgentChat } from '../chat-context'
import { AgentMessages } from './agent-messages'
import { Composer } from './composer'

/*
 * Agent 全屏页（/agent）：和弹窗共用同一个 useChat 状态，只是换成整页布局。
 * 二级页面：顶栏带返回，隐藏底栏（AppShell 对非一级路径自动隐藏）。
 */

export function AgentFullscreen() {
  const { messages, status } = useAgentChat()
  return (
    <AppPage title="团团" eyebrow="AI 打卡搭子" backHref="/">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto py-4">
          <div className="mx-auto max-w-2xl">
            <AgentMessages messages={messages} status={status} />
          </div>
        </div>
        <div className="mx-auto w-full max-w-2xl pb-4">
          <Composer />
        </div>
      </div>
    </AppPage>
  )
}
