import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { AppPage } from '@/components/layout/app-page'
import { PageSkeleton } from '@/components/layout/page-skeleton'
import { CheckinFlowPage } from '@/features/checkin/components/checkin-flow-page'
import { IdSchema } from '@/features/shared/schemas'

export const metadata: Metadata = { title: '打卡' }

/**
 * 打卡页（checkin-modules.md 第 5 节）。整页稿自带返回栏和底部操作条，所以隐藏通用顶栏、占满视口、不加外层边距（flush）。
 * 读 params / searchParams 的部分放在 Suspense 里（Cache Components）。
 */
export default function Page({ params, searchParams }: PageProps<'/goals/[goalId]/checkin'>) {
  return (
    <AppPage title="打卡" hideTopBar fitViewport flush>
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
  // ?mode=photo：打卡弹层「拍照记一餐」直达智能拍照；非法值回落到手动
  return (
    <CheckinFlowPage
      key={goalId}
      goalId={goalId}
      initialMode={mode === 'photo' ? 'smart-capture' : 'manual'}
    />
  )
}
