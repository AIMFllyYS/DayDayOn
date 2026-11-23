'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/field'
import type { FormErrors } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import type { Me } from '@/features/me/schemas'
import { apiFetch, errorMessage, isApiError, keys, useInfiniteQuery, useQuery } from '@/lib/api'
import {
  todoListQuery,
  todoOverviewQuery,
  useDeleteTodo,
  useUpdateTodo,
} from '@/lib/api/queries/todos'
import { cn } from '@/lib/cn'
import { BUSINESS_TIME_ZONE } from '@/lib/time'
import type { Todo, UpdateTodo } from '../schemas'
import { useNow } from '../use-now'
import { TodoRow } from './todo-row'
import type { TodoSheetSubmit } from './todo-sheet'

/*
 * 已归档待办独立单页（/todo/archived）：
 * - 展示完成或放弃满 30 天后自动归档的待办（不做手动归档）；
 * - 支持按「全部 / 已完成 / 已放弃」与关键词筛选；
 * - 点击待办主体打开管理抽屉查看 2000 字备注或恢复为进行中；删除均经 ConfirmDialog 二次确认。
 */

const TodoSheet = dynamic(() => import('./todo-sheet').then((m) => m.TodoSheet), {
  loading: () => null,
})
const ConfirmDialog = dynamic(
  () => import('@/components/ui/confirm-dialog').then((m) => m.ConfirmDialog),
  { loading: () => null },
)

type OutcomeFilter = 'all' | 'done' | 'abandoned'

const OUTCOMES: { value: OutcomeFilter; label: string }[] = [
  { value: 'all', label: '全部归档' },
  { value: 'done', label: '已完成归档' },
  { value: 'abandoned', label: '已放弃归档' },
]

function useTimeZone(): string {
  const me = useQuery({ queryKey: keys.me.detail(), queryFn: () => apiFetch<Me>('/me') })
  return me.data?.profile.timeZone ?? BUSINESS_TIME_ZONE
}

function messageOf(err: unknown): string {
  return errorMessage(isApiError(err) ? err : { code: 'INTERNAL' })
}

