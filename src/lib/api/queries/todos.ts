import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import type {
  CreateTodo,
  CreateTodoGroup,
  ReorderTodoGroups,
  ReorderTodos,
  Todo,
  TodoEventList,
  TodoEventType,
  TodoGroup,
  TodoGroupList,
  TodoList,
  TodoOverview,
  TodoPriority,
  TodoStatus,
  UpdateTodo,
  UpdateTodoGroup,
} from '@/features/todo/schemas'
import { api, unwrap } from '../client'
import { isApiError } from '../fetcher'
import { keys } from '../keys'

/*
 * 待办查询与写操作（Todo v2，独立收口于 queries/todos.ts）：
 * - 首屏仅发 todoOverviewQuery（staleTime 60s），返回分组目录+计数+「默认待办」首批 20 条；
 * - 其他自定义分组、已过期、已完成、已放弃均走按需 infiniteQuery（折叠时不发请求）；
 * - 所有变更结束后使用 refetchType: 'active' 精准失效，避免唤醒未展开的折叠面板重拉。
 */

const v1 = api.api.v1

export const TODO_PAGE_SIZE = 20
export const TODO_TIMELINE_PAGE_SIZE = 30
export const TODO_OVERVIEW_STALE_MS = 60_000

export const todoOverviewQuery = (tag?: string) =>
  queryOptions({
    queryKey: keys.todos.overview(tag),
    queryFn: () =>
      unwrap(
        v1.todos.overview.$get({
          query: tag ? { tag } : {},
        }),
      ) as Promise<TodoOverview>,
    staleTime: TODO_OVERVIEW_STALE_MS,
  })

export interface TodoBucketFilter {
  groupId?: string
  priority?: TodoPriority
  tag?: string
  keyword?: string
  archivedOutcome?: 'done' | 'abandoned'
}

export const todoListQuery = (status: TodoStatus, filter: TodoBucketFilter = {}) =>
  infiniteQueryOptions({
    queryKey: keys.todos.list(status, filter),
    queryFn: ({ pageParam }) =>
      unwrap(
        v1.todos.$get({
          query: {
            status,
            limit: String(TODO_PAGE_SIZE),
            ...(filter.groupId ? { groupId: filter.groupId } : {}),
            ...(filter.priority ? { priority: filter.priority } : {}),
            ...(filter.tag ? { tag: filter.tag } : {}),
            ...(filter.keyword ? { keyword: filter.keyword } : {}),
            ...(filter.archivedOutcome ? { archivedOutcome: filter.archivedOutcome } : {}),
            ...(pageParam ? { cursor: pageParam } : {}),
          },
        }),
      ) as Promise<TodoList>,
    initialPageParam: null as string | null,
    getNextPageParam: (last: TodoList) => last.nextCursor,
  })

export const todoDetailQuery = (todoId: string) =>
  queryOptions({
    queryKey: keys.todos.detail(todoId),
    queryFn: () => unwrap(v1.todos[':todoId'].$get({ param: { todoId } })) as Promise<Todo>,
  })

export const todoEventsQuery = (filter: { todoId?: string; eventType?: TodoEventType } = {}) =>
  infiniteQueryOptions({
    queryKey: keys.todos.events(filter),
    queryFn: ({ pageParam }) =>
      unwrap(
        v1.todos.events.$get({
          query: {
            limit: String(TODO_TIMELINE_PAGE_SIZE),
            ...(filter.todoId ? { todoId: filter.todoId } : {}),
            ...(filter.eventType ? { eventType: filter.eventType } : {}),
            ...(pageParam ? { cursor: pageParam } : {}),
          },
        }),
      ) as Promise<TodoEventList>,
    initialPageParam: null as string | null,
    getNextPageParam: (last: TodoEventList) => last.nextCursor,
  })

/** 仅刷新当前活跃（已展开/已挂载）的待办相关查询，绝不惊动已折叠面板 */
function invalidateActiveTodos(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: keys.todos.all, refetchType: 'active' })
}

