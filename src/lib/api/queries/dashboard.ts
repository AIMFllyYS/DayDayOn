import { queryOptions } from '@tanstack/react-query'
import type { DashboardToday } from '@/features/dashboard/schemas'
import { apiFetch } from '../fetcher'
import { keys } from '../keys'

/*
 * 主页仪表盘的查询（client-data-and-forms.md 第 2、3 节）。只读；打卡类写操作成功后
 * 由 afterCheckinChange 按前缀失效 keys.dashboard.all。
 */

export function dashboardTodayQuery() {
  return queryOptions({
    queryKey: keys.dashboard.today(),
    queryFn: () => apiFetch<DashboardToday>('/dashboard/today'),
  })
}