export function TodoArchivedPage() {
  const now = useNow()
  const timeZone = useTimeZone()
  const [outcome, setOutcome] = useState<OutcomeFilter>('all')
  const [keyword, setKeyword] = useState('')
  const trimmedKeyword = keyword.trim()

  const listQuery = useInfiniteQuery(
    todoListQuery('archived', {
      ...(outcome !== 'all' ? { archivedOutcome: outcome } : {}),
      ...(trimmedKeyword ? { keyword: trimmedKeyword } : {}),
    }),
  )
  const overviewQuery = useQuery(todoOverviewQuery())
  const update = useUpdateTodo()
  const remove = useDeleteTodo()

  const [editing, setEditing] = useState<Todo | null>(null)
  const [sheetSession, setSheetSession] = useState(0)
  const [sheetLoaded, setSheetLoaded] = useState(false)
  const [serverErrors, setServerErrors] = useState<FormErrors>()
  const [pendingDelete, setPendingDelete] = useState<Todo | null>(null)

  const items = listQuery.data?.pages.flatMap((p) => p.items) ?? []

  function openManage(todo: Todo) {
    setSheetLoaded(true)
    setServerErrors(undefined)
    setSheetSession((s) => s + 1)
    setEditing(todo)
  }

  function handleRestore(todo: Todo) {
    update.mutate(
      { todoId: todo.id, patch: { status: 'open' } },
      {
        onSuccess: () => {
          toast.success('已恢复')
          setEditing(null)
        },
        onError: (err) => toast.error(messageOf(err)),
      },
    )
  }

  function handleSubmit(value: TodoSheetSubmit) {
    if (value.kind !== 'update' || !editing) return
    update.mutate(
      { todoId: editing.id, patch: value.patch },
      {
        onSuccess: () => {
          toast.success('已保存修改')
          setEditing(null)
        },
        onError: (err) => {
          if (isApiError(err) && err.fields) return setServerErrors(err.fields)
          toast.error(messageOf(err))
        },
      },
    )
  }

  function handleQuickStatus(todo: Todo, patch: UpdateTodo) {
    update.mutate(
      { todoId: todo.id, patch },
      {
        onSuccess: () => {
          toast.success(patch.status === 'open' ? '已恢复' : '已更新状态')
          setEditing(null)
        },
        onError: (err) => toast.error(messageOf(err)),
      },
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-3 pb-10">
      <div className="flex flex-col gap-2">
        <p className="text-tiny text-muted px-0.5">
          已完成或已放弃满 30 天的待办会自动归档到这里，随时可查阅备注或重新恢复
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {OUTCOMES.map((opt) => {
            const active = outcome === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setOutcome(opt.value)}
                className={cn(
                  'ease-spring text-tiny shrink-0 rounded-full border px-2.5 py-1 font-semibold transition-colors duration-(--dur-fast) active:scale-95',
                  active
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-border bg-surface text-muted hover:bg-surface-sunken',
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        <Input
          aria-label="搜索已归档待办"
          value={keyword}
          maxLength={60}
          placeholder="按标题或备注关键词搜索…"
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      {listQuery.isPending || now === null ? (
        <div role="status" aria-label="加载中" className="grid gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : listQuery.isError ? (
        <ErrorState
          size="compact"
          title="已归档待办没加载出来"
          message={isApiError(listQuery.error) ? errorMessage(listQuery.error) : undefined}
          onRetry={() => void listQuery.refetch()}
          retrying={listQuery.isRefetching}
        />
      ) : items.length === 0 ? (
        <Card variant="sunken">
          <EmptyState
            size="compact"
            title="还没有已归档的待办"
            description="完成或放弃超过 30 天的待办会自动归档在这里"
          />
        </Card>
      ) : (
        <Card className="p-2">
          <ul className="divide-border/55 grid divide-y divide-dashed">
            {items.map((todo) => (
              <TodoRow
                key={todo.id}
                todo={todo}
                now={now}
                timeZone={timeZone}
                showGroupBadge
                onToggle={handleRestore}
                onOpenManage={openManage}
                onRequestDelete={setPendingDelete}
              />
            ))}
          </ul>
          {listQuery.hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button
                variant="ghost"
                size="sm"
                loading={listQuery.isFetchingNextPage}
                onClick={() => void listQuery.fetchNextPage()}
              >
                加载更多
              </Button>
            </div>
          )}
        </Card>
      )}

      {sheetLoaded && overviewQuery.data && now !== null && (
        <TodoSheet
          session={sheetSession}
          open={editing !== null}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          todo={editing}
          groups={overviewQuery.data.groups}
          defaultGroupId={overviewQuery.data.defaultGroupId}
          availableTags={overviewQuery.data.tags}
          timeZone={timeZone}
          now={now}
          submitting={update.isPending}
          serverErrors={serverErrors}
          onSubmit={handleSubmit}
          onQuickStatus={handleQuickStatus}
          onRequestDelete={(todo) => {
            setEditing(null)
            setPendingDelete(todo)
          }}
        />
      )}

      {pendingDelete !== null && (
        <ConfirmDialog
          open={pendingDelete !== null}
          onOpenChange={(next) => {
            if (!next) setPendingDelete(null)
          }}
          title="确定删除这条已归档待办？"
          description={`「${pendingDelete.title}」删除后无法恢复，过程时间轴会保留删除快照。`}
          confirmLabel="确认删除"
          cancelLabel="取消"
          tone="danger"
          onConfirm={async () => {
            const target = pendingDelete
            if (!target) return
            try {
              await remove.mutateAsync(target.id)
              toast.success('已删除')
              setPendingDelete(null)
            } catch (err) {
              toast.error(messageOf(err))
              throw err
            }
          }}
        />
      )}
    </div>
  )
}
