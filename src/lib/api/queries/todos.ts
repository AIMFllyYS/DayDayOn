import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import type { CreateTodo, Todo, TodoList, UpdateTodo } from '@/features/todo/schemas'
import { compareDoneTodos, sortOpenTodos } from '@/features/todo/rules'
import { api, unwrap } from '../client'
import { apiFetch, isApiError } from '../fetcher'
import { keys } from '../keys'

/*
 * 待办的查询与写操作（client-data-and-forms.md 第 3、5 节，PRD 2.10）。
 * - 进行中：一次取全（上限 500）；已完成：游标分页（最近 30 天）。
 * - 勾选是乐观更新：先把条目在两个列表之间挪动，失败回滚，结束后失效刷新。
 * - 删除是"延迟删除"：界面先隐藏（features/todo/pending-delete.ts），5 秒撤销窗口过后才真正发 DELETE。
 */

const v1 = api.api.v1

export const openTodosQuery = () =>
  queryOptions({
    queryKey: keys.todos.list('open'),
    queryFn: () => unwrap(v1.todos.$get({ query: { status: 'open' } })),
  })

export const DONE_PAGE_SIZE = 20

export const doneTodosQuery = () =>
  infiniteQueryOptions({
    queryKey: keys.todos.list('done'),
    queryFn: ({ pageParam }) =>
      unwrap(
        v1.todos.$get({
          query: {
            status: 'done',
            limit: String(DONE_PAGE_SIZE),
            ...(pageParam ? { cursor: pageParam } : {}),
          },
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last: TodoList) => last.nextCursor,
  })

type DonePages = InfiniteData<TodoList, string | null>

interface Snapshot {
  open: TodoList | undefined
  done: DonePages | undefined
}

async function snapshot(qc: QueryClient): Promise<Snapshot> {
  await qc.cancelQueries({ queryKey: keys.todos.all })
  return {
    open: qc.getQueryData<TodoList>(keys.todos.list('open')),
    done: qc.getQueryData<DonePages>(keys.todos.list('done')),
  }
}

function restore(qc: QueryClient, s: Snapshot) {
  qc.setQueryData(keys.todos.list('open'), s.open)
  qc.setQueryData(keys.todos.list('done'), s.done)
}

/** 从两个列表里拿掉某条 */
function removeEverywhere(qc: QueryClient, todoId: string) {
  qc.setQueryData<TodoList>(keys.todos.list('open'), (old) =>
    old ? { ...old, items: old.items.filter((t) => t.id !== todoId) } : old,
  )
  qc.setQueryData<DonePages>(keys.todos.list('done'), (old) =>
    old
      ? {
          ...old,
          pages: old.pages.map((p) => ({ ...p, items: p.items.filter((t) => t.id !== todoId) })),
        }
      : old,
  )
}

/** 把一条放进它所属的列表（按 doneAt 判断），保持排序 */
function placeTodo(qc: QueryClient, todo: Todo) {
  removeEverywhere(qc, todo.id)
  if (todo.doneAt === null) {
    qc.setQueryData<TodoList>(keys.todos.list('open'), (old) =>
      old ? { ...old, items: sortOpenTodos([...old.items, todo]) } : old,
    )
    return
  }
  qc.setQueryData<DonePages>(keys.todos.list('done'), (old) => {
    if (!old) return old
    const [first, ...rest] = old.pages
    if (!first) return old
    const items = [...first.items, todo].sort(compareDoneTodos)
    return { ...old, pages: [{ ...first, items }, ...rest] }
  })
}

function findTodo(qc: QueryClient, todoId: string): Todo | undefined {
  const open = qc.getQueryData<TodoList>(keys.todos.list('open'))
  const hit = open?.items.find((t) => t.id === todoId)
  if (hit) return hit
  const done = qc.getQueryData<DonePages>(keys.todos.list('done'))
  for (const page of done?.pages ?? []) {
    const d = page.items.find((t) => t.id === todoId)
    if (d) return d
  }
  return undefined
}

export function useCreateTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateTodo; idempotencyKey: string }) =>
      unwrap(
        v1.todos.$post({ json: input, header: { 'idempotency-key': idempotencyKey } }),
      ) as Promise<Todo>,
    onSuccess: (todo) => placeTodo(qc, todo),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.todos.all }),
  })
}

export interface UpdateTodoVars {
  todoId: string
  patch: UpdateTodo
}

/** 修改 / 勾选：乐观更新，失败回滚 */
export function useUpdateTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ todoId, patch }: UpdateTodoVars) =>
      unwrap(v1.todos[':todoId'].$patch({ param: { todoId }, json: patch })) as Promise<Todo>,
    onMutate: async ({ todoId, patch }) => {
      const before = await snapshot(qc)
      const current = findTodo(qc, todoId)
      if (current) {
        const next: Todo = {
          ...current,
          ...(patch.title !== undefined && { title: patch.title }),
          ...(patch.dueAt !== undefined && { dueAt: patch.dueAt }),
          ...(patch.priority !== undefined && { priority: patch.priority }),
          ...(patch.done !== undefined && {
            doneAt: patch.done ? (current.doneAt ?? new Date().toISOString()) : null,
          }),
        }
        placeTodo(qc, next)
      }
      return { before }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) restore(qc, ctx.before)
    },
    onSuccess: (todo) => placeTodo(qc, todo),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.todos.all }),
  })
}

/**
 * 真正发 DELETE（撤销窗口过后才调用）。不做成 hook：撤销提示是全局的，
 * 窗口结束时页面可能已经切走，组件里的 mutation 回调不会再执行。
 * 404 TODO_NOT_FOUND 视为已经删掉（例如页面关闭时已经发过一次）。
 */
export async function deleteTodoNow(qc: QueryClient, todoId: string): Promise<void> {
  try {
    await unwrap(v1.todos[':todoId'].$delete({ param: { todoId } }))
  } catch (err) {
    if (!(isApiError(err) && err.code === 'TODO_NOT_FOUND')) throw err
  } finally {
    await qc.invalidateQueries({ queryKey: keys.todos.all })
  }
}

/**
 * 页面关闭时把还在撤销窗口里的删除发出去（keepalive：页面卸载后请求照常完成）。
 * 只在 pagehide 里调用；失败无从提示，下次打开时那条还在，用户可以再删。
 */
export function flushTodoDeletes(todoIds: readonly string[]) {
  for (const todoId of todoIds) {
    void apiFetch(`/todos/${encodeURIComponent(todoId)}`, {
      method: 'DELETE',
      keepalive: true,
    }).catch(() => undefined)
  }
}
