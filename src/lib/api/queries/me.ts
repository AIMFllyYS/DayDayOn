'use client'

import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  Me,
  Onboarding,
  OnboardingInput,
  UpdatePreferences,
  UpdateProfile,
} from '@/features/me/schemas'
import { API_BASE, apiFetch } from '../fetcher'
import { keys } from '../keys'

/*
 * 账号的查询与写操作（client-data-and-forms.md 第 3、5 节）。D1。
 * GET /me 与外壳的 ThemeSync 共用 keys.me.detail()，响应同为 MeSchema，两边命中同一份缓存。
 */

export const meQuery = () =>
  queryOptions({
    queryKey: keys.me.detail(),
    queryFn: () => apiFetch<Me>('/me'),
  })

export function useMe() {
  return useQuery(meQuery())
}

/** 导出数据：浏览器直接下载这个地址（Content-Disposition: attachment） */
export const ME_EXPORT_URL = `${API_BASE}/me/export`

/** 偏好变了会影响的其他数据：上榜影响排行，日切换时间影响"今天"是哪一天 */
const affectedByPreferences = [keys.rank.all, keys.checkins.all, keys.dashboard.all] as const

/** PATCH /me/preferences：乐观更新（开关、主题点了立刻生效），失败回滚 */
export function useUpdatePreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdatePreferences) =>
      apiFetch<Me>('/me/preferences', { method: 'PATCH', json: input }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: keys.me.detail() })
      const previous = queryClient.getQueryData<Me>(keys.me.detail())
      if (previous) {
        queryClient.setQueryData<Me>(keys.me.detail(), {
          ...previous,
          preferences: { ...previous.preferences, ...input },
        })
      }
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(keys.me.detail(), context.previous)
    },
    onSuccess: (me, input) => {
      queryClient.setQueryData(keys.me.detail(), me)
      if (input.leaderboardOptIn !== undefined || input.dayStartHour !== undefined) {
        for (const queryKey of affectedByPreferences) {
          void queryClient.invalidateQueries({ queryKey })
        }
      }
    },
  })
}

/** PATCH /me/profile：表单保存，不做乐观更新（服务端可能返回字段错误） */
export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateProfile) =>
      apiFetch<Me>('/me/profile', { method: 'PATCH', json: input }),
    onSuccess: (me) => {
      queryClient.setQueryData(keys.me.detail(), me)
      // 昵称、头像出现在排行和动态里；时区影响今天的打卡日
      void queryClient.invalidateQueries({ queryKey: keys.rank.all })
      void queryClient.invalidateQueries({ queryKey: keys.dashboard.all })
      void queryClient.invalidateQueries({ queryKey: keys.checkins.all })
    },
  })
}

export interface CompleteOnboardingVars {
  input: Onboarding | OnboardingInput
  /** 每次点"开始打卡"生成一个，重试时复用 */
  idempotencyKey: string
}

/** POST /me/onboarding：成功后目标、额度都变了，整个缓存按新账号重来 */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: CompleteOnboardingVars) =>
      apiFetch<Me>('/me/onboarding', { method: 'POST', json: input, idempotencyKey }),
    onSuccess: (me) => {
      queryClient.clear()
      queryClient.setQueryData(keys.me.detail(), me)
    },
  })
}

/** DELETE /me：确认词由调用方校验后传入 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: (confirm: '注销') => apiFetch<void>('/me', { method: 'DELETE', json: { confirm } }),
  })
}
