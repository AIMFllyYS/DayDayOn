'use client'

import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import type { FormErrors } from '@/components/ui/form'
import { toast } from '@/components/ui/toast'
import type { Me } from '@/features/me/schemas'
import { apiFetch, errorMessage, isApiError, keys, newIdempotencyKey, useQuery } from '@/lib/api'
import {
  todoOverviewQuery,
  useCreateTodo,
  useCreateTodoGroup,
  useDeleteTodo,
  useReorderTodoGroups,
  useReorderTodos,
  useUpdateTodo,
} from '@/lib/api/queries/todos'
import { BUSINESS_TIME_ZONE } from '@/lib/time'
import { parseTodoLayoutMode, parseTodoView, type TodoLayoutMode, type TodoView } from '../rules'
import type { Todo, UpdateTodo } from '../schemas'
import { useNow } from '../use-now'
import { TodoScreen } from './todo-screen'
import type { TodoSheetSubmit } from './todo-sheet'

/*
 * /todo 主页客户端容器：
 * - 读 ?view=list|log 与 ?mode=list|quadrant；
 * - 首屏仅发 1 次 todoOverviewQuery，默认只展开「默认待办」，其他分组与已过期/已完成/已放弃均默认折叠按需加载；
 * - 所有删除操作统一经过 ConfirmDialog 二次确认；
 * - 抽屉与弹窗按需懒加载（next/dynamic）。
 */

const TodoSheet = dynamic(() => import('./todo-sheet').then((m) => m.TodoSheet), {
  loading: () => null,
})
const TodoGroupManagerSheet = dynamic(
  () => import('./todo-group-manager-sheet').then((m) => m.TodoGroupManagerSheet),
  { loading: () => null },
)
const ConfirmDialog = dynamic(
  () => import('@/components/ui/confirm-dialog').then((m) => m.ConfirmDialog),
  { loading: () => null },
)

function useTimeZone(): { timeZone: string | null } {
  const me = useQuery({ queryKey: keys.me.detail(), queryFn: () => apiFetch<Me>('/me') })
  if (me.data) return { timeZone: me.data.profile.timeZone }
  return { timeZone: me.isError ? BUSINESS_TIME_ZONE : null }
}

function messageOf(err: unknown): string {
  return errorMessage(isApiError(err) ? err : { code: 'INTERNAL' })
}

interface SheetState {
  open: boolean
  todo: Todo | null
  idempotencyKey: string
  session: number
}

