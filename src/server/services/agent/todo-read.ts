import 'server-only'
import { and, eq } from 'drizzle-orm'
import { TODO_PRIORITY_META, dueStatus } from '@/features/todo/rules'
import type { Todo, TodoEventType, TodoPriority, TodoStatus } from '@/features/todo/schemas'
import { addDays, calendarDateOf } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import { db } from '@/server/db/client'
import { todoGroups } from '@/server/db/schema'
import { getTodoById, getTodoOverview, listTodoEvents, listTodos } from '@/server/services/todos'
import { loadUserTimeZone } from '@/server/services/todos/defaults'
import {
  previewDeleteTodo,
  previewTodoCreateLimits,
  previewTodoGroup,
  previewUpdateTodo,
  type PreviewTodoGroupInput,
  type PreviewUpdateTodoInput,
} from '@/server/services/todos/preview'

/*
 * Agent 待办专项只读查询适配层（独立封装，不与打卡 read.ts 混写）：
 * - 渐进式披露第 1 层：getAgentTodoOverview（轻量索引 + 计数 + Top 5 紧急待办）
 * - 渐进式披露第 2 层：listAgentTodos（按桶/分组/四象限/标签/关键词/创建日/截止日分页，精简投影 + 60 字备注预览）
 * - 渐进式披露第 3 层：getAgentTodoDetail（完整 2000 字备注 + 单条历程）与 getAgentTodoTimeline（过程事件流，覆盖已归档）
 * - 写操作草稿预检：previewAgentTodoUpdate / previewAgentTodoDelete / previewAgentTodoGroup（全部只读不写库）
 */

const NOTE_PREVIEW_MAX = 60

function trimNotePreview(note: string | null): string | null {
  if (!note) return null
  const single = note.replace(/\s+/g, ' ').trim()
  if (single.length <= NOTE_PREVIEW_MAX) return single
  return `${single.slice(0, NOTE_PREVIEW_MAX)}…`
}

function projectTodoLean(t: Todo, now: Date) {
  return {
    id: t.id,
    title: t.title,
    groupId: t.groupId,
    groupName: t.groupName,
    priority: t.priority,
    priorityLabel: TODO_PRIORITY_META[t.priority].label,
    tags: t.tags,
    status: t.status,
    dueAt: t.dueAt,
    dueStatus: t.status === 'open' ? dueStatus(t.dueAt, now) : 'none',
    createdAt: t.createdAt,
    doneAt: t.doneAt,
    abandonedAt: t.abandonedAt,
    abandonReason: t.abandonReason,
    isArchived: t.isArchived,
    hasNote: Boolean(t.note && t.note.length > 0),
    notePreview: trimNotePreview(t.note),
  }
}

/** 第 1 层：极轻量待办概览索引 */
export async function getAgentTodoOverview(userId: string, now: Date) {
  const [overview, overdue, urgent] = await Promise.all([
    getTodoOverview(db, userId, now),
    listTodos(db, userId, { status: 'overdue', limit: 3 }, now),
    listTodos(db, userId, { status: 'open', priority: 'urgent-important', limit: 5 }, now),
  ])

  const previewMap = new Map<string, ReturnType<typeof projectTodoLean>>()
  for (const t of overdue.items) {
    if (previewMap.size < 5) previewMap.set(t.id, projectTodoLean(t, now))
  }
  for (const t of urgent.items) {
    if (previewMap.size < 5 && !previewMap.has(t.id)) {
      previewMap.set(t.id, projectTodoLean(t, now))
    }
  }
  for (const t of overview.defaultGroupTodos.items) {
    if (previewMap.size < 5 && !previewMap.has(t.id)) {
      previewMap.set(t.id, projectTodoLean(t, now))
    }
  }

  return {
    groups: overview.groups.map((g) => ({
      id: g.id,
      name: g.name,
      isDefault: g.isDefault,
      openCount: g.openCount,
      soonCount: g.soonCount,
    })),
    counts: overview.counts,
    tags: overview.tags.map((t) => ({ id: t.id, name: t.name })),
    urgentPreview: [...previewMap.values()],
  }
}

