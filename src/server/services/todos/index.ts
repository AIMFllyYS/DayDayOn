import 'server-only'
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm'
import {
  TODO_OPEN_LIMIT,
  type CreateTodo,
  type ReorderTodos,
  type Todo,
  type TodoEventMeta,
  type TodoLifecycleStatus,
  type TodoList,
  type TodoListQuery,
  type UpdateTodo,
} from '@/features/todo/schemas'
import { archiveCutoff, isAutoArchived } from '@/features/todo/rules'
import { addDays, combineLocal } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import type { DbOrTx, Tx } from '@/server/db/client'
import { todoGroups, todos } from '@/server/db/schema'
import { decodeOpenCursor, decodeTimeCursor, encodeOpenCursor, encodeTimeCursor } from './cursor'
import {
  appendTodoEvent,
  loadUserTimeZone,
  lockUserTodos,
  resolveOrCreateGroup,
  syncUserTodoTags,
} from './defaults'

export { ensureDefaultTodoGroup } from './defaults'
export {
  createTodoGroup,
  deleteTodoGroup,
  deleteTodoTag,
  listTodoGroups,
  listTodoTags,
  reorderTodoGroups,
  updateTodoGroup,
} from './groups'
export { getTodoOverview } from './overview'
export { listTodoEvents } from './timeline'

/*
 * 待办核心服务（Todo v2）：
 * - 列表分页：open（组内未过期，按 sortOrder/dueAt/createdAt）、overdue（未完成已过期）、
 *   done（近 30 天已完成）、abandoned（近 30 天已放弃）、archived（满 30 天自动归档）、
 *   quadrant（四象限全部进行中，按创建时间由近到远）。
 * - 写操作：事务内维护分组、标签词库、未完成上限与 todo_events 过程留痕。
 */

const joinedColumns = {
  id: todos.id,
  groupId: todos.groupId,
  groupName: todoGroups.name,
  title: todos.title,
  note: todos.note,
  dueAt: todos.dueAt,
  priority: todos.priority,
  tags: todos.tags,
  status: todos.status,
  doneAt: todos.doneAt,
  abandonedAt: todos.abandonedAt,
  abandonReason: todos.abandonReason,
  settledAt: todos.settledAt,
  sortOrder: todos.sortOrder,
  createdAt: todos.createdAt,
  updatedAt: todos.updatedAt,
}

