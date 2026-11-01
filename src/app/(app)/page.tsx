import type { Metadata } from 'next'
import { AppPage } from '@/components/layout/app-page'
import { HomeView } from '@/features/dashboard/components/home-view'

// 和 (app)/layout.tsx 同一层的 page 不套用根 layout 的 title.template（routing.md 第 3 节）
export const metadata: Metadata = { title: { absolute: '主页 · DayDayOn' } }

/** 主页仪表盘（PRD 2.8）：数据在客户端经 /dashboard/today 取，加载中显示骨架 */
export default function Page() {
  return (
    <AppPage title="主页">
      <HomeView />
    </AppPage>
  )
}
