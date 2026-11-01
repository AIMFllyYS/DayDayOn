'use client'

import { useRouter } from 'next/navigation'
import { ErrorState } from '@/components/ui/error-state'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage, isApiError, keepPreviousData, useQuery } from '@/lib/api'
import { rankBoardQuery } from '@/lib/api/queries/rank'
import type { RankRange } from '../schemas'
import { RankBoard } from './rank-board'

const RANGES = [
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
] as const

/** /rank 页面主体：本周 / 本月切换（?range=），加载骨架、错误态、空状态 */
export function RankView({ range }: { range: RankRange }) {
  const router = useRouter()
  const query = useQuery({ ...rankBoardQuery(range), placeholderData: keepPreviousData })

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-3 pb-8">
      <SegmentedControl
        options={RANGES}
        value={range}
        onValueChange={(r) =>
          router.replace(r === 'week' ? '/rank' : `/rank?range=${r}`, { scroll: false })
        }
        label="排行范围"
      />
      {query.isPending ? (
        <RankSkeleton />
      ) : query.isError ? (
        <ErrorState
          title="排行榜没加载出来"
          message={isApiError(query.error) ? errorMessage(query.error) : undefined}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      ) : (
        <RankBoard board={query.data} />
      )}
    </div>
  )
}

export function RankSkeleton() {
  return (
    <div role="status" aria-label="加载中" className="grid gap-3">
      <Skeleton className="h-52 w-full rounded-2xl" />
      <Skeleton className="h-56 w-full rounded-2xl" />
      <Skeleton className="h-14 w-full rounded-2xl" />
    </div>
  )
}
