import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { IdSchema } from '@/features/shared/schemas'
import { AppPage } from '@/components/layout/app-page'
import { PageSkeleton } from '@/components/layout/page-skeleton'
import { GoalDetailView } from '@/features/goal/components/goal-detail-view'

export const metadata: Metadata = { title: '目标详情' }

/** /goals/[goalId]：概览 + 打卡日历 + 打卡记录 + 编辑抽屉 + 归档 / 删除 */
export default function Page({ params }: PageProps<'/goals/[goalId]'>) {
  return (
    <AppPage title="目标详情" backHref="/goals">
      <Suspense fallback={<PageSkeleton />}>
        <GoalDetail params={params} />
      </Suspense>
    </AppPage>
  )
}

async function GoalDetail({ params }: Pick<PageProps<'/goals/[goalId]'>, 'params'>) {
  const { goalId } = await params
  // 不是合法 id 的地址直接 404，不去请求接口
  if (!IdSchema.safeParse(goalId).success) notFound()
  return <GoalDetailView goalId={goalId} />
}
