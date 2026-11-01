'use client'

import { ErrorState } from '@/components/ui/error-state'
import { useCheckinLauncher } from '@/features/checkin/launcher-store'
import { errorMessage, isApiError, useQuery } from '@/lib/api'
import { dashboardTodayQuery } from '@/lib/api/queries/dashboard'
import { BUSINESS_TIME_ZONE } from '@/lib/time'
import { HomeDashboard } from './home-dashboard'
import { HomeSkeleton } from './home-skeleton'

/*
 * 主页（/）的数据容器：GET /dashboard/today → HomeDashboard。加载骨架、错误态、空状态都在这里或下一层。
 * 动态时间暂按北京时间显示：DashboardToday 还没有带用户时区（已在 sharedChangeRequests 申请加 timeZone）。
 */
export function HomeView() {
  const query = useQuery(dashboardTodayQuery())
  const launcher = useCheckinLauncher()

  if (query.isPending) return <HomeSkeleton />
  if (query.isError) {
    return (
      <ErrorState
        title="主页没加载出来"
        message={isApiError(query.error) ? errorMessage(query.error) : undefined}
        onRetry={() => void query.refetch()}
        retrying={query.isRefetching}
      />
    )
  }
  return (
    <HomeDashboard
      data={query.data}
      now={query.dataUpdatedAt}
      timeZone={BUSINESS_TIME_ZONE}
      onOpenWeight={() => launcher.open('weight')}
      onOpenMood={() => launcher.open('mood')}
    />
  )
}
