'use client'

import { Badge } from '@/components/ui/badge'
import { IconButton } from '@/components/ui/button'
import type { FieldDef, GoalDetail } from '@/features/goal/schemas'
import { useInfiniteQuery, useQuery } from '@/lib/api'
import { checkinGoalQuery, checkinHistoryQuery, useDeleteCheckin } from '@/lib/api/queries/checkins'
import { friendGoalCheckinsQuery } from '@/lib/api/queries/friends'
import { checkinSummary } from '../format'
import type { Checkin } from '../schemas'
import { RecordHistoryCard } from './record-history-card'

export interface GoalCheckinHistoryProps {
  goalId: string
  /** 好友只读模式：改走 /friends/{friendUserId}/goals/{goalId}/checkins */
  friendUserId?: string
  /** 父级已拉取的自定义字段版本表（好友模式必传，避免重复请求本人 /goals/{goalId}） */
  fieldVersions?: GoalDetail['fieldVersions']
  /** 只读模式：隐藏删除按钮与二次确认弹窗 */
  readOnly?: boolean
}

/**
 * 目标详情页的打卡历史列表（PRD 2.3、2.4）：基于 RecordHistoryCard 封装，
 * 支持本人游标分页删除与好友只读查看；自定义目标按当时的字段版本展示。
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

  const resolvedVersions = fieldVersions ?? goal.data?.fieldVersions ?? []
  const versions = new Map<number, FieldDef[]>(resolvedVersions.map((v) => [v.version, v.fields]))
  const items: Checkin[] = history.data ? history.data.pages.flatMap((p) => p.items) : []

  return (
    <RecordHistoryCard
      title="打卡记录"
      description={isReadOnly ? '最近的打卡记录' : '记错了就删掉重记'}
      items={items}
      getKey={(c) => c.id}
      isPending={history.isPending}
      isError={history.isError}
      error={history.error}
      isRefetching={history.isRefetching}
      onRetry={() => void history.refetch()}
      hasNextPage={history.hasNextPage}
      isFetchingNextPage={history.isFetchingNextPage}
      onFetchNextPage={() => void history.fetchNextPage()}
      emptyTitle="还没有打卡记录"
      emptyDescription="完成第一次打卡，这里就会有记录"
      deleteConfig={
        isReadOnly
          ? undefined
          : {
              title: '删除这条打卡？',
              description: '删除后今天的进度会重新计算。',
              onDelete: (c) => remove.mutateAsync(c.id),
            }
      }
      renderItem={(c, { requestDelete }) => (
        <div
          className={`flex min-h-14 items-center gap-2 py-1.5 pl-3.5 ${isReadOnly ? 'pr-3.5' : 'pr-1'}`}
        >
          <div className="min-w-0 flex-1">
            <p className="text-caption break-words">
              {checkinSummary(c, c.fieldVersion === null ? null : versions.get(c.fieldVersion))}
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
            <IconButton icon="trash" label="删除这条打卡" onClick={() => requestDelete(c)} />
          )}
        </div>
      )}
    />
  )
}