export function TodoPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const view = parseTodoView(searchParams.get('view'))
  const mode = parseTodoLayoutMode(searchParams.get('mode'))

  const now = useNow()
  const { timeZone } = useTimeZone()
  const [activeTag, setActiveTag] = useState<string | undefined>(undefined)

  const effectiveTag = mode === 'list' ? activeTag : undefined

  const overviewQuery = useQuery({
    ...todoOverviewQuery(effectiveTag),
    enabled: view === 'list',
  })

  const create = useCreateTodo()
  const createGroup = useCreateTodoGroup()
  const toggle = useUpdateTodo()
  const update = useUpdateTodo()
  const remove = useDeleteTodo()
  const reorderTodos = useReorderTodos()
  const reorderGroups = useReorderTodoGroups()

  // 折叠态管理：默认仅展开「默认待办」，其余自定义分组与已过期/已完成/已放弃均默认折叠
  const [manualToggled, setManualToggled] = useState<Record<string, boolean>>({})
  const [overdueOpen, setOverdueOpen] = useState(false)
  const [doneOpen, setDoneOpen] = useState(false)
  const [abandonedOpen, setAbandonedOpen] = useState(false)

  const [sheet, setSheet] = useState<SheetState>({
    open: false,
    todo: null,
    idempotencyKey: '',
    session: 0,
  })
  const [sheetLoaded, setSheetLoaded] = useState(false)
  const [serverErrors, setServerErrors] = useState<FormErrors>()

  const [groupManagerOpen, setGroupManagerOpen] = useState(false)
  const [groupManagerLoaded, setGroupManagerLoaded] = useState(false)

  const [pendingDelete, setPendingDelete] = useState<Todo | null>(null)
  const [deleteDialogLoaded, setDeleteDialogLoaded] = useState(false)

  const overview = overviewQuery.data
  const expandedGroups = new Set<string>()
  if (overview) {
    for (const g of overview.groups) {
      const explicit = manualToggled[g.id]
      if (explicit !== undefined ? explicit : g.id === overview.defaultGroupId) {
        expandedGroups.add(g.id)
      }
    }
  }

  function updateUrl(nextView: TodoView, nextMode: TodoLayoutMode) {
    const params = new URLSearchParams()
    if (nextView !== 'list') params.set('view', nextView)
    if (nextMode !== 'list') params.set('mode', nextMode)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  function openSheet(todo: Todo | null) {
    setSheetLoaded(true)
    setServerErrors(undefined)
    setSheet((s) => ({
      open: true,
      todo,
      idempotencyKey: newIdempotencyKey(),
      session: s.session + 1,
    }))
  }

  function closeSheet() {
    setSheet((s) => ({ ...s, open: false }))
  }

  function handleSubmit(value: TodoSheetSubmit) {
    const onError = (err: unknown) => {
      if (isApiError(err) && err.fields) return setServerErrors(err.fields)
      toast.error(messageOf(err))
    }
    if (value.kind === 'create') {
      create.mutate(
        { input: value.input, idempotencyKey: sheet.idempotencyKey },
        {
          onSuccess: (created) => {
            // 新建待办落入某个折叠分组时自动展开该分组方便看到刚建的条目
            setManualToggled((prev) => ({ ...prev, [created.groupId]: true }))
            closeSheet()
          },
          onError,
        },
      )
      return
    }
    const todo = sheet.todo
    if (!todo) return
    update.mutate(
      { todoId: todo.id, patch: value.patch },
      {
        onSuccess: () => {
          toast.success('已保存修改')
          closeSheet()
        },
        onError,
      },
    )
  }

  function handleQuickStatus(todo: Todo, patch: UpdateTodo) {
    update.mutate(
      { todoId: todo.id, patch },
      {
        onSuccess: () => {
          if (patch.status === 'done') toast.success('已完成，已移入「已完成」分组')
          else if (patch.status === 'abandoned') toast.info('已放弃，已移入「已放弃」分组')
          else if (patch.status === 'open') toast.success('已恢复为进行中待办')
          closeSheet()
        },
        onError: (err) => toast.error(messageOf(err)),
      },
    )
  }

  function handleToggleTodo(todo: Todo) {
    const nextStatus = todo.status === 'open' ? 'done' : 'open'
    toggle.mutate(
      { todoId: todo.id, patch: { status: nextStatus } },
      {
        onSuccess: () => {
          if (nextStatus === 'done') {
            toast.undo('已完成一项待办', {
              description: `${todo.title} · 已移入「已完成」`,
              onUndo: () => {
                toggle.mutate(
                  { todoId: todo.id, patch: { status: 'open' } },
                  { onError: (err) => toast.error(messageOf(err)) },
                )
              },
            })
          }
        },
        onError: (err) => toast.error(messageOf(err)),
      },
    )
  }

  function requestDelete(todo: Todo) {
    setDeleteDialogLoaded(true)
    setPendingDelete(todo)
  }

  const loading = now === null || timeZone === null || overviewQuery.isPending
  const error = overviewQuery.error
  const fabHidden = sheet.open || groupManagerOpen || pendingDelete !== null

  return (
    <>
      <TodoScreen
        view={view}
        onViewChange={(next) => updateUrl(next, mode)}
        mode={mode}
        onModeChange={(next) => {
          if (next === 'quadrant') setActiveTag(undefined)
          updateUrl(view, next)
        }}
        activeTag={effectiveTag}
        onTagChange={setActiveTag}
        onCreate={() => openSheet(null)}
        onOpenGroupManager={() => {
          setGroupManagerLoaded(true)
          setGroupManagerOpen(true)
        }}
        onNavigateArchived={() => router.push('/todo/archived')}
        status={error ? 'error' : loading ? 'loading' : 'ready'}
        errorText={error ? messageOf(error) : undefined}
        onRetry={() => void overviewQuery.refetch()}
        retrying={overviewQuery.isRefetching}
        overview={overview}
        expandedGroups={expandedGroups}
        onToggleGroup={(groupId) =>
          setManualToggled((prev) => {
            const current =
              prev[groupId] !== undefined ? prev[groupId] : groupId === overview?.defaultGroupId
            return { ...prev, [groupId]: !current }
          })
        }
        onExpandAllGroups={() => {
          if (!overview) return
          const next: Record<string, boolean> = {}
          for (const g of overview.groups) next[g.id] = true
          setManualToggled(next)
        }}
        onCollapseAllGroups={() => {
          if (!overview) return
          const next: Record<string, boolean> = {}
          for (const g of overview.groups) next[g.id] = false
          setManualToggled(next)
          setOverdueOpen(false)
          setDoneOpen(false)
          setAbandonedOpen(false)
        }}
        overdueOpen={overdueOpen}
        onToggleOverdue={() => setOverdueOpen((v) => !v)}
        doneOpen={doneOpen}
        onToggleDone={() => setDoneOpen((v) => !v)}
        abandonedOpen={abandonedOpen}
        onToggleAbandoned={() => setAbandonedOpen((v) => !v)}
        now={now ?? new Date(0)}
        timeZone={timeZone ?? BUSINESS_TIME_ZONE}
        onToggleTodo={handleToggleTodo}
        onOpenManage={openSheet}
        onRequestDelete={requestDelete}
        onReorderTodos={(groupId, todoIds) =>
          reorderTodos.mutate(
            { groupId, todoIds },
            { onError: (err) => toast.error(messageOf(err)) },
          )
        }
        onReorderGroups={(groupIds) =>
          reorderGroups.mutate({ groupIds }, { onError: (err) => toast.error(messageOf(err)) })
        }
        fabHidden={fabHidden}
      />

      {sheetLoaded && timeZone !== null && overview && (
        <TodoSheet
          session={sheet.session}
          open={sheet.open}
          onOpenChange={(next) => (next ? undefined : closeSheet())}
          todo={sheet.todo}
          groups={overview.groups}
          defaultGroupId={overview.defaultGroupId}
          availableTags={overview.tags}
          timeZone={timeZone}
          now={now ?? new Date()}
          submitting={create.isPending || update.isPending}
          serverErrors={serverErrors}
          onSubmit={handleSubmit}
          onCreateGroup={async (name) => {
            try {
              const created = await createGroup.mutateAsync({
                input: { name },
                idempotencyKey: newIdempotencyKey(),
              })
              toast.success(`已新建分组「${created.name}」`)
              return created
            } catch (err) {
              toast.error(messageOf(err))
              return null
            }
          }}
          onQuickStatus={handleQuickStatus}
          onRequestDelete={(todo) => {
            closeSheet()
            requestDelete(todo)
          }}
        />
      )}

      {groupManagerLoaded && overview && (
        <TodoGroupManagerSheet
          open={groupManagerOpen}
          onOpenChange={setGroupManagerOpen}
          groups={overview.groups}
        />
      )}

      {deleteDialogLoaded && (
        <ConfirmDialog
          open={pendingDelete !== null}
          onOpenChange={(next) => {
            if (!next) setPendingDelete(null)
          }}
          title="确定删除这条待办？"
          description={
            pendingDelete
              ? `「${pendingDelete.title}」删除后无法直接恢复，但会保留在过程记录中。`
              : undefined
          }
          confirmLabel="确认删除"
          cancelLabel="取消"
          tone="danger"
          onConfirm={async () => {
            const target = pendingDelete
            if (!target) return
            try {
              await remove.mutateAsync(target.id)
              toast.success('已删除这条待办')
              setPendingDelete(null)
            } catch (err) {
              toast.error(messageOf(err))
              throw err
            }
          }}
        />
      )}
    </>
  )
}
