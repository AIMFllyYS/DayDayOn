'use client'

import { useSyncExternalStore } from 'react'

/*
 * Agent 悬浮团团 + 弹窗 + 全屏页共享的 UI 状态（不依赖 React context，跨路由保持）。
 * 会话切换由外层用 key 重挂 chat provider 完成，这里只存当前会话 id 和开关。
 */

export interface AgentUiState {
  panelOpen: boolean
  conversationId: string
  deepThink: boolean
}

export interface AgentUi {
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void
  newConversation: () => string
  setConversation: (id: string) => void
  setDeepThink: (on: boolean) => void
}

function freshConversationId(): string {
  return crypto.randomUUID()
}

let state: AgentUiState = {
  panelOpen: false,
  conversationId: freshConversationId(),
  deepThink: false,
}
const listeners = new Set<() => void>()
const SERVER_STATE: AgentUiState = { panelOpen: false, conversationId: '', deepThink: false }

function setState(next: AgentUiState) {
  if (
    next.panelOpen === state.panelOpen &&
    next.conversationId === state.conversationId &&
    next.deepThink === state.deepThink
  ) {
    return
  }
  state = next
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const ui: AgentUi = {
  openPanel: () => setState({ ...state, panelOpen: true }),
  closePanel: () => setState({ ...state, panelOpen: false }),
  togglePanel: () => setState({ ...state, panelOpen: !state.panelOpen }),
  newConversation: () => {
    const id = freshConversationId()
    setState({ ...state, conversationId: id, panelOpen: true })
    return id
  },
  setConversation: (id) => setState({ ...state, conversationId: id }),
  setDeepThink: (on) => setState({ ...state, deepThink: on }),
}

export function useAgentUi(): AgentUi {
  return ui
}

export function useAgentUiState(): AgentUiState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  )
}