export function useCreateTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateTodo; idempotencyKey: string }) =>
      unwrap(
        v1.todos.$post({ json: input, header: { 'idempotency-key': idempotencyKey } }),
      ) as Promise<Todo>,
    onSettled: () => invalidateActiveTodos(qc),
  })
}

export interface UpdateTodoVars {
  todoId: string
  patch: UpdateTodo
}

/** 乐观移除/替换当前活跃列表中的对应待办（点击打卡圆圈或放弃时零延迟反馈） */
function applyOptimisticUpdate(qc: QueryClient, todoId: string, patch: UpdateTodo) {
  const targetStatus =
    patch.status ?? (patch.done !== undefined ? (patch.done ? 'done' : 'open') : undefined)
  if (targetStatus === undefined) return

  // 更新概览缓存中的默认组条目与计数
  const overviewEntries = qc.getQueriesData<TodoOverview>({ queryKey: ['todos', 'overview'] })
  for (const [key, data] of overviewEntries) {
    if (!data) continue
    const existed = data.defaultGroupTodos.items.find((t) => t.id === todoId)
    if (!existed) continue
    if (targetStatus !== 'open') {
      const nextItems = data.defaultGroupTodos.items.filter((t) => t.id !== todoId)
      const groups = data.groups.map((g) =>
        g.id === existed.groupId ? { ...g, openCount: Math.max(0, g.openCount - 1) } : g,
      )
      qc.setQueryData<TodoOverview>(key, {
        ...data,
        groups,
        counts: {
          ...data.counts,
          openTotal: Math.max(0, data.counts.openTotal - 1),
          ...(targetStatus === 'done'
            ? { doneRecentCount: data.counts.doneRecentCount + 1 }
            : { abandonedRecentCount: data.counts.abandonedRecentCount + 1 }),
        },
        defaultGroupTodos: { ...data.defaultGroupTodos, items: nextItems },
      })
    }
  }

  // 从已展开的分页列表中同步移除状态变更条目
  const listEntries = qc.getQueriesData<InfiniteData<TodoList, string | null>>({
    queryKey: ['todos', 'list'],
  })
  for (const [key, data] of listEntries) {
    if (!data) continue
    const hit = data.pages.some((p) => p.items.some((t) => t.id === todoId))
    if (!hit) continue
    qc.setQueryData<InfiniteData<TodoList, string | null>>(key, {
      ...data,
      pages: data.pages.map((p) => ({
        ...p,
        items: p.items.filter((t) => t.id !== todoId),
      })),
    })
  }
}

export function useUpdateTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ todoId, patch }: UpdateTodoVars) =>
      unwrap(v1.todos[':todoId'].$patch({ param: { todoId }, json: patch })) as Promise<Todo>,
    onMutate: async ({ todoId, patch }) => {
      await qc.cancelQueries({ queryKey: keys.todos.all })
      const prevOverviews = qc.getQueriesData<TodoOverview>({ queryKey: ['todos', 'overview'] })
      const prevLists = qc.getQueriesData<InfiniteData<TodoList, string | null>>({
        queryKey: ['todos', 'list'],
      })
      applyOptimisticUpdate(qc, todoId, patch)
      return { prevOverviews, prevLists }
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return
      for (const [key, data] of ctx.prevOverviews) qc.setQueryData(key, data)
      for (const [key, data] of ctx.prevLists) qc.setQueryData(key, data)
    },
    onSettled: () => invalidateActiveTodos(qc),
  })
}

/** 二次确认后立即删除待办 */
export function useDeleteTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (todoId: string) => {
      try {
        await unwrap(v1.todos[':todoId'].$delete({ param: { todoId } }))
      } catch (err) {
        if (!(isApiError(err) && err.code === 'TODO_NOT_FOUND')) throw err
      }
    },
    onSettled: () => invalidateActiveTodos(qc),
  })
}

