import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AppPage } from '@/components/layout/app-page'
import { PageSkeleton } from '@/components/layout/page-skeleton'
import { GoalListView } from '@/features/goal/components/goal-list-view'
import { GoalStatusSchema } from '@/features/goal/schemas'

export const metadata: Metadata = { title: '我的目标' }

/** /goals?status=active|archived：非法值回落到 active（routing.md 第 4 节） */
export default function Page({ searchParams }: PageProps<'/goals'>) {
  return (
    <AppPage title="我的目标" backHref="/me">
      <Suspense fallback={<PageSkeleton />}>
        <GoalList searchParams={searchParams} />
      </Suspense>
    </AppPage>
  )
}

async function GoalList({ searchParams }: Pick<PageProps<'/goals'>, 'searchParams'>) {
  const { status } = await searchParams
  const parsed = GoalStatusSchema.safeParse(status)
  return <GoalListView status={parsed.success ? parsed.data : 'active'} />
}
