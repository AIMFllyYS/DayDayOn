import type { AiRunList, QuotaView, Redeem, RedeemResult } from '@/features/quota/schemas'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../fetcher'
import { keys } from '../keys'

/*
 * 额度领域的查询与写操作（client-data-and-forms.md 第 3、5 节）。D6。
 */

export const quotaQuery = () =>
  queryOptions({
    queryKey: keys.me.quota(),
    queryFn: () => apiFetch<QuotaView>('/me/quota'),
  })

export const aiRunsQuery = () =>
  queryOptions({
    queryKey: keys.me.aiRuns(),
    queryFn: () => apiFetch<AiRunList>('/me/ai-runs'),
  })

export interface RedeemVariables {
  body: Redeem
  /** 每次点击"兑换"生成一个，重试时复用 */
  idempotencyKey: string
}

/** 兑换：成功后直接写入最新额度，并刷新使用记录以外的额度相关查询 */
export function useRedeemCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: RedeemVariables) =>
      apiFetch<RedeemResult>('/redeem-codes/redeem', {
        method: 'POST',
        json: body,
        idempotencyKey,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(keys.me.quota(), result.quota)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.me.quota() }),
  })
}
