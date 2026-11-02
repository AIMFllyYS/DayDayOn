'use client'

import { Suspense, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useAgentUiState } from './agent-store'
import { AgentChatProvider } from './chat-context'
import { AgentPanel } from './components/agent-panel'
import { FloatingPet } from './components/floating-pet'

/*
 * Agent 应用外壳挂载点：挂在 SessionGate 里（登录 + 引导完成后才出现），
 * 包住页面 children，让 /agent 全屏页和弹窗共用同一个 useChat 实例（切换不断流）。
 */

export function AgentHost({ children }: { children: ReactNode }) {
  const { conversationId } = useAgentUiState()
  return (
    <AgentChatProvider conversationId={conversationId}>
      {children}
      <Suspense fallback={null}>
        <AgentFloatingLayer />
      </Suspense>
    </AgentChatProvider>
  )
}

function AgentFloatingLayer() {
  const pathname = usePathname()
  // 全屏页 / 我的页（已有一只互动团团）不显示悬浮团团
  const hidden = pathname === '/agent' || pathname.startsWith('/agent/') || pathname === '/me'
  if (hidden) return null
  return (
    <>
      <FloatingPet />
      <AgentPanel />
    </>
  )
}
