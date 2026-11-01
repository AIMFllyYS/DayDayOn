import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { AppPage } from '@/components/layout/app-page'
import { PageSkeleton } from '@/components/layout/page-skeleton'
import { CheckinPage } from '@/features/checkin/components/checkin-page'
import { IdSchema } from '@/features/shared/schemas'

export const metadata: Metadata = { title: '打卡' }

/** 打卡页（PRD 2.4）。读 params / searchParams 的部分放在 Suspense 里（Cache Components） */
export default function Page({ params, searchParams }: PageProps<'/goals/[goalId]/checkin'>) {
  return (
    <AppPage title="打卡" backHref="/">
      <Suspense fallback={<PageSkeleton />}>
        <CheckinRoute params={params} searchParams={searchParams} />
      </Suspense>
    </AppPage>
  )
}

async function CheckinRoute({ params, searchParams }: PageProps<'/goals/[goalId]/checkin'>) {
  const { goalId } = await params
  // 不是合法 id 的地址直接 404，不去请求接口（与目标详情页一致）
  if (!IdSchema.safeParse(goalId).success) notFound()
  const { mode } = await searchParams
  // ?mode=photo：打卡弹层"拍照记一餐"直达；非法值回落到手动
  return (
    <CheckinPage
      key={goalId}
      goalId={goalId}
      initialMethod={mode === 'photo' ? 'photo' : 'manual'}
    />
  )
}
