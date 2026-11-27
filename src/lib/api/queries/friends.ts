'use client'

import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { CheckinCalendar, CheckinHistory } from '@/features/checkin/schemas'
import { friendActions } from '@/features/friend/friend-store'
import type {
  FriendAcceptResult,
  FriendDashboard,
  FriendGoalDetail,
  FriendInvite,
  FriendInvitePreview,
  FriendList,
  FriendMetricDetail,
  PetInteractInput,
  PetInteractResult,
  PetInteractionsStatus,
} from '@/features/friend/schemas'
import type { Insights } from '@/features/insights/schemas'
import type { MetricCalendar, MetricHistory, MetricKind } from '@/features/metric/schemas'
import { apiFetch, newIdempotencyKey } from '../fetcher'
import { keys } from '../keys'

/*
 * 好友体系的客户端查询与写操作（ADR-0026）：
 * - friendsListQuery / useFriendsList：顶栏堆叠头像与好友切换面板数据源
 * - friendDashboardQuery / useFriendDashboard：查看指定好友完整今日打卡仪表盘
 * - friendMetricDetailQuery / Calendar / History：查看指定好友体重/心情/步数只读详情
 * - useCreateFriendInvite：获取或生成 10 分钟有效的 6 位配对码
 * - usePreviewFriendInvite：输入 6 位码后预览邀请方头像与昵称（用于屏幕中央二次确认弹窗）
 * - useAcceptFriendInvite：确认接受好友邀请并失效好友列表缓存
 */

export const friendsListQuery = () =>
  queryOptions({
    queryKey: keys.friends.list(),
    queryFn: () => apiFetch<FriendList>('/friends'),
  })

export function useFriendsList(options?: { enabled?: boolean }) {
  return useQuery({
    ...friendsListQuery(),
    enabled: options?.enabled,
  })
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

export const friendInsightsQuery = (friendUserId: string, days: 7 | 30 = 7, goalId?: string) =>
  queryOptions({
    queryKey: keys.friends.insights(friendUserId, days, goalId),
    queryFn: () => {
      const qs = new URLSearchParams({ days: String(days) })
      if (goalId) qs.set('goalId', goalId)
      return apiFetch<Insights>(
        `/friends/${encodeURIComponent(friendUserId)}/insights?${qs.toString()}`,
      )
    },
  })

export function useFriendInsights(friendUserId: string | null, days: 7 | 30 = 7, goalId?: string) {
  return useQuery({
    ...friendInsightsQuery(friendUserId ?? '', days, goalId),
    enabled: Boolean(friendUserId),
  })
}

export const friendGoalDetailQuery = (friendUserId: string, goalId: string) =>
  queryOptions({
    queryKey: keys.friends.goalDetail(friendUserId, goalId),
    queryFn: () =>
      apiFetch<FriendGoalDetail>(
        `/friends/${encodeURIComponent(friendUserId)}/goals/${encodeURIComponent(goalId)}`,
      ),
  })

export const friendGoalCalendarQuery = (friendUserId: string, goalId: string, month: string) =>
  queryOptions({
    queryKey: keys.friends.goalCalendar(friendUserId, goalId, month),
    queryFn: () =>
      apiFetch<CheckinCalendar>(
        `/friends/${encodeURIComponent(friendUserId)}/goals/${encodeURIComponent(goalId)}/calendar?month=${encodeURIComponent(month)}`,
      ),
  })

export const friendGoalCheckinsQuery = (
  friendUserId: string,
  goalId: string,
  range: { from?: string; to?: string } = {},
) =>
  infiniteQueryOptions({
    queryKey: keys.friends.goalCheckins(friendUserId, goalId, range),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams()
      if (pageParam) params.set('cursor', pageParam)
      if (range.from) params.set('from', range.from)
      if (range.to) params.set('to', range.to)
      const qs = params.toString()
      return apiFetch<CheckinHistory>(
        `/friends/${encodeURIComponent(friendUserId)}/goals/${encodeURIComponent(goalId)}/checkins${qs ? `?${qs}` : ''}`,
      )
    },
    getNextPageParam: (last) => last.nextCursor,
  })

