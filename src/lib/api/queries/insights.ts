import { queryOptions } from '@tanstack/react-query'
import type { InsightDays, Insights } from '@/features/insights/schemas'
import { apiFetch } from '../fetcher'
import { keys } from '../keys'

/*
 * 板块近况（GET /insights）。key 挂在 dashboard 前缀下：打卡写操作成功后 afterCheckinChange
 * 按 keys.dashboard.all 一起失效，不用另外登记。
 */

export function insightsQuery(days: InsightDays = 7, goalId?: string) {
  const params = new URLSearchParams({ days: String(days) })
  if (goalId) params.set('goalId', goalId)
  return queryOptions({
    queryKey: keys.dashboard.insights(days, goalId),
    queryFn: () => apiFetch<Insights>(`/insights?${params.toString()}`),
  })
}
