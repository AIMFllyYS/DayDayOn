import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AgentConversation, AgentConversationList, AgentDraft } from '@/features/agent/schemas'
import { apiFetch, newIdempotencyKey } from '../fetcher'
import { afterCheckinChange, keys } from '../keys'

/*
 * Agent 会话的读取与草稿确认（features/agent 使用）。
 * 草稿确认走普通创建接口（打卡 / 待办 / 体重），成功后失效对应查询。
 */

export function useAgentConversations() {
  return useQuery({
    queryKey: keys.agent.conversations(),
    queryFn: () => apiFetch<AgentConversationList>('/agent/conversations'),
  })
}

export function useRenameConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ conversationId, title }: { conversationId: string; title: string }) =>
      apiFetch<void>(`/agent/conversations/${encodeURIComponent(conversationId)}`, {
        method: 'PATCH',
        json: { title },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.agent.conversations() }),
  })
}

export function useDeleteConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (conversationId: string) =>
      apiFetch<void>(`/agent/conversations/${encodeURIComponent(conversationId)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.agent.conversations() }),
  })
}

export interface ConfirmDraftVariables {
  draft: AgentDraft
  idempotencyKey?: string
}

/** 确认一张草稿：按 kind 调普通创建接口，返回新记录 */
async function confirmDraft(vars: ConfirmDraftVariables): Promise<unknown> {
  const key = vars.idempotencyKey ?? newIdempotencyKey()
  const d = vars.draft
  if (d.kind === 'checkin') {
    return apiFetch(`/goals/${encodeURIComponent(d.goalId)}/checkins`, {
      method: 'POST',
      json: d.confirmBody,
      idempotencyKey: key,
    })
  }
  if (d.kind === 'todo') {
    return apiFetch('/todos', { method: 'POST', json: d.confirmBody, idempotencyKey: key })
  }
  return apiFetch('/metrics/weight', {
    method: 'PUT',
    json: d.confirmBody,
    idempotencyKey: key,
  })
}

export function useConfirmDraft() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: confirmDraft,
    onSettled: async () => {
      await Promise.all([
        ...afterCheckinChange.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
        queryClient.invalidateQueries({ queryKey: keys.todos.all }),
        queryClient.invalidateQueries({ queryKey: keys.metrics.all }),
      ])
    },
  })
}

export type { AgentConversation, AgentDraft }
