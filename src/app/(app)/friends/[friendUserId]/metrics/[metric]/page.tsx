import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { FriendMetricDetailPage } from '@/features/friend/components/friend-metric-detail-view'
import { MetricDetailSkeleton } from '@/features/metric/components/metric-detail-view'
import { MetricKindSchema, type MetricKind } from '@/features/metric/schemas'
import { UserIdSchema } from '@/features/shared/schemas'

const PAGE_TITLES: Record<MetricKind, string> = {
  weight: '好友的体重详情',
  mood: '好友的心情详情',
  steps: '好友的步数详情',
}

interface Props {
  params: Promise<{ friendUserId: string; metric: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { metric } = await params
  const parsed = MetricKindSchema.safeParse(metric)
  return { title: parsed.success ? PAGE_TITLES[parsed.data] : '好友的指标详情' }
}

/** /friends/[friendUserId]/metrics/[metric]：好友体重 / 心情 / 步数只读双 Tab 详情页 */
export default function Page({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="px-4 pt-[calc(var(--safe-top)+3.5rem)] md:px-8 md:pt-16">
          <MetricDetailSkeleton />
        </div>
      }
    >
      <FriendMetricDetailBody params={params} />
    </Suspense>
  )
}

async function FriendMetricDetailBody({ params }: Props) {
  const { friendUserId, metric } = await params
  const parsed = MetricKindSchema.safeParse(metric)
  if (!UserIdSchema.safeParse(friendUserId).success || !parsed.success) {
    notFound()
  }
  return <FriendMetricDetailPage friendUserId={friendUserId} kind={parsed.data} />
}