type JoinedRow = {
  id: string
  groupId: string
  groupName: string
  title: string
  note: string | null
  dueAt: Date | null
  priority: Todo['priority']
  tags: string[]
  status: TodoLifecycleStatus
  doneAt: Date | null
  abandonedAt: Date | null
  abandonReason: string | null
  settledAt: Date | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export function toTodoDto(row: JoinedRow, now: Date): Todo {
  const doneAt = row.doneAt?.toISOString() ?? null
  const abandonedAt = row.abandonedAt?.toISOString() ?? null
  const settledAt = row.settledAt?.toISOString() ?? null
  return {
    id: row.id,
    groupId: row.groupId,
    groupName: row.groupName,
    title: row.title,
    note: row.note,
    dueAt: row.dueAt?.toISOString() ?? null,
    priority: row.priority,
    tags: row.tags,
    status: row.status,
    doneAt,
    abandonedAt,
    abandonReason: row.abandonReason,
    settledAt,
    isArchived: isAutoArchived({ status: row.status, settledAt, doneAt, abandonedAt }, now),
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function escapeLike(raw: string): string {
  return raw.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')
}

/** 构造 open / overdue 升序游标过滤条件：(sortOrder ASC, dueAt ASC NULLS LAST, createdAt ASC, id ASC) */
function openCursorCondition(cursor: {
  sortOrder: number
  dueAt: string | null
  createdAt: string
  id: string
}) {
  const createdAt = new Date(cursor.createdAt)
  if (cursor.dueAt === null) {
    return or(
      gt(todos.sortOrder, cursor.sortOrder),
      and(
        eq(todos.sortOrder, cursor.sortOrder),
        isNull(todos.dueAt),
        gt(todos.createdAt, createdAt),
      ),
      and(
        eq(todos.sortOrder, cursor.sortOrder),
        isNull(todos.dueAt),
        eq(todos.createdAt, createdAt),
        gt(todos.id, cursor.id),
      ),
    )
  }
  const dueAt = new Date(cursor.dueAt)
  return or(
    gt(todos.sortOrder, cursor.sortOrder),
    and(eq(todos.sortOrder, cursor.sortOrder), isNull(todos.dueAt)),
    and(eq(todos.sortOrder, cursor.sortOrder), gt(todos.dueAt, dueAt)),
    and(
      eq(todos.sortOrder, cursor.sortOrder),
      eq(todos.dueAt, dueAt),
      gt(todos.createdAt, createdAt),
    ),
    and(
      eq(todos.sortOrder, cursor.sortOrder),
      eq(todos.dueAt, dueAt),
      eq(todos.createdAt, createdAt),
      gt(todos.id, cursor.id),
    ),
  )
}

export async function listTodos(
  db: DbOrTx,
  userId: string,
  query: TodoListQuery,
  now: Date,
): Promise<TodoList> {
  const conditions = [eq(todos.userId, userId)]

  if (query.groupId !== undefined) {
    conditions.push(eq(todos.groupId, query.groupId))
  }
  if (query.priority !== undefined) {
    conditions.push(eq(todos.priority, query.priority))
  }
  if (query.tag !== undefined) {
    conditions.push(sql`${todos.tags} @> ${JSON.stringify([query.tag])}::jsonb`)
  }
  if (query.keyword !== undefined) {
    const pattern = `%${escapeLike(query.keyword)}%`
    const kw = or(ilike(todos.title, pattern), ilike(todos.note, pattern))
    if (kw) conditions.push(kw)
  }

  // 可选本地日期范围筛选（from/to：进行中按 createdAt、终态按 settledAt；dueFrom/dueTo：按截止时间 dueAt）
  if (
    query.from !== undefined ||
    query.to !== undefined ||
    query.dueFrom !== undefined ||
    query.dueTo !== undefined
  ) {
    const timeZone = await loadUserTimeZone(db, userId)
    if (query.from !== undefined || query.to !== undefined) {
      const timeCol =
        query.status === 'done' || query.status === 'abandoned' || query.status === 'archived'
          ? todos.settledAt
          : todos.createdAt
      if (query.from !== undefined) {
        conditions.push(gte(timeCol, combineLocal(query.from, '00:00', timeZone)))
      }
      if (query.to !== undefined) {
        conditions.push(lt(timeCol, combineLocal(addDays(query.to, 1), '00:00', timeZone)))
      }
    }
    if (query.dueFrom !== undefined || query.dueTo !== undefined) {
      conditions.push(isNotNull(todos.dueAt))
      if (query.dueFrom !== undefined) {
        conditions.push(gte(todos.dueAt, combineLocal(query.dueFrom, '00:00', timeZone)))
      }
      if (query.dueTo !== undefined) {
        conditions.push(lt(todos.dueAt, combineLocal(addDays(query.dueTo, 1), '00:00', timeZone)))
      }
    }
  }

  if (query.status === 'open' || query.status === 'overdue' || query.status === 'active') {
    conditions.push(eq(todos.status, 'open'))
    if (query.status === 'open') {
      const notOverdue = or(isNull(todos.dueAt), gt(todos.dueAt, now))
      if (notOverdue) conditions.push(notOverdue)
    } else if (query.status === 'overdue') {
      conditions.push(isNotNull(todos.dueAt), lte(todos.dueAt, now))
    }

    if (query.cursor !== undefined) {
      const decoded = decodeOpenCursor(query.cursor)
      if (!decoded) {
        throw new ApiError('VALIDATION_FAILED', 'cursor 无效', { fields: { cursor: ['游标无效'] } })
      }
      const after = openCursorCondition(decoded)
      if (after) conditions.push(after)
    }

    const rows = await db
      .select(joinedColumns)
      .from(todos)
      .innerJoin(todoGroups, eq(todoGroups.id, todos.groupId))
      .where(and(...conditions))
      .orderBy(asc(todos.sortOrder), asc(todos.dueAt), asc(todos.createdAt), asc(todos.id))
      .limit(query.limit + 1)

    const page = rows.slice(0, query.limit).map((r) => toTodoDto(r, now))
    const last = page.at(-1)
    const nextCursor =
      rows.length > query.limit && last
        ? encodeOpenCursor({
            sortOrder: last.sortOrder,
            dueAt: last.dueAt,
            createdAt: last.createdAt,
            id: last.id,
          })
        : null
    return { items: page, nextCursor }
  }

  if (query.status === 'quadrant') {
    conditions.push(eq(todos.status, 'open'))
    if (query.cursor !== undefined) {
      const decoded = decodeTimeCursor(query.cursor)
      if (!decoded) {
        throw new ApiError('VALIDATION_FAILED', 'cursor 无效', { fields: { cursor: ['游标无效'] } })
      }
      const at = new Date(decoded.at)
      const before = or(
        lt(todos.createdAt, at),
        and(eq(todos.createdAt, at), lt(todos.id, decoded.id)),
      )
      if (before) conditions.push(before)
    }

    const rows = await db
      .select(joinedColumns)
      .from(todos)
      .innerJoin(todoGroups, eq(todoGroups.id, todos.groupId))
      .where(and(...conditions))
      .orderBy(desc(todos.createdAt), desc(todos.id))
      .limit(query.limit + 1)

    const page = rows.slice(0, query.limit).map((r) => toTodoDto(r, now))
    const last = page.at(-1)
    const nextCursor =
      rows.length > query.limit && last
        ? encodeTimeCursor({ at: last.createdAt, id: last.id })
        : null
    return { items: page, nextCursor }
  }

  // done | abandoned | archived（按 settledAt DESC, id DESC 游标分页）
  const cutoff = archiveCutoff(now)
  if (query.status === 'done') {
    conditions.push(
      eq(todos.status, 'done'),
      isNotNull(todos.settledAt),
      gte(todos.settledAt, cutoff),
    )
  } else if (query.status === 'abandoned') {
    conditions.push(
      eq(todos.status, 'abandoned'),
      isNotNull(todos.settledAt),
      gte(todos.settledAt, cutoff),
    )
  } else {
    // archived：满 30 天自动归档的已完成与已放弃
    if (query.archivedOutcome !== undefined) {
      conditions.push(eq(todos.status, query.archivedOutcome))
    } else {
      conditions.push(inArray(todos.status, ['done', 'abandoned']))
    }
    conditions.push(isNotNull(todos.settledAt), lt(todos.settledAt, cutoff))
  }

  if (query.cursor !== undefined) {
    const decoded = decodeTimeCursor(query.cursor)
    if (!decoded) {
      throw new ApiError('VALIDATION_FAILED', 'cursor 无效', { fields: { cursor: ['游标无效'] } })
    }
    const at = new Date(decoded.at)
    const before = or(
      lt(todos.settledAt, at),
      and(eq(todos.settledAt, at), lt(todos.id, decoded.id)),
    )
    if (before) conditions.push(before)
  }

  const rows = await db
    .select(joinedColumns)
    .from(todos)
    .innerJoin(todoGroups, eq(todoGroups.id, todos.groupId))
    .where(and(...conditions))
    .orderBy(desc(todos.settledAt), desc(todos.id))
    .limit(query.limit + 1)

  const page = rows.slice(0, query.limit).map((r) => toTodoDto(r, now))
  const last = page.at(-1)
  const nextCursor =
    rows.length > query.limit && last?.settledAt
      ? encodeTimeCursor({ at: last.settledAt, id: last.id })
      : null
  return { items: page, nextCursor }
}

export async function getTodoById(
  db: DbOrTx,
  userId: string,
  todoId: string,
  now: Date,
): Promise<Todo> {
  const [row] = await db
    .select(joinedColumns)
    .from(todos)
    .innerJoin(todoGroups, eq(todoGroups.id, todos.groupId))
    .where(and(eq(todos.id, todoId), eq(todos.userId, userId)))
    .limit(1)
  if (!row) throw new ApiError('TODO_NOT_FOUND', '待办不存在')
  return toTodoDto(row, now)
}

async function assertOpenCapacity(tx: Tx, userId: string): Promise<void> {
  await lockUserTodos(tx, userId)
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(todos)
    .where(and(eq(todos.userId, userId), eq(todos.status, 'open')))
  if (Number(row?.n ?? 0) >= TODO_OPEN_LIMIT) {
    throw new ApiError('TODO_LIMIT_REACHED', `未完成的待办最多 ${TODO_OPEN_LIMIT} 条`)
  }
}

export async function createTodo(
  tx: Tx,
  userId: string,
  input: CreateTodo,
  now: Date = new Date(),
): Promise<Todo> {
  await assertOpenCapacity(tx, userId)
  const group = await resolveOrCreateGroup(tx, userId, {
    groupId: input.groupId,
    newGroupName: input.newGroupName,
  })
  await syncUserTodoTags(tx, userId, input.tags)

  // 新建待办默认排在该分组尾部（maxSort + 1）
  const [sortRow] = await tx
    .select({ maxSort: sql<number>`coalesce(max(${todos.sortOrder}), -1)::int` })
    .from(todos)
    .where(and(eq(todos.userId, userId), eq(todos.groupId, group.id), eq(todos.status, 'open')))

  const [row] = await tx
    .insert(todos)
    .values({
      userId,
      groupId: group.id,
      title: input.title,
      note: input.note,
      dueAt: input.dueAt === null ? null : new Date(input.dueAt),
      priority: input.priority,
      tags: input.tags,
      status: 'open',
      sortOrder: Number(sortRow?.maxSort ?? -1) + 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
  if (!row) throw new Error('插入待办没有返回行')

  await appendTodoEvent(tx, {
    userId,
    todoId: row.id,
    eventType: 'created',
    todoTitle: row.title,
    groupName: group.name,
    meta: {
      priority: row.priority,
      dueAt: row.dueAt?.toISOString() ?? null,
      ...(row.tags.length > 0 ? { tags: row.tags } : {}),
    },
    occurredAt: now,
  })

  return toTodoDto({ ...row, groupName: group.name }, now)
}

export async function updateTodo(
  tx: Tx,
  userId: string,
  todoId: string,
  patch: UpdateTodo,
  now: Date,
): Promise<Todo> {
  const scope = and(eq(todos.id, todoId), eq(todos.userId, userId))
  const [current] = await tx
    .select({
      id: todos.id,
      groupId: todos.groupId,
      title: todos.title,
      note: todos.note,
      dueAt: todos.dueAt,
      priority: todos.priority,
      tags: todos.tags,
      status: todos.status,
      doneAt: todos.doneAt,
      abandonedAt: todos.abandonedAt,
      abandonReason: todos.abandonReason,
      settledAt: todos.settledAt,
      sortOrder: todos.sortOrder,
    })
    .from(todos)
    .where(scope)
    .limit(1)
    .for('update')
  if (!current) throw new ApiError('TODO_NOT_FOUND', '待办不存在')

  const [currentGroupRow] = await tx
    .select({ id: todoGroups.id, name: todoGroups.name })
    .from(todoGroups)
    .where(eq(todoGroups.id, current.groupId))
    .limit(1)
  const prevGroupName = currentGroupRow?.name ?? '默认待办'

  let nextGroup = { id: current.groupId, name: prevGroupName }
  if (patch.groupId !== undefined || patch.newGroupName !== undefined) {
    await lockUserTodos(tx, userId)
    nextGroup = await resolveOrCreateGroup(tx, userId, {
      groupId: patch.groupId,
      newGroupName: patch.newGroupName,
    })
  }

  // 解析目标状态（兼容旧 done?: boolean 与新 status）
  let targetStatus: TodoLifecycleStatus | undefined = patch.status
  if (targetStatus === undefined && patch.done !== undefined) {
    targetStatus = patch.done ? 'done' : 'open'
  }

  const values: Partial<typeof todos.$inferInsert> = {}
  if (patch.title !== undefined) values.title = patch.title
  if (patch.note !== undefined) values.note = patch.note
  if (patch.dueAt !== undefined) values.dueAt = patch.dueAt === null ? null : new Date(patch.dueAt)
  if (patch.priority !== undefined) values.priority = patch.priority
  if (patch.tags !== undefined) {
    await syncUserTodoTags(tx, userId, patch.tags)
    values.tags = patch.tags
  }
  if (nextGroup.id !== current.groupId) {
    values.groupId = nextGroup.id
  }
  if (patch.abandonReason !== undefined) {
    values.abandonReason = patch.abandonReason
  }

  const statusChanged = targetStatus !== undefined && targetStatus !== current.status
  if (statusChanged && targetStatus === 'done') {
    values.status = 'done'
    values.doneAt = now
    values.abandonedAt = null
    values.abandonReason = null
    values.settledAt = now
  } else if (statusChanged && targetStatus === 'abandoned') {
    values.status = 'abandoned'
    values.doneAt = null
    values.abandonedAt = now
    values.settledAt = now
  } else if (statusChanged && targetStatus === 'open') {
    await assertOpenCapacity(tx, userId)
    values.status = 'open'
    values.doneAt = null
    values.abandonedAt = null
    values.abandonReason = null
    values.settledAt = null
  }

  values.updatedAt = now

  const [row] = await tx.update(todos).set(values).where(scope).returning()
  if (!row) throw new ApiError('TODO_NOT_FOUND', '待办不存在')

  // 写入精准的过程事件（状态变更 > 移动分组 > 普通编辑）
  if (statusChanged && targetStatus === 'done') {
    await appendTodoEvent(tx, {
      userId,
      todoId: row.id,
      eventType: 'completed',
      todoTitle: row.title,
      groupName: nextGroup.name,
      occurredAt: now,
    })
  } else if (statusChanged && targetStatus === 'abandoned') {
    await appendTodoEvent(tx, {
      userId,
      todoId: row.id,
      eventType: 'abandoned',
      todoTitle: row.title,
      groupName: nextGroup.name,
      meta: row.abandonReason ? { reason: row.abandonReason } : {},
      occurredAt: now,
    })
  } else if (statusChanged && targetStatus === 'open') {
    await appendTodoEvent(tx, {
      userId,
      todoId: row.id,
      eventType: 'reopened',
      todoTitle: row.title,
      groupName: nextGroup.name,
      occurredAt: now,
    })
  } else if (nextGroup.id !== current.groupId) {
    await appendTodoEvent(tx, {
      userId,
      todoId: row.id,
      eventType: 'moved',
      todoTitle: row.title,
      groupName: nextGroup.name,
      meta: { fromGroup: prevGroupName, toGroup: nextGroup.name },
      occurredAt: now,
    })
  } else if (
    patch.title !== undefined ||
    patch.note !== undefined ||
    patch.dueAt !== undefined ||
    patch.priority !== undefined ||
    patch.tags !== undefined
  ) {
    const meta: TodoEventMeta = {}
    if (patch.priority !== undefined) meta.priority = row.priority
    if (patch.dueAt !== undefined) meta.dueAt = row.dueAt?.toISOString() ?? null
    if (patch.tags !== undefined) meta.tags = row.tags
    await appendTodoEvent(tx, {
      userId,
      todoId: row.id,
      eventType: 'updated',
      todoTitle: row.title,
      groupName: nextGroup.name,
      meta,
      occurredAt: now,
    })
  }

  return toTodoDto({ ...row, groupName: nextGroup.name }, now)
}

/** 组内长按拖拽排序（未在 todoIds 中列出的该组待办自动顺延在后） */
export async function reorderTodos(
  tx: Tx,
  userId: string,
  input: ReorderTodos,
  now: Date,
): Promise<{ ok: true }> {
  await lockUserTodos(tx, userId)
  const [group] = await tx
    .select({ id: todoGroups.id })
    .from(todoGroups)
    .where(and(eq(todoGroups.id, input.groupId), eq(todoGroups.userId, userId)))
    .limit(1)
  if (!group) throw new ApiError('TODO_GROUP_NOT_FOUND', '待办分组不存在')

  const existing = await tx
    .select({ id: todos.id })
    .from(todos)
    .where(
      and(eq(todos.userId, userId), eq(todos.groupId, input.groupId), eq(todos.status, 'open')),
    )
    .orderBy(asc(todos.sortOrder), asc(todos.dueAt), asc(todos.createdAt), asc(todos.id))
    .limit(TODO_OPEN_LIMIT)

  const valid = new Set(existing.map((r) => r.id))
  const ordered: string[] = []
  const seen = new Set<string>()
  for (const id of input.todoIds) {
    if (valid.has(id) && !seen.has(id)) {
      seen.add(id)
      ordered.push(id)
    }
  }
  for (const r of existing) {
    if (!seen.has(r.id)) ordered.push(r.id)
  }

  for (let i = 0; i < ordered.length; i++) {
    const id = ordered[i]
    if (!id) continue
    await tx
      .update(todos)
      .set({ sortOrder: i, updatedAt: now })
      .where(and(eq(todos.id, id), eq(todos.userId, userId)))
  }

  return { ok: true }
}

/** 删除待办：先在同一事务记录 deleted 快照事件，再删除待办行 */
export async function deleteTodo(
  tx: Tx,
  userId: string,
  todoId: string,
  now: Date = new Date(),
): Promise<void> {
  const [existing] = await tx
    .select({
      id: todos.id,
      title: todos.title,
      groupName: todoGroups.name,
    })
    .from(todos)
    .innerJoin(todoGroups, eq(todoGroups.id, todos.groupId))
    .where(and(eq(todos.id, todoId), eq(todos.userId, userId)))
    .limit(1)
  if (!existing) throw new ApiError('TODO_NOT_FOUND', '待办不存在')

  await appendTodoEvent(tx, {
    userId,
    todoId: null,
    eventType: 'deleted',
    todoTitle: existing.title,
    groupName: existing.groupName,
    occurredAt: now,
  })

  await tx.delete(todos).where(and(eq(todos.id, todoId), eq(todos.userId, userId)))
}