export const friendMetricDetailQuery = (friendUserId: string, kind: MetricKind) =>
  queryOptions({
    queryKey: keys.friends.metricDetail(friendUserId, kind),
    queryFn: () =>
      apiFetch<FriendMetricDetail>(
        `/friends/${encodeURIComponent(friendUserId)}/metrics/${encodeURIComponent(kind)}`,
      ),
  })

export const friendMetricCalendarQuery = (friendUserId: string, kind: MetricKind, month: string) =>
  queryOptions({
    queryKey: keys.friends.metricCalendar(friendUserId, kind, month),
    queryFn: () =>
      apiFetch<MetricCalendar>(
        `/friends/${encodeURIComponent(friendUserId)}/metrics/${encodeURIComponent(kind)}/calendar?month=${encodeURIComponent(month)}`,
      ),
  })

export const friendMetricHistoryQuery = (friendUserId: string, kind: MetricKind, limit = 30) =>
  infiniteQueryOptions({
    queryKey: keys.friends.metricHistory(friendUserId, kind),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({ limit: String(limit) })
      if (pageParam) qs.set('cursor', pageParam)
      return apiFetch<MetricHistory>(
        `/friends/${encodeURIComponent(friendUserId)}/metrics/${encodeURIComponent(kind)}/history?${qs.toString()}`,
      )
    },
    getNextPageParam: (last) => last.nextCursor,
  })

export function useCreateFriendInvite() {
  return useMutation({
    mutationFn: (idempotencyKey?: string) =>
      apiFetch<FriendInvite>('/friends/invite', {
        method: 'POST',
        json: {},
        idempotencyKey: idempotencyKey ?? newIdempotencyKey(),
      }),
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
    mutationFn: (arg: string | { code: string; idempotencyKey?: string }) => {
      const { code, idempotencyKey } = typeof arg === 'string' ? { code: arg } : arg
      return apiFetch<FriendAcceptResult>('/friends/accept', {
        method: 'POST',
        json: { code },
        idempotencyKey: idempotencyKey ?? newIdempotencyKey(),
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.friends.all })
    },
  })
}

export function useRemoveFriend() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (friendUserId: string) =>
      apiFetch<void>(`/friends/${encodeURIComponent(friendUserId)}`, {
        method: 'DELETE',
      }),
    onSuccess: (_data, friendUserId) => {
      friendActions.handleUnfriend(friendUserId)
      void queryClient.invalidateQueries({ queryKey: keys.friends.all })
      void queryClient.invalidateQueries({ queryKey: keys.chat.all })
    },
  })
}

export const petInteractionsQuery = (friendUserId: string) =>
  queryOptions({
    queryKey: keys.friends.interactions(friendUserId),
    queryFn: () =>
      apiFetch<PetInteractionsStatus>(`/friends/${encodeURIComponent(friendUserId)}/interactions`),
  })

export function usePetInteractions(friendUserId: string | null) {
  return useQuery({
    ...petInteractionsQuery(friendUserId ?? ''),
    enabled: Boolean(friendUserId),
  })
}

export function useInteractWithPet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      friendUserId,
      input,
      idempotencyKey,
    }: {
      friendUserId: string
      input: PetInteractInput
      idempotencyKey?: string
    }) =>
      apiFetch<PetInteractResult>(`/friends/${encodeURIComponent(friendUserId)}/interact`, {
        method: 'POST',
        json: input,
        idempotencyKey: idempotencyKey ?? newIdempotencyKey(),
      }),
    onSuccess: (result, variables) => {
      queryClient.setQueryData(keys.friends.interactions(variables.friendUserId), result.status)
      void queryClient.invalidateQueries({
        queryKey: keys.friends.interactions(variables.friendUserId),
      })
    },
  })
}
