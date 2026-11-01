import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AppPage } from '@/components/layout/app-page'
import { PageSkeleton } from '@/components/layout/page-skeleton'
import { NewGoalView } from '@/features/goal/components/new-goal-view'
import { ModuleSchema } from '@/features/shared/schemas'

export const metadata: Metadata = { title: '新建目标' }

/** /goals/new?module=…：没有或非法时先选板块 */
export default function Page({ searchParams }: PageProps<'/goals/new'>) {
  return (
    <AppPage title="新建目标" backHref="/goals">
      <Suspense fallback={<PageSkeleton />}>
        <NewGoal searchParams={searchParams} />
      </Suspense>
    </AppPage>
  )
}

async function NewGoal({ searchParams }: Pick<PageProps<'/goals/new'>, 'searchParams'>) {
  const { module } = await searchParams
  const parsed = ModuleSchema.safeParse(module)
  return <NewGoalView module={parsed.success ? parsed.data : null} />
}
