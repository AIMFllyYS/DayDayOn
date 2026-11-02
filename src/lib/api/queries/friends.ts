'use client'

import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  FriendAcceptResult,
  FriendDashboard,
  FriendInvite,
  FriendInvitePreview,
  FriendList,
} from '@/features/friend/schemas'
import { apiFetch } from '../fetcher'
import { keys } from '../keys'

/*
 * 好友体系的客户端查询与写操作（ADR-0026）：
 * - friendsListQuery / useFriendsList：顶栏堆叠头像与好友切换面板数据源
 * - friendDashboardQuery / useFriendDashboard：查看指定好友完整今日打卡仪表盘
 * - useCreateFriendInvite：获取或生成 10 分钟有效的 6 位配对码
 * - usePreviewFriendInvite：输入 6 位码后预览邀请方头像与昵称（用于屏幕中央二次确认弹窗）
 * - useAcceptFriendInvite：确认接受好友邀请并失效好友列表缓存
 */

export const friendsListQuery = () =>
  queryOptions({
    queryKey: keys.friends.list(),
    queryFn: () => apiFetch<FriendList>('/friends'),
  })

export function useFriendsList() {
  return useQuery(friendsListQuery())
}

export const friendDashboardQuery = (friendUserId: string) =>
  queryOptions({
    queryKey: keys.friends.dashboard(friendUserId),
    queryFn: () =>
      apiFetch<FriendDashboard>(`/friends/${encodeURIComponent(friendUserId)}/dashboard`),
  })

export function useFriendDashboard(friendUserId: string | null) {
  return useQuery({
    ...friendDashboardQuery(friendUserId ?? ''),
    enabled: Boolean(friendUserId),
  })
}

export function useCreateFriendInvite() {
  return useMutation({
    mutationFn: () => apiFetch<FriendInvite>('/friends/invite', { method: 'POST', json: {} }),
  })
}

export function usePreviewFriendInvite() {
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<FriendInvitePreview>('/friends/invite/preview', {
        method: 'POST',
        json: { code },
      }),
  })
}

export function useAcceptFriendInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<FriendAcceptResult>('/friends/accept', {
        method: 'POST',
        json: { code },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.friends.all })
    },
  })
}
