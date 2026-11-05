import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AppPage } from '@/components/layout/app-page'
import { PageSkeleton } from '@/components/layout/page-skeleton'
import { GoalSettingsView } from '@/features/checkin/components/goal-settings-view'
import { GoalListView } from '@/features/goal/components/goal-list-view'

export const metadata: Metadata = { title: '目标设置' }

/**
 * /goals：「我的 → 目标设置」，全局唯一的目标设置入口（checkin-modules.md 第 5 节）。
 * ?status=archived 显示已归档的目标；其余值都是设置页（routing.md 第 4 节）。
 */
export default function Page({ searchParams }: PageProps<'/goals'>) {
  return (
    <AppPage title="目标设置" backHref="/me">
      <Suspense fallback={<PageSkeleton />}>
        <Goals searchParams={searchParams} />
      </Suspense>
    </AppPage>
  )
}

async function Goals({ searchParams }: Pick<PageProps<'/goals'>, 'searchParams'>) {
  const { status } = await searchParams
  return status === 'archived' ? <GoalListView status="archived" /> : <GoalSettingsView />
}
