import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { AppPage } from '@/components/layout/app-page'
import { PageSkeleton } from '@/components/layout/page-skeleton'
import { MetricDetailView } from '@/features/metric/components/metric-detail-view'
import { METRIC_KINDS, MetricKindSchema, type MetricKind } from '@/features/metric/schemas'

const PAGE_TITLES: Record<MetricKind, string> = {
  weight: '体重详情',
  mood: '心情详情',
  steps: '步数详情',
}

export function generateStaticParams() {
  return METRIC_KINDS.map((metric) => ({ metric }))
}

export async function generateMetadata({
  params,
}: PageProps<'/metrics/[metric]'>): Promise<Metadata> {
  const { metric } = await params
  const parsed = MetricKindSchema.safeParse(metric)
  return { title: parsed.success ? PAGE_TITLES[parsed.data] : '指标详情' }
}

/** /metrics/[metric]：体重 / 心情 / 步数专属详情页（默认「统计图」Tab + 「详细记录」Tab） */
export default function Page({ params }: PageProps<'/metrics/[metric]'>) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MetricPage params={params} />
    </Suspense>
  )
}

async function MetricPage({ params }: Pick<PageProps<'/metrics/[metric]'>, 'params'>) {
  const { metric } = await params
  const parsed = MetricKindSchema.safeParse(metric)
  if (!parsed.success) notFound()
  const kind = parsed.data
  return (
    <AppPage title={PAGE_TITLES[kind]} backHref="/">
      <Suspense fallback={<PageSkeleton />}>
        <MetricDetailView kind={kind} />
      </Suspense>
    </AppPage>
  )
}
