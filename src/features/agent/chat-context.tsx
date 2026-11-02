'use client'

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type ChatStatus, type FileUIPart, type UIMessage } from 'ai'

/*
 * Agent 对话状态：一次 useChat 实例由弹窗与全屏页共用（挂在应用外壳的 AgentHost 里）。
 * 会话切换时外层用 key 重挂 provider；传输层只发最后一条消息，服务端补全历史并落库。
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
  send: (text: string, files: FileUIPart[] | undefined, options: SendOptions) => void
  stop: () => void
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
              idempotencyKey: extra.idempotencyKey,
            },
          }
        },
      }),
    [],
  )

  const { messages, status, error, sendMessage, stop } = useChat({
    id: conversationId,
    transport,
  })

  const send = useCallback<AgentChat['send']>(
    (text, files, options) => {
      sendMessage(
        { text, files },
        { body: { deepThink: options.deepThink, idempotencyKey: options.idempotencyKey } },
      )
    },
    [sendMessage],
  )

  const value = useMemo<AgentChat>(
    () => ({ messages, status, error, send, stop }),
    [messages, status, error, send, stop],
  )

  return <AgentChatContext.Provider value={value}>{children}</AgentChatContext.Provider>
}
