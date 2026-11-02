'use client'

import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  MarkNotificationReadInput,
  MarkNotificationReadResponse,
  NotificationListQuery,
  NotificationListResponse,
  NotificationSummary,
} from '@/features/notification/schemas'
import { apiFetch } from '../fetcher'
import { keys } from '../keys'

/*
 * 通知与消息中心的客户端查询与变更（Issue #20 · Decision #4）：
 * - notificationSummaryQuery / useNotificationSummary：顶栏铃铛红点与未读数
 * - notificationsListQuery / useNotificationsList：两级消息中心详情流
 * - useMarkNotificationsRead：一键全部已读 / 单频道已读
 */

export const notificationSummaryQuery = () =>
  queryOptions({
    queryKey: keys.notifications.summary(),
    queryFn: () => apiFetch<NotificationSummary>('/notifications/summary'),
  })

export function useNotificationSummary(options?: { enabled?: boolean }) {
  return useQuery({
    ...notificationSummaryQuery(),
    enabled: options?.enabled,
  })
}

export const notificationsListQuery = (params?: Partial<NotificationListQuery>) => {
  const searchParams = new URLSearchParams()
  if (params?.channel) searchParams.set('channel', params.channel)
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.cursor) searchParams.set('cursor', params.cursor)
  if (params?.unreadOnly !== undefined) searchParams.set('unreadOnly', String(params.unreadOnly))

  const qs = searchParams.toString()
  const path = qs ? `/notifications?${qs}` : '/notifications'

  return queryOptions({
    queryKey: keys.notifications.list(params),
    queryFn: () => apiFetch<NotificationListResponse>(path),
  })
}

export function useNotificationsList(
  params?: Partial<NotificationListQuery>,
  options?: { enabled?: boolean },
) {
  return useQuery({
    ...notificationsListQuery(params),
    enabled: options?.enabled,
  })
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: MarkNotificationReadInput) =>
      apiFetch<MarkNotificationReadResponse>('/notifications/read', {
        method: 'POST',
        json: input,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.notifications.all })
    },
  })
}
