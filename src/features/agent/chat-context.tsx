'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type ChatStatus, type FileUIPart, type UIMessage } from 'ai'
import { useAgentConversation, useInvalidateAgentTurn } from '@/lib/api/queries/agent'
import { useAgentUi, useAgentUiState } from './agent-store'

/*
 * Agent 对话状态：一次 useChat 实例由弹窗与全屏页共用（挂在应用外壳的 AgentHost 里）。
 * 会话切换时同步历史消息；传输层只发最后一条消息，服务端补全历史并落库。
 */

export interface SendOptions {
  deepThink: boolean
  /** 每次发送生成，重试时复用 */
  idempotencyKey: string
}

export interface AgentChat {
  messages: UIMessage[]
  status: ChatStatus
  error: Error | undefined
  isLoadingHistory: boolean
  send: (text: string, files: FileUIPart[] | undefined, options: SendOptions) => void
  stop: () => void
  retry: () => void
}

const AgentChatContext = createContext<AgentChat | null>(null)

export function useAgentChat(): AgentChat {
  const ctx = useContext(AgentChatContext)
  if (!ctx) throw new Error('useAgentChat 必须在 <AgentChatProvider> 内使用')
  return ctx
}

export function AgentChatProvider({
  conversationId,
  children,
}: {
  conversationId: string
  children: ReactNode
}) {
  const ui = useAgentUi()
  const { isSavedConversation, deepThink } = useAgentUiState()
  const invalidateAfterTurn = useInvalidateAgentTurn()

  const historyQuery = useAgentConversation(
    isSavedConversation && conversationId ? conversationId : null,
  )

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/v1/agent/chat',
        prepareSendMessagesRequest: ({ messages, id, body }) => {
          const extra = (body ?? {}) as { deepThink?: boolean; idempotencyKey?: string }
          return {
            body: {
              message: messages[messages.length - 1],
              id,
              deepThink: extra.deepThink ?? false,
              idempotencyKey: extra.idempotencyKey ?? crypto.randomUUID(),
            },
          }
        },
      }),
    [],
  )

  const syncedConvRef = useRef<string | null>(null)

  const { messages, setMessages, status, error, sendMessage, stop, regenerate, clearError } =
    useChat({
      id: conversationId || undefined,
      transport,
      onFinish: () => {
        if (conversationId) {
          syncedConvRef.current = conversationId
        }
        ui.markConversationSaved()
        invalidateAfterTurn(conversationId)
      },
    })

  // 切换到新对话或其它会话时重置同步游标
  useEffect(() => {
    if (!isSavedConversation) {
      syncedConvRef.current = null
    }
  }, [conversationId, isSavedConversation])

  // 历史会话加载完成后灌入 useChat
  useEffect(() => {
    if (!conversationId || !isSavedConversation || !historyQuery.data) return
    if (syncedConvRef.current === conversationId) return
    if (status === 'submitted' || status === 'streaming') return
    syncedConvRef.current = conversationId
    setMessages(historyQuery.data.messages as UIMessage[])
  }, [conversationId, isSavedConversation, historyQuery.data, setMessages, status])

  const send = useCallback<AgentChat['send']>(
    (text, files, options) => {
      clearError()
      void sendMessage(
        { text, files },
        { body: { deepThink: options.deepThink, idempotencyKey: options.idempotencyKey } },
      )
    },
    [clearError, sendMessage],
  )

  const retry = useCallback(() => {
    clearError()
    void regenerate({
      body: { deepThink, idempotencyKey: crypto.randomUUID() },
    })
  }, [clearError, deepThink, regenerate])

  const isLoadingHistory = Boolean(
    isSavedConversation && historyQuery.isPending && messages.length === 0,
  )

  const value = useMemo<AgentChat>(
    () => ({ messages, status, error, isLoadingHistory, send, stop, retry }),
    [messages, status, error, isLoadingHistory, send, stop, retry],
  )

  return <AgentChatContext.Provider value={value}>{children}</AgentChatContext.Provider>
}
