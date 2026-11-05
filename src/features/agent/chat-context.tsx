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
 * Agent 对话状态：一次 useChat 实例由弹窗、全屏页和打卡页的「让 Agent 分析」共用（挂在应用外壳的 AgentHost 里）。
 * 会话切换时同步历史消息；传输层只发最后一条消息，服务端补全历史并落库。
 * startReferee：先开一个新会话，再把这条打卡交给裁判接口（同一个传输层换 api），
 * 分析过程就是这个会话的第一轮，历史里能找到，点悬浮宠物打开的也是它。
 */

export interface SendOptions {
  deepThink: boolean
  /** 每次发送生成，重试时复用 */
  idempotencyKey: string
}

export interface RefereeRequest {
  goalId: string
  /** 创建打卡的请求体 */
  checkin: unknown
  /** 会话里用户那句话 */
  text: string
  idempotencyKey: string
}

export interface AgentChat {
  /** 当前会话 id（与 agent-store 一致） */
  conversationId: string
  messages: UIMessage[]
  status: ChatStatus
  error: Error | undefined
  isLoadingHistory: boolean
  send: (text: string, files: FileUIPart[] | undefined, options: SendOptions) => void
  stop: () => void
  retry: () => void
  /** 新开一个会话并在里面跑打卡分析，返回会话 id */
  startReferee: (req: RefereeRequest) => string
}

interface ExtraBody {
  deepThink?: boolean
  idempotencyKey?: string
  referee?: { goalId: string; checkin: unknown }
}

function textOf(message: UIMessage | undefined): string {
  if (!message) return ''
  return message.parts
    .flatMap((p) => (p.type === 'text' ? [p.text] : []))
    .join('\n')
    .slice(0, 500)
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
          const extra = (body ?? {}) as ExtraBody
          const last = messages[messages.length - 1]
          if (extra.referee) {
            return {
              api: `/api/v1/goals/${encodeURIComponent(extra.referee.goalId)}/referee`,
              body: {
                checkin: extra.referee.checkin,
                idempotencyKey: extra.idempotencyKey ?? crypto.randomUUID(),
                conversation: {
                  id,
                  messageId: last?.id ?? crypto.randomUUID(),
                  text: textOf(last),
                },
              },
            }
          }
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
  // startReferee 先切到新会话，等 useChat 换成新会话的实例后再发（下面的 effect）
  const pendingRef = useRef<{ id: string; text: string; body: ExtraBody } | null>(null)

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

  const startReferee = useCallback<AgentChat['startReferee']>(
    (req) => {
      clearError()
      const id = ui.newConversation({ openPanel: false })
      pendingRef.current = {
        id,
        text: req.text,
        body: {
          referee: { goalId: req.goalId, checkin: req.checkin },
          idempotencyKey: req.idempotencyKey,
        },
      }
      return id
    },
    [clearError, ui],
  )

  useEffect(() => {
    const pending = pendingRef.current
    if (!pending || pending.id !== conversationId) return
    pendingRef.current = null
    void sendMessage({ text: pending.text }, { body: pending.body })
  }, [conversationId, sendMessage])

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
    () => ({
      conversationId,
      messages,
      status,
      error,
      isLoadingHistory,
      send,
      stop,
      retry,
      startReferee,
    }),
    [conversationId, messages, status, error, isLoadingHistory, send, stop, retry, startReferee],
  )

  return <AgentChatContext.Provider value={value}>{children}</AgentChatContext.Provider>
}