/** 组内长按拖拽排序（乐观更新缓存） */
export function useReorderTodos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ReorderTodos) =>
      unwrap(v1.todos.reorder.$post({ json: input })) as Promise<{ ok: true }>,
    onMutate: async ({ groupId, todoIds }) => {
      await qc.cancelQueries({ queryKey: keys.todos.all })
      const prevOverviews = qc.getQueriesData<TodoOverview>({ queryKey: ['todos', 'overview'] })
      const prevLists = qc.getQueriesData<InfiniteData<TodoList, string | null>>({
        queryKey: ['todos', 'list'],
      })

      const orderMap = new Map(todoIds.map((id, idx) => [id, idx]))
      const sortByIds = (items: Todo[]) =>
        [...items]
          .sort((a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999))
          .map((t, idx) => ({ ...t, sortOrder: idx }))

      for (const [key, data] of prevOverviews) {
        if (!data || data.defaultGroupId !== groupId) continue
        qc.setQueryData<TodoOverview>(key, {
          ...data,
          defaultGroupTodos: {
            ...data.defaultGroupTodos,
            items: sortByIds(data.defaultGroupTodos.items),
          },
        })
      }

      for (const [key, data] of prevLists) {
        if (!data) continue
        const meta = key[2] as { status?: string; groupId?: string } | undefined
        if (meta?.status !== 'open' || meta.groupId !== groupId) continue
        const flat = sortByIds(data.pages.flatMap((p) => p.items))
        let offset = 0
        qc.setQueryData<InfiniteData<TodoList, string | null>>(key, {
          ...data,
          pages: data.pages.map((p) => {
            const slice = flat.slice(offset, offset + p.items.length)
            offset += p.items.length
            return { ...p, items: slice }
          }),
        })
      }

      return { prevOverviews, prevLists }
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return
      for (const [key, data] of ctx.prevOverviews) qc.setQueryData(key, data)
      for (const [key, data] of ctx.prevLists) qc.setQueryData(key, data)
    },
    onSettled: () => invalidateActiveTodos(qc),
  })
}

export function useCreateTodoGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateTodoGroup; idempotencyKey: string }) =>
      unwrap(
        v1['todo-groups'].$post({ json: input, header: { 'idempotency-key': idempotencyKey } }),
      ) as Promise<TodoGroup>,
    onSettled: () => invalidateActiveTodos(qc),
  })
}

export function useUpdateTodoGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ groupId, input }: { groupId: string; input: UpdateTodoGroup }) =>
      unwrap(
        v1['todo-groups'][':groupId'].$patch({ param: { groupId }, json: input }),
      ) as Promise<TodoGroup>,
    onSettled: () => invalidateActiveTodos(qc),
  })
}

export function useDeleteTodoGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (groupId: string) =>
      unwrap(v1['todo-groups'][':groupId'].$delete({ param: { groupId } })),
    onSettled: () => invalidateActiveTodos(qc),
  })
}

/** 分组长按拖拽排序（乐观重排概览里的 groups 顺序） */
export function useReorderTodoGroups() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ReorderTodoGroups) =>
      unwrap(v1['todo-groups'].reorder.$post({ json: input })) as Promise<TodoGroupList>,
    onMutate: async ({ groupIds }) => {
      await qc.cancelQueries({ queryKey: keys.todos.all })
      const prevOverviews = qc.getQueriesData<TodoOverview>({ queryKey: ['todos', 'overview'] })
      const orderMap = new Map(groupIds.map((id, idx) => [id, idx]))

      for (const [key, data] of prevOverviews) {
        if (!data) continue
        const nextGroups = [...data.groups]
          .sort((a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999))
          .map((g, idx) => ({ ...g, sortOrder: idx }))
        qc.setQueryData<TodoOverview>(key, { ...data, groups: nextGroups })
      }
      return { prevOverviews }
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return
      for (const [key, data] of ctx.prevOverviews) qc.setQueryData(key, data)
    },
    onSettled: () => invalidateActiveTodos(qc),
  })
}
