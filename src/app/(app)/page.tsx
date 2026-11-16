import type { Metadata } from 'next'
import { AppPage } from '@/components/layout/app-page'
import { HomeView } from '@/features/dashboard/components/home-view'
import { dehydrate, getQueryClient, HydrationBoundary } from '@/lib/api'
import { dashboardTodayQuery } from '@/lib/api/queries/dashboard'
import { insightsQuery } from '@/lib/api/queries/insights'
import { requireOnboardedUser } from '@/server/auth'
import { db } from '@/server/db/client'
import { getDashboardToday } from '@/server/services/dashboard'
import { getInsights } from '@/server/services/insights'

// 和 (app)/layout.tsx 同一层的 page 不套用根 layout 的 title.template（routing.md 第 3 节）
export const metadata: Metadata = { title: { absolute: '主页 · DayDayOn' } }

/**
 * 主页仪表盘（PRD 2.8、client-data-and-forms.md 第 1 节）：
 * 在 (app)/layout.tsx 的单层 <Suspense fallback={<PageSkeleton />}> 内完成会话校验与首屏数据预取，
 * 通过 HydrationBoundary 脱水给客户端 <HomeView />，挂载即命中缓存，避免 PageSkeleton → HomeSkeleton 二次加载闪烁。
 */
export default async function Page() {
  const user = await requireOnboardedUser()
  const queryClient = getQueryClient()
  const now = new Date()

  await Promise.all([
    queryClient.prefetchQuery({
      ...dashboardTodayQuery(),
      queryFn: () => getDashboardToday(db, user.id, now),
      retry: false,
    }),
    queryClient.prefetchQuery({
      ...insightsQuery(7),
      queryFn: () => getInsights(db, user.id, now, { days: 7 }),
      retry: false,
    }),
  ])

  return (
    <AppPage title="主页" primaryNav>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <HomeView />
      </HydrationBoundary>
    </AppPage>
  )
}
