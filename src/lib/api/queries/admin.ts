import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AdminCodeQuery, AdminUserQuery, QuotaAdjustment } from '@/features/admin/schemas'
import type { AppSettingsPatch } from '@/server/settings-schema'
import { authClient } from '@/lib/auth-client'
import { api, unwrap } from '../client'
import { ApiError } from '../fetcher'
import { keys } from '../keys'

/*
 * 后台的查询与写操作（client-data-and-forms.md 第 3、5 节，D7）。组件只从这里取 queryOptions 和 mutation。
 * 封号 / 解封走 Better Auth 的 admin 插件（PRD 7.3）：失败时把它的错误体转成本项目的 ApiError，
 * 组件照常用 errorMessage(err) 取文案。
 */

const v1 = api.api.v1.admin

// 失效用的前缀：keys.ts 只有带参数的 users(params) / codes(params)，前缀取它们的前两段
// （已在 sharedChangeRequests 申请 keys.admin.usersAll / codesAll）
const USERS_PREFIX = keys.admin.users({ offset: 0, limit: 0 }).slice(0, 2)
const CODES_PREFIX = keys.admin.codes({ offset: 0, limit: 0 }).slice(0, 2)

export const adminOverviewQuery = () =>
  queryOptions({
    queryKey: keys.admin.overview(),
    queryFn: () => unwrap(v1.overview.$get()),
  })

export const adminUsersQuery = (params: AdminUserQuery) =>
  queryOptions({
    queryKey: keys.admin.users(params),
    queryFn: () =>
      unwrap(
        v1.users.$get({
          query: {
            ...(params.q ? { q: params.q } : {}),
            offset: String(params.offset),
            limit: String(params.limit),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  })

export const adminCodesQuery = (params: AdminCodeQuery) =>
  queryOptions({
    queryKey: keys.admin.codes(params),
    queryFn: () =>
      unwrap(
        v1['redeem-codes'].$get({
          query: {
            ...(params.status ? { status: params.status } : {}),
            offset: String(params.offset),
            limit: String(params.limit),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  })

export const adminSettingsQuery = () =>
  queryOptions({
    queryKey: keys.admin.settings(),
    queryFn: () => unwrap(v1.settings.$get()),
  })

/** 暂停 / 恢复全站 AI：成功后刷新首页与额度数据 */
export function useSetAiPaused() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (paused: boolean) => unwrap(paused ? v1.ai.pause.$post() : v1.ai.resume.$post()),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.admin.overview() })
      void qc.invalidateQueries({ queryKey: keys.me.quota() })
    },
  })
}

/** 调整加购余额：幂等键由调用方每次提交生成一个，失败重试复用同一个 */
export function useAdjustQuota() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      userId,
      input,
      idempotencyKey,
    }: {
      userId: string
      input: QuotaAdjustment
      idempotencyKey: string
    }) =>
      unwrap(
        v1.users[':userId']['quota-adjustments'].$post({
          param: { userId },
          json: input,
          header: { 'idempotency-key': idempotencyKey },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_PREFIX }),
  })
}

/** 批量生成：幂等键由调用方在打开弹层时生成，重试复用同一个 */
export function useGenerateCodes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ count, idempotencyKey }: { count: number; idempotencyKey: string }) =>
      unwrap(
        v1['redeem-codes'].$post({
          json: { count },
          header: { 'idempotency-key': idempotencyKey },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: CODES_PREFIX }),
  })
}

export function useVoidCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (codeId: string) =>
      unwrap(v1['redeem-codes'][':codeId'].void.$post({ param: { codeId } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: CODES_PREFIX }),
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: AppSettingsPatch) => unwrap(v1.settings.$put({ json: patch })),
    onSuccess: (data) => {
      qc.setQueryData(keys.admin.settings(), data)
      void qc.invalidateQueries({ queryKey: keys.admin.overview() })
    },
  })
}

/** Better Auth 客户端的 { data, error } → 成功返回 data，失败抛 ApiError（code 沿用它的错误码） */
async function authCall<T>(
  call: Promise<{
    data: T | null
    error: { status?: number; code?: string; message?: string } | null
  }>,
): Promise<T> {
  const { data, error } = await call
  if (error || data === null) {
    throw new ApiError(error?.status ?? 500, {
      code: error?.code ?? 'INTERNAL',
      detail: error?.message ?? '请求失败',
    })
  }
  return data
}

export interface BanInput {
  userId: string
  banReason: string
  /** 秒；不传表示永久 */
  banExpiresIn?: number
}

export function useBanUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: BanInput) => authCall(authClient.admin.banUser(input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_PREFIX }),
  })
}

export function useUnbanUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => authCall(authClient.admin.unbanUser({ userId })),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_PREFIX }),
  })
}
