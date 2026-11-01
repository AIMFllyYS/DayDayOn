'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import type { FieldDef } from '@/features/goal/schemas'
import { errorMessage, isApiError, useInfiniteQuery, useQuery } from '@/lib/api'
import { checkinGoalQuery, checkinHistoryQuery } from '@/lib/api/queries/checkins'
import { useDeleteCheckin } from '@/lib/api/queries/checkins'
import { formatLocalDateLabel } from '@/lib/time'
import { checkinSummary } from '../format'
import type { Checkin } from '../schemas'

const ConfirmDialog = dynamic(() =>
  import('@/components/ui/confirm-dialog').then((m) => m.ConfirmDialog),
)

export interface GoalCheckinHistoryProps {
  goalId: string
}

/** 按打卡日分组（接口已按日期倒序） */
function groupByDate(items: readonly Checkin[]): [string, Checkin[]][] {
  const out: [string, Checkin[]][] = []
  for (const c of items) {
    const last = out.at(-1)
    if (last && last[0] === c.localDate) last[1].push(c)
    else out.push([c.localDate, [c]])
  }
  return out
}

/**
 * 目标详情页的打卡历史列表（PRD 2.3、2.4）：GET /goals/{goalId}/checkins 游标分页，可删除（二次确认）。
 * 自定义目标按当时的字段版本展示。props F1 定；实现 D3；D2 的详情页嵌入。
 */
export function GoalCheckinHistory({ goalId }: GoalCheckinHistoryProps) {
  const history = useInfiniteQuery(checkinHistoryQuery(goalId))
  const goal = useQuery(checkinGoalQuery(goalId))
  const remove = useDeleteCheckin(goalId)
  const [pending, setPending] = useState<Checkin | null>(null)

  const versions = new Map<number, FieldDef[]>(
    (goal.data?.fieldVersions ?? []).map((v) => [v.version, v.fields]),
  )

  let body
  if (history.isPending) {
    body = (
      <div role="status" aria-label="加载中" className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    )
  } else if (history.isError) {
    body = (
      <ErrorState
        size="compact"
        title="记录没加载出来"
        message={isApiError(history.error) ? errorMessage(history.error) : undefined}
        onRetry={() => void history.refetch()}
        retrying={history.isRefetching}
      />
    )
  } else {
    const items = history.data.pages.flatMap((p) => p.items)
    body =
      items.length === 0 ? (
        <EmptyState
          size="compact"
          title="还没有打卡记录"
          description="完成第一次打卡，这里就会有记录"
        />
      ) : (
        <div className="flex flex-col gap-4">
          {groupByDate(items).map(([date, list]) => (
            <section key={date} aria-label={formatLocalDateLabel(date)}>
              <h4 className="text-tiny text-muted mb-1.5 font-semibold">
                {formatLocalDateLabel(date)}
              </h4>
              <ul className="divide-border bg-surface-sunken/60 divide-y overflow-hidden rounded-2xl">
                {list.map((c) => (
                  <li key={c.id} className="flex min-h-14 items-center gap-2 py-1.5 pr-1 pl-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-caption break-words">
                        {checkinSummary(
                          c,
                          c.fieldVersion === null ? null : versions.get(c.fieldVersion),
                        )}
                      </p>
                      {c.note && <p className="text-tiny text-muted truncate">{c.note}</p>}
                    </div>
                    {c.isMakeup && <Badge>补卡</Badge>}
                    {c.source === 'ai' && <Badge tone="primary">AI</Badge>}
                    <IconButton icon="trash" label="删除这条打卡" onClick={() => setPending(c)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {history.hasNextPage && (
            <Button
              variant="ghost"
              className="self-center"
              loading={history.isFetchingNextPage}
              onClick={() => void history.fetchNextPage()}
            >
              再看看更早的
            </Button>
          )}
        </div>
      )
  }

  return (
    <Card>
      <CardHeader title="打卡记录" description="记错了就删掉重记" />
      {body}
      {pending && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setPending(null)
          }}
          title="删除这条打卡？"
          description="删除后今天的进度会重新计算。"
          tone="danger"
          confirmLabel="删除"
          onConfirm={() =>
            remove.mutateAsync(pending.id).then(
              () => toast.success('删掉了'),
              (e: unknown) => {
                toast.error(isApiError(e) ? errorMessage(e) : '出了点小状况，稍后再试试')
                throw e
              },
            )
          }
        />
      )}
    </Card>
  )
}
