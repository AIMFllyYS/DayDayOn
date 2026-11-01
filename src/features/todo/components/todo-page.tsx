'use client'

import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import type { FormErrors } from '@/components/ui/form'
import { toast } from '@/components/ui/toast'
import type { Me } from '@/features/me/schemas'
import {
  apiFetch,
  errorMessage,
  isApiError,
  keys,
  newIdempotencyKey,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@/lib/api'
import {
  deleteTodoNow,
  doneTodosQuery,
  openTodosQuery,
  useCreateTodo,
  useUpdateTodo,
} from '@/lib/api/queries/todos'
import { BUSINESS_TIME_ZONE } from '@/lib/time'
import { pendingDeletes, usePendingDeletes } from '../pending-delete'
import { parseTodoView, type TodoView } from '../rules'
import type { Todo } from '../schemas'
import { useNow } from '../use-now'
import type { TodoSheetSubmit } from './todo-sheet'
import { TodoScreen } from './todo-screen'

/*
 * /todo 的客户端部分：读 ?view、取数据、接上勾选 / 新建 / 编辑 / 延迟删除，交给 TodoScreen 呈现。
 * 必须放在 <Suspense> 里（useSearchParams，Cache Components 规则）。
 */

// 抽屉代码不进首屏（ui-primitives.md 第 3 节）：第一次打开时才加载
const TodoSheet = dynamic(() => import('./todo-sheet').then((m) => m.TodoSheet))

/** 时区来自 GET /me（与外壳的 ThemeSync 共用同一份缓存） */
function useTimeZone(): { timeZone: string | null } {
  const me = useQuery({ queryKey: keys.me.detail(), queryFn: () => apiFetch<Me>('/me') })
  if (me.data) return { timeZone: me.data.profile.timeZone }
  // 取不到资料时退回北京时间，不让整页卡在加载中
  return { timeZone: me.isError ? BUSINESS_TIME_ZONE : null }
}

function messageOf(err: unknown): string {
  return errorMessage(isApiError(err) ? err : { code: 'INTERNAL' })
}

interface SheetState {
  open: boolean
  todo: Todo | null
  /** 新建：每次打开抽屉生成一个，重试时复用 */
  idempotencyKey: string
  /** 每次打开换一个，抽屉按它重新挂载、从 todo 初始化表单 */
  session: number
}

export function TodoPage() {
  const router = useRouter()
  const pathname = usePathname()
  const view = parseTodoView(useSearchParams().get('view'))
  const qc = useQueryClient()
  const now = useNow()
  const { timeZone } = useTimeZone()
  const hidden = usePendingDeletes()

  const open = useQuery({ ...openTodosQuery(), enabled: view === 'list' })
  const done = useInfiniteQuery({ ...doneTodosQuery(), enabled: view === 'list' })
  // 勾选和编辑各用一个 mutation：勾选进行中时，编辑抽屉的按钮不跟着转圈
  const toggle = useUpdateTodo()
  const update = useUpdateTodo()
  const create = useCreateTodo()

  const [sheet, setSheet] = useState<SheetState>({
    open: false,
    todo: null,
    idempotencyKey: '',
    session: 0,
  })
  const [loaded, setLoaded] = useState(false)
  const [serverErrors, setServerErrors] = useState<FormErrors>()

  function setView(next: TodoView) {
    router.replace(next === 'list' ? pathname : `${pathname}?view=${next}`, { scroll: false })
  }

  function openSheet(todo: Todo | null) {
    setLoaded(true)
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

  function onSubmit(value: TodoSheetSubmit) {
    const onError = (err: unknown) => {
      if (isApiError(err) && err.fields) return setServerErrors(err.fields)
      toast.error(messageOf(err))
    }
    if (value.kind === 'create') {
      create.mutate(
        { input: value.input, idempotencyKey: sheet.idempotencyKey },
        { onSuccess: closeSheet, onError },
      )
      return
    }
    const todo = sheet.todo
    if (!todo) return
    update.mutate({ todoId: todo.id, patch: value.patch }, { onSuccess: closeSheet, onError })
  }

  function onToggle(todo: Todo) {
    toggle.mutate(
      { todoId: todo.id, patch: { done: todo.doneAt === null } },
      { onError: (err) => toast.error(messageOf(err)) },
    )
  }

  function onDelete(todo: Todo) {
    pendingDeletes.add(todo.id)
    toast.undo('删掉了一条待办', {
      description: todo.title,
      onUndo: () => pendingDeletes.remove(todo.id),
      onExpire: () => {
        deleteTodoNow(qc, todo.id)
          .catch((err: unknown) => {
            toast.error(messageOf(err))
          })
          .finally(() => pendingDeletes.remove(todo.id))
      },
    })
  }

  const loading =
    now === null || timeZone === null || open.isPending || (done.isPending && !done.isError)
  const error = open.error ?? done.error
  const doneItems = done.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <>
      <TodoScreen
        view={view}
        onViewChange={setView}
        onCreate={() => openSheet(null)}
        status={error ? 'error' : loading ? 'loading' : 'ready'}
        errorText={error ? messageOf(error) : undefined}
        onRetry={() => {
          void open.refetch()
          void done.refetch()
        }}
        retrying={open.isRefetching || done.isRefetching}
        open={(open.data?.items ?? []).filter((t) => !hidden.has(t.id))}
        done={doneItems.filter((t) => !hidden.has(t.id))}
        doneHasMore={done.hasNextPage}
        onLoadMoreDone={() => void done.fetchNextPage()}
        loadingMoreDone={done.isFetchingNextPage}
        now={now ?? new Date(0)}
        timeZone={timeZone ?? BUSINESS_TIME_ZONE}
        onToggle={onToggle}
        onEdit={openSheet}
        onDelete={onDelete}
      />
      {loaded && timeZone !== null && (
        <TodoSheet
          key={sheet.session}
          open={sheet.open}
          onOpenChange={(next) => (next ? undefined : closeSheet())}
          todo={sheet.todo}
          timeZone={timeZone}
          submitting={create.isPending || update.isPending}
          serverErrors={serverErrors}
          onSubmit={onSubmit}
        />
      )}
    </>
  )
}
