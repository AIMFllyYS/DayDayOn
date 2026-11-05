import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AgentConversation,
  AgentConversationDetail,
  AgentConversationList,
  AgentDraft,
} from '@/features/agent/schemas'
import { apiFetch, newIdempotencyKey } from '../fetcher'
import { afterCheckinChange, keys } from '../keys'

/*
 * Agent 会话的读取与草稿确认（features/agent 使用）。
 * 草稿确认走普通接口（打卡新增 / 修改 / 删除、待办、体重），成功后失效对应查询。
 */

export function useAgentConversations() {
  return useQuery({
    queryKey: keys.agent.conversations(),
    queryFn: () => apiFetch<AgentConversationList>('/agent/conversations'),
  })
}

export function useAgentConversation(conversationId: string | null) {
  return useQuery({
    queryKey: keys.agent.conversation(conversationId ?? ''),
    queryFn: () =>
      apiFetch<AgentConversationDetail>(
        `/agent/conversations/${encodeURIComponent(conversationId ?? '')}`,
      ),
    enabled: Boolean(conversationId),
  })
}

/** 一轮对话流式结束后的缓存刷新（会话列表、当前会话详情、个人 AI 额度） */
export function useInvalidateAgentTurn() {
  const queryClient = useQueryClient()
  return useCallback(
    (conversationId?: string) => {
      if (conversationId) {
        void queryClient.invalidateQueries({
          queryKey: keys.agent.conversation(conversationId),
        })
      }
      void queryClient.invalidateQueries({ queryKey: keys.agent.conversations() })
      void queryClient.invalidateQueries({ queryKey: keys.me.quota() })
    },
    [queryClient],
  )
}

export function useRenameConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ conversationId, title }: { conversationId: string; title: string }) =>
      apiFetch<void>(`/agent/conversations/${encodeURIComponent(conversationId)}`, {
        method: 'PATCH',
        json: { title },
      }),
    onSuccess: (_data, { conversationId }) => {
      void queryClient.invalidateQueries({ queryKey: keys.agent.conversations() })
      void queryClient.invalidateQueries({ queryKey: keys.agent.conversation(conversationId) })
    },
  })
}

export function useDeleteConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (conversationId: string) =>
      apiFetch<void>(`/agent/conversations/${encodeURIComponent(conversationId)}`, {
        method: 'DELETE',
      }),
    onSuccess: (_data, conversationId) => {
      queryClient.removeQueries({ queryKey: keys.agent.conversation(conversationId) })
      void queryClient.invalidateQueries({ queryKey: keys.agent.conversations() })
    },
  })
}

export interface ConfirmDraftVariables {
  draft: AgentDraft
  idempotencyKey?: string
}

/** 确认一张草稿：按 kind 调普通接口（新增 / 修改 / 删除打卡、待办、体重），返回新记录 */
async function confirmDraft(vars: ConfirmDraftVariables): Promise<unknown> {
  const key = vars.idempotencyKey ?? newIdempotencyKey()
  const d = vars.draft
  switch (d.kind) {
    case 'checkin':
      return apiFetch(`/goals/${encodeURIComponent(d.goalId)}/checkins`, {
        method: 'POST',
        json: d.confirmBody,
        idempotencyKey: key,
      })
    case 'checkin-update':
      return apiFetch(`/checkins/${encodeURIComponent(d.checkinId)}`, {
        method: 'PATCH',
        json: d.confirmBody,
      })
    case 'checkin-delete': {
      const query = new URLSearchParams({ origin: 'agent', reason: d.reason })
      return apiFetch(`/checkins/${encodeURIComponent(d.checkinId)}?${query.toString()}`, {
        method: 'DELETE',
      })
    }
    case 'todo':
      return apiFetch('/todos', { method: 'POST', json: d.confirmBody, idempotencyKey: key })
    case 'weight':
      return apiFetch('/metrics/weight', {
        method: 'PUT',
        json: d.confirmBody,
        idempotencyKey: key,
      })
  }
}

export function useConfirmDraft() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: confirmDraft,
    onSettled: async () => {
      await Promise.all([
        ...afterCheckinChange.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
        queryClient.invalidateQueries({ queryKey: keys.goals.all }),
        queryClient.invalidateQueries({ queryKey: keys.todos.all }),
        queryClient.invalidateQueries({ queryKey: keys.metrics.all }),
      ])
    },
  })
}

export type { AgentConversation, AgentDraft }
