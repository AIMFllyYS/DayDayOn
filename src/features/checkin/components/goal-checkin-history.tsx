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
import type { FieldDef, GoalDetail } from '@/features/goal/schemas'
import { errorMessage, isApiError, useInfiniteQuery, useQuery } from '@/lib/api'
import { checkinGoalQuery, checkinHistoryQuery, useDeleteCheckin } from '@/lib/api/queries/checkins'
import { friendGoalCheckinsQuery } from '@/lib/api/queries/friends'
import { formatLocalDateLabel } from '@/lib/time'
import { checkinSummary } from '../format'
import type { Checkin } from '../schemas'

const ConfirmDialog = dynamic(
  () => import('@/components/ui/confirm-dialog').then((m) => m.ConfirmDialog),
  { loading: () => null },
)

export interface GoalCheckinHistoryProps {
  goalId: string
  /** 好友只读模式：改走 /friends/{friendUserId}/goals/{goalId}/checkins */
  friendUserId?: string
  /** 父级已拉取的自定义字段版本表（好友模式必传，避免重复请求本人 /goals/{goalId}） */
  fieldVersions?: GoalDetail['fieldVersions']
  /** 只读模式：隐藏删除按钮与二次确认弹窗 */
  readOnly?: boolean
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
 * 目标详情页的打卡历史列表（PRD 2.3、2.4）：支持本人游标分页删除与好友只读查看。
 * 自定义目标按当时的字段版本展示。
 */
export function GoalCheckinHistory({
  goalId,
  friendUserId,
  fieldVersions,
  readOnly = false,
}: GoalCheckinHistoryProps) {
  const isReadOnly = readOnly || Boolean(friendUserId)
  const ownHistory = useInfiniteQuery({
    ...checkinHistoryQuery(goalId),
    enabled: !friendUserId,
  })
  const friendHistory = useInfiniteQuery({
    ...friendGoalCheckinsQuery(friendUserId ?? '', goalId),
    enabled: Boolean(friendUserId),
  })
  const history = friendUserId ? friendHistory : ownHistory
  const goal = useQuery({
    ...checkinGoalQuery(goalId),
    enabled: !friendUserId && fieldVersions === undefined,
  })
  const remove = useDeleteCheckin(goalId)
  const [pending, setPending] = useState<Checkin | null>(null)
  const [confirmLoaded, setConfirmLoaded] = useState(false)
  if (pending !== null && !confirmLoaded) setConfirmLoaded(true)

  const resolvedVersions = fieldVersions ?? goal.data?.fieldVersions ?? []
  const versions = new Map<number, FieldDef[]>(resolvedVersions.map((v) => [v.version, v.fields]))

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
                  <li
                    key={c.id}
                    className={`flex min-h-14 items-center gap-2 py-1.5 pl-3.5 ${isReadOnly ? 'pr-3.5' : 'pr-1'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-caption break-words">
                        {checkinSummary(
                          c,
                          c.fieldVersion === null ? null : versions.get(c.fieldVersion),
                        )}
                      </p>
                      {c.note && <p className="text-tiny text-muted truncate">{c.note}</p>}
                    </div>
                    {c.verdict?.settlement === 'pending' ? (
                      <Badge tone="diet">待三餐汇总</Badge>
                    ) : c.score !== null ? (
                      <Badge tone={c.isValid ? 'success' : 'warning'}>{c.score.toFixed(1)}分</Badge>
                    ) : !c.isValid ? (
                      <Badge tone="warning">未达标</Badge>
                    ) : null}
                    {c.isMakeup && <Badge>补卡</Badge>}
                    {c.source === 'ai' && <Badge tone="primary">AI</Badge>}
                    {!isReadOnly && (
                      <IconButton icon="trash" label="删除这条打卡" onClick={() => setPending(c)} />
                    )}
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
      <CardHeader
        title="打卡记录"
        description={isReadOnly ? '最近的打卡记录' : '记错了就删掉重记'}
      />
      {body}
      {!isReadOnly && confirmLoaded && (
        <ConfirmDialog
          open={pending !== null}
          onOpenChange={(open) => {
            if (!open) setPending(null)
          }}
          title="删除这条打卡？"
          description="删除后今天的进度会重新计算。"
          tone="danger"
          confirmLabel="删除"
          onConfirm={() => {
            if (!pending) return
            return remove.mutateAsync(pending.id).then(
              () => toast.success('删掉了'),
              (e: unknown) => {
                toast.error(isApiError(e) ? errorMessage(e) : '出了点小状况，稍后再试试')
                throw e
              },
            )
          }}
        />
      )}
    </Card>
  )
}
