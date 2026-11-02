'use client'

import { Suspense, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useFriendStore } from '@/features/friend/friend-store'
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

/**
 * 判断右下角悬浮 AI 伴宠是否隐藏（Decision #1 & 界面守则：一屏不放两只互动宠物）：
 * 1. /agent 全屏页或其子路由：隐藏
 * 2. /me 我的页（已有一只互动团团）：隐藏
 * 3. viewingFriendId !== null 正在串门好友空间（已有好友宠物舞台）：隐藏
 * 4. 切回「我」（viewingFriendId === null）：恢复显示
 */
export function isFloatingPetHidden(pathname: string, viewingFriendId: string | null): boolean {
  return (
    pathname === '/agent' ||
    pathname.startsWith('/agent/') ||
    pathname === '/me' ||
    viewingFriendId !== null
  )
}

export function AgentFloatingLayer() {
  const pathname = usePathname()
  const { viewingFriendId } = useFriendStore()
  // 全屏页 / 我的页 / 正在串门好友空间时隐藏右下角悬浮团团（Decision #1）
  const hidden = isFloatingPetHidden(pathname, viewingFriendId)
  if (hidden) return null
  return (
    <>
      <FloatingPet />
      <AgentPanel />
    </>
  )
}
