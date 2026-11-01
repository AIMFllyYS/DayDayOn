'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { moduleMeta } from '@/components/ui/tone'
import { GoalCheckinCalendar } from '@/features/checkin/components/goal-checkin-calendar'
import { GoalCheckinHistory } from '@/features/checkin/components/goal-checkin-history'
import { errorMessage, isApiError, useQuery } from '@/lib/api'
import { goalDetailQuery, useDeleteGoal, useUpdateGoal } from '@/lib/api/queries/goals'
import { formatLocalDateLabel } from '@/lib/time'
import { FIELD_TYPE_LABEL, formatTarget, formatWeekdays } from '../format'
import type { GoalDetail } from '../schemas'
import { GoalLinkButton } from './goal-link-button'

// 弹层不进首屏（ui-primitives.md 第 3 节）
const GoalEditSheet = dynamic(() => import('./goal-edit-sheet').then((m) => m.GoalEditSheet))
const ConfirmDialog = dynamic(() =>
  import('@/components/ui/confirm-dialog').then((m) => m.ConfirmDialog),
)

/** /goals/[goalId] 页面主体：加载 / 不存在 / 出错 / 正常 */
export function GoalDetailView({ goalId }: { goalId: string }) {
  const query = useQuery(goalDetailQuery(goalId))

  if (query.isPending) return <GoalDetailSkeleton />
  if (query.isError) {
    if (isApiError(query.error) && query.error.code === 'GOAL_NOT_FOUND') {
      return (
        <EmptyState
          title="这个目标不见了"
          description="可能已经删除了，回列表看看吧"
          mood="surprised"
          action={
            <GoalLinkButton href="/goals" variant="soft">
              回到我的目标
            </GoalLinkButton>
          }
        />
      )
    }
    return (
      <ErrorState
        title="目标没加载出来"
        message={isApiError(query.error) ? errorMessage(query.error) : undefined}
        onRetry={() => void query.refetch()}
        retrying={query.isRefetching}
      />
    )
  }
  return <GoalDetailContent goal={query.data} />
}

/** 详情内容：概览卡 + 打卡日历 + 打卡记录 + 管理操作。Playbook 原型用演示数据渲染它 */
export function GoalDetailContent({ goal }: { goal: GoalDetail }) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="grid gap-3 pb-8 @3xl:grid-cols-[1fr_1.1fr] @3xl:gap-4">
      <div className="grid content-start gap-3">
        <GoalSummaryCard goal={goal} onEdit={() => setEditing(true)} />
        <GoalCheckinCalendar goalId={goal.id} module={goal.module} />
      </div>
      <div className="grid content-start gap-3">
        <GoalCheckinHistory goalId={goal.id} />
        <GoalManageCard goal={goal} onDelete={() => setConfirmDelete(true)} />
      </div>

      {editing && <GoalEditSheet goal={goal} open={editing} onOpenChange={setEditing} />}
      {confirmDelete && (
        <DeleteGoalDialog
          goalId={goal.id}
          title={goal.title}
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
        />
      )}
    </div>
  )
}

function GoalSummaryCard({ goal, onEdit }: { goal: GoalDetail; onEdit: () => void }) {
  const meta = moduleMeta[goal.module]
  const archived = goal.status === 'archived'
  const latestTarget = goal.targetHistory.at(-1)
  return (
    <Card variant="sticker" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <IconTile icon={meta.icon} tone={goal.module} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-heading font-bold break-words">{goal.title}</h2>
            {archived && <Badge>已归档</Badge>}
          </div>
          <p className="text-caption text-muted">
            {meta.label}
            {goal.fieldVersion !== null && ` · 字段第 ${goal.fieldVersion} 版`}
          </p>
        </div>
        <Button variant="soft" size="sm" icon="edit" onClick={onEdit}>
          编辑
        </Button>
      </div>
      {goal.description && <p className="text-body">{goal.description}</p>}
      <dl className="grid grid-cols-3 gap-2">
        <Stat label="每天目标" value={formatTarget(goal.target)} />
        <Stat label="计划" value={formatWeekdays(goal.weekdays)} />
        <Stat label="时间" value={goal.plannedTime ?? '不限'} />
      </dl>
      {latestTarget && goal.targetHistory.length > 1 && (
        <p className="text-tiny text-muted">
          目标量从 {formatLocalDateLabel(latestTarget.effectiveFrom)} 起按现在的设置算
        </p>
      )}
      {goal.fields && goal.fields.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {goal.fields.map((f) => (
            <Badge key={f.key} tone="custom">
              {f.label} · {FIELD_TYPE_LABEL[f.type]}
            </Badge>
          ))}
        </div>
      )}
      {!archived && (
        <GoalLinkButton href={`/goals/${goal.id}/checkin`} icon="check" className="w-full">
          去打卡
        </GoalLinkButton>
      )}
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-sunken flex min-w-0 flex-col gap-0.5 rounded-xl px-3 py-2">
      <dt className="text-tiny text-muted font-semibold">{label}</dt>
      <dd className="font-display text-subhead truncate font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

/** 归档 / 恢复、删除 */
function GoalManageCard({ goal, onDelete }: { goal: GoalDetail; onDelete: () => void }) {
  const update = useUpdateGoal(goal.id)
  const archived = goal.status === 'archived'

  function toggleArchive() {
    update.mutate(
      { status: archived ? 'active' : 'archived' },
      {
        onSuccess: () => toast.success(archived ? '目标恢复了，继续加油' : '已归档，历史都还在'),
        onError: (e) =>
          toast.error(isApiError(e) ? errorMessage(e) : errorMessage({ code: 'INTERNAL' })),
      },
    )
  }

  return (
    <Card variant="outline" className="flex flex-col gap-3">
      <div>
        <h3 className="text-subhead font-bold">管理目标</h3>
        <p className="text-caption text-muted">
          {archived
            ? '恢复后会重新出现在今天的打卡里'
            : '归档后不再出现在今天和打卡弹层里，历史保留，随时可以恢复'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" loading={update.isPending} onClick={toggleArchive}>
          {archived ? '恢复目标' : '归档'}
        </Button>
        <Button variant="danger" icon="trash" onClick={onDelete}>
          删除
        </Button>
      </div>
    </Card>
  )
}

function DeleteGoalDialog({
  goalId,
  title,
  open,
  onOpenChange,
}: {
  goalId: string
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const remove = useDeleteGoal(goalId)
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="danger"
      title={`删除「${title}」？`}
      description="这个目标的打卡记录会一起删掉，删了就找不回来了。只是暂时不做的话，可以先归档。"
      confirmLabel="删除"
      onConfirm={async () => {
        try {
          await remove.mutateAsync()
        } catch (e) {
          toast.error(isApiError(e) ? errorMessage(e) : errorMessage({ code: 'INTERNAL' }))
          throw e
        }
        toast.success('目标删掉了')
        router.replace('/goals')
      }}
    />
  )
}

function GoalDetailSkeleton() {
  return (
    <div role="status" aria-label="加载中" className="grid gap-3 @3xl:grid-cols-2">
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  )
}
