import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AppPage } from '@/components/layout/app-page'
import { RankSkeleton, RankView } from '@/features/rank/components/rank-view'
import { RankRangeSchema } from '@/features/rank/schemas'

export const metadata: Metadata = { title: '排行' }

/** /rank?range=week|month：非法值回落到 week（PRD 2.9、routing.md 第 4 节） */
export default function Page({ searchParams }: PageProps<'/rank'>) {
  return (
    <AppPage title="排行">
      <Suspense fallback={<RankSkeleton />}>
        <Rank searchParams={searchParams} />
      </Suspense>
    </AppPage>
  )
}

async function Rank({ searchParams }: Pick<PageProps<'/rank'>, 'searchParams'>) {
  const { range } = await searchParams
  const parsed = RankRangeSchema.safeParse(range)
  return <RankView range={parsed.success ? parsed.data : 'week'} />
}
