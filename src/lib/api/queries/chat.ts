'use client'

import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ChatHistoryQuery,
  ChatHistoryResponse,
  ChatThreadsResponse,
  MarkChatReadResponse,
  SendChatMessageInput,
  SendChatMessageResponse,
} from '@/features/chat/schemas'
import { apiFetch } from '../fetcher'
import { keys } from '../keys'

/*
 * 1v1 好友私聊客户端查询与发送操作（Issue #25 · #26 · M6）
 */

export const chatThreadsQuery = () => {
  return queryOptions({
    queryKey: keys.chat.threads(),
    queryFn: () => apiFetch<ChatThreadsResponse>('/chats'),
  })
}

export function useChatThreads() {
  return useQuery({
    ...chatThreadsQuery(),
    refetchInterval: 8000,
  })
}

export const chatHistoryQuery = (friendUserId: string, options?: Partial<ChatHistoryQuery>) => {
  const params = new URLSearchParams()
  if (options?.cursor) params.set('cursor', options.cursor)
  if (options?.limit) params.set('limit', String(options.limit))
  const qs = params.toString() ? `?${params.toString()}` : ''

  return queryOptions({
    queryKey: [...keys.chat.history(friendUserId), options],
    queryFn: () => apiFetch<ChatHistoryResponse>(`/chats/${encodeURIComponent(friendUserId)}${qs}`),
  })
}

export function useChatMessages({
  friendUserId,
  cursor,
  limit,
  enabled = true,
}: {
  friendUserId: string | null
  cursor?: string
  limit?: number
  enabled?: boolean
}) {
  return useQuery({
    ...chatHistoryQuery(friendUserId ?? '', { cursor, limit }),
    enabled: Boolean(friendUserId) && enabled,
    refetchInterval: 5000, // 5秒轻量轮询新消息
  })
}

export function useSendChatMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ friendUserId, input }: { friendUserId: string; input: SendChatMessageInput }) =>
      apiFetch<SendChatMessageResponse>(`/chats/${encodeURIComponent(friendUserId)}`, {
        method: 'POST',
        json: input,
      }),
    onSuccess: (_data, variables) => {
      // 成功后失效私聊历史与会话列表缓存
      void queryClient.invalidateQueries({
        queryKey: keys.chat.history(variables.friendUserId),
      })
      void queryClient.invalidateQueries({
        queryKey: keys.chat.threads(),
      })
    },
  })
}

export function useMarkChatRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (friendUserId: string) =>
      apiFetch<MarkChatReadResponse>(`/chats/${encodeURIComponent(friendUserId)}/read`, {
        method: 'POST',
      }),
    onSuccess: (_data, friendUserId) => {
      void queryClient.invalidateQueries({
        queryKey: keys.chat.history(friendUserId),
      })
      void queryClient.invalidateQueries({
        queryKey: keys.chat.threads(),
      })
    },
  })
}