/** 第 2 层：定向分页筛选待办（精简投影，不输出 2000 字完整备注） */
export async function listAgentTodos(
  userId: string,
  now: Date,
  params: {
    status?: TodoStatus
    groupId?: string
    groupName?: string
    priority?: TodoPriority
    tag?: string
    keyword?: string
    archivedOutcome?: 'done' | 'abandoned'
    from?: string
    to?: string
    dueFrom?: string
    dueTo?: string
    cursor?: string
    limit?: number
  },
) {
  let resolvedGroupId = params.groupId
  if (resolvedGroupId === undefined && params.groupName !== undefined) {
    const [group] = await db
      .select({ id: todoGroups.id })
      .from(todoGroups)
      .where(and(eq(todoGroups.userId, userId), eq(todoGroups.name, params.groupName.trim())))
      .limit(1)
    if (!group) {
      return {
        items: [],
        nextCursor: null,
        note: `未找到名为「${params.groupName}」的分组，可先调 getTodoOverview 查看全部分组名`,
      }
    }
    resolvedGroupId = group.id
  }

  const limit = Math.min(50, Math.max(1, params.limit ?? 20))
  const list = await listTodos(
    db,
    userId,
    {
      status: params.status ?? 'active',
      groupId: resolvedGroupId,
      priority: params.priority,
      tag: params.tag,
      keyword: params.keyword,
      archivedOutcome: params.archivedOutcome,
      from: params.from,
      to: params.to,
      dueFrom: params.dueFrom,
      dueTo: params.dueTo,
      cursor: params.cursor,
      limit,
    },
    now,
  )

  return {
    items: list.items.map((t) => projectTodoLean(t, now)),
    nextCursor: list.nextCursor,
  }
}

/** 第 3 层 A：读取单条待办完整详情（含完整 2000 字备注与最近 15 条历程事件） */
export async function getAgentTodoDetail(userId: string, now: Date, todoId: string) {
  try {
    const [todo, events] = await Promise.all([
      getTodoById(db, userId, todoId, now),
      listTodoEvents(db, userId, { todoId, limit: 15 }, now),
    ])
    return {
      found: true as const,
      todo: {
        ...todo,
        priorityLabel: TODO_PRIORITY_META[todo.priority].label,
      },
      recentEvents: events.items.map((e) => ({
        eventType: e.eventType,
        groupName: e.groupName,
        occurredAt: e.occurredAt,
        meta: e.meta,
      })),
    }
  } catch (err: unknown) {
    if (err instanceof ApiError && err.code === 'TODO_NOT_FOUND') {
      return {
        found: false as const,
        error: '没找到这条待办（可能已删除，可用 getTodoTimeline 查历史过程记录）',
      }
    }
    throw err
  }
}

/** 第 3 层 B：读取待办过程时间轴（天然包含已满 30 天自动归档的历史待办） */
export async function getAgentTodoTimeline(
  userId: string,
  now: Date,
  params: {
    todoId?: string
    eventType?: TodoEventType
    from?: string
    to?: string
    cursor?: string
    limit?: number
  },
) {
  let from = params.from
  let to = params.to
  if (params.todoId === undefined && from === undefined && to === undefined && !params.cursor) {
    const tz = await loadUserTimeZone(db, userId)
    const today = calendarDateOf(now, tz)
    from = addDays(today, -6)
    to = today
  }

  const limit = Math.min(60, Math.max(1, params.limit ?? 30))
  const res = await listTodoEvents(
    db,
    userId,
    {
      todoId: params.todoId,
      eventType: params.eventType,
      from,
      to,
      cursor: params.cursor,
      limit,
    },
    now,
  )

  return {
    events: res.items.map((e) => ({
      todoId: e.todoId,
      eventType: e.eventType,
      todoTitle: e.todoTitle,
      groupName: e.groupName,
      occurredAt: e.occurredAt,
      isArchived: e.isArchived,
      meta: e.meta,
    })),
    nextCursor: res.nextCursor,
  }
}

/** 供草稿工具解析分组是否存在（只读，不写库） */
export async function lookupUserTodoGroupByName(userId: string, groupName: string) {
  const trimmed = groupName.trim()
  const [group] = await db
    .select({ id: todoGroups.id, name: todoGroups.name })
    .from(todoGroups)
    .where(and(eq(todoGroups.userId, userId), eq(todoGroups.name, trimmed)))
    .limit(1)
  return group ?? null
}

export async function checkAgentTodoCreateLimits(userId: string, creatingNewGroup: boolean) {
  return previewTodoCreateLimits(db, userId, creatingNewGroup)
}

export async function previewAgentTodoUpdate(
  userId: string,
  input: PreviewUpdateTodoInput,
  now: Date,
) {
  return previewUpdateTodo(db, userId, input, now)
}

export async function previewAgentTodoDelete(
  userId: string,
  todoId: string,
  reason: string,
  now: Date,
) {
  return previewDeleteTodo(db, userId, todoId, reason, now)
}

export async function previewAgentTodoGroup(userId: string, input: PreviewTodoGroupInput) {
  return previewTodoGroup(db, userId, input)
}
