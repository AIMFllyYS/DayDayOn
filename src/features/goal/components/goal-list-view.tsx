'use client'

import { useRouter } from 'next/navigation'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage, isApiError, useQuery } from '@/lib/api'
import { goalListQuery } from '@/lib/api/queries/goals'
import { GOAL_ACTIVE_LIMIT, type Goal, type GoalStatus } from '../schemas'
import { GoalLinkButton } from './goal-link-button'
import { GoalRow, GoalRows } from './goal-row'

const TABS = [
  { value: 'active', label: '进行中' },
  { value: 'archived', label: '已归档' },
] as const

/** /goals 页面主体：进行中 / 已归档切换（?status=），加载骨架、空状态、错误态 */
export function GoalListView({ status }: { status: GoalStatus }) {
  const router = useRouter()
  const query = useQuery(goalListQuery(status))

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex items-center gap-3">
        <SegmentedControl
          label="目标状态"
          options={TABS}
          value={status}
          onValueChange={(s) =>
            router.replace(s === 'active' ? '/goals' : `/goals?status=${s}`, { scroll: false })
          }
          className="max-w-64 flex-1"
        />
        {status === 'active' && query.data && (
          <span className="text-tiny text-muted ml-auto tabular-nums">
            {query.data.items.length} / {GOAL_ACTIVE_LIMIT}
          </span>
        )}
      </div>

      {query.isPending ? (
        <GoalListSkeleton />
      ) : query.isError ? (
        <ErrorState
          title="目标没加载出来"
          message={isApiError(query.error) ? errorMessage(query.error) : undefined}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      ) : query.data.items.length === 0 ? (
        <GoalListEmpty status={status} />
      ) : (
        <GoalListContent items={query.data.items} status={status} />
      )}
    </div>
  )
}

/** 列表本体：Playbook 原型也用它渲染演示数据 */
export function GoalListContent({ items, status }: { items: readonly Goal[]; status: GoalStatus }) {
  const full = status === 'active' && items.length >= GOAL_ACTIVE_LIMIT
  return (
    <>
      <GoalRows>
        {items.map((g) => (
          <GoalRow key={g.id} goal={g} />
        ))}
      </GoalRows>
      {status === 'active' &&
        (full ? (
          <p className="text-caption text-muted text-center">
            进行中的目标满 {GOAL_ACTIVE_LIMIT} 个了，归档几个再新建吧
          </p>
        ) : (
          <NewGoalLink className="self-center" />
        ))}
    </>
  )
}

function GoalListEmpty({ status }: { status: GoalStatus }) {
  return status === 'active' ? (
    <EmptyState
      title="还没有进行中的目标"
      description="先定一个小目标，每天记一笔就好"
      action={<NewGoalLink />}
    />
  ) : (
    <EmptyState
      title="没有归档的目标"
      description="暂时不做的目标可以归档，历史会保留"
      mood="sleepy"
    />
  )
}

function NewGoalLink({ className }: { className?: string }) {
  return (
    <GoalLinkButton href="/goals/new" icon="plus" className={className}>
      新建目标
    </GoalLinkButton>
  )
}

function GoalListSkeleton() {
  return (
    <div role="status" aria-label="加载中" className="bg-surface shadow-soft rounded-2xl">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-10 rounded-xl" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-44" />
          </div>
        </div>
      ))}
    </div>
  )
}
