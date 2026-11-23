import 'server-only'
import { and, desc, eq, gte, lt, or } from 'drizzle-orm'
import type { TodoEvent, TodoEventList, TodoEventListQuery } from '@/features/todo/schemas'
import { isAutoArchived } from '@/features/todo/rules'
import { addDays, combineLocal } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import type { DbOrTx } from '@/server/db/client'
import { todoEvents, todos } from '@/server/db/schema'
import { decodeTimeCursor, encodeTimeCursor } from './cursor'
import { loadUserTimeZone } from './defaults'

/*
 * 待办过程时间轴查询（GET /api/v1/todos/events）：
 * - 按 (occurredAt DESC, id DESC) 游标分页，覆盖新建/完成/恢复/放弃/移动/编辑/删除全生命周期；
 * - 天然包含已满 30 天自动归档的历史待办，作为「过程按钮」独立单页与 AI 深度复盘的数据源。
 */

export async function listTodoEvents(
  db: DbOrTx,
  userId: string,
  query: TodoEventListQuery,
  now: Date,
): Promise<TodoEventList> {
  const conditions = [eq(todoEvents.userId, userId)]

  if (query.todoId !== undefined) {
    conditions.push(eq(todoEvents.todoId, query.todoId))
  }
  if (query.eventType !== undefined) {
    conditions.push(eq(todoEvents.eventType, query.eventType))
  }

  if (query.from !== undefined || query.to !== undefined) {
    const timeZone = await loadUserTimeZone(db, userId)
    if (query.from !== undefined) {
      conditions.push(gte(todoEvents.occurredAt, combineLocal(query.from, '00:00', timeZone)))
    }
    if (query.to !== undefined) {
      conditions.push(
        lt(todoEvents.occurredAt, combineLocal(addDays(query.to, 1), '00:00', timeZone)),
      )
    }
  }

  if (query.cursor !== undefined) {
    const cursor = decodeTimeCursor(query.cursor)
    if (!cursor) {
      throw new ApiError('VALIDATION_FAILED', 'cursor 无效', { fields: { cursor: ['游标无效'] } })
    }
    const at = new Date(cursor.at)
    const before = or(
      lt(todoEvents.occurredAt, at),
      and(eq(todoEvents.occurredAt, at), lt(todoEvents.id, cursor.id)),
    )
    if (before) conditions.push(before)
  }

  const rows = await db
    .select({
      id: todoEvents.id,
      todoId: todoEvents.todoId,
      eventType: todoEvents.eventType,
      todoTitle: todoEvents.todoTitle,
      groupName: todoEvents.groupName,
      meta: todoEvents.meta,
      occurredAt: todoEvents.occurredAt,
      todoStatus: todos.status,
      todoSettledAt: todos.settledAt,
      todoDoneAt: todos.doneAt,
      todoAbandonedAt: todos.abandonedAt,
    })
    .from(todoEvents)
    .leftJoin(todos, eq(todos.id, todoEvents.todoId))
    .where(and(...conditions))
    .orderBy(desc(todoEvents.occurredAt), desc(todoEvents.id))
    .limit(query.limit + 1)

  const page = rows.slice(0, query.limit).map((r): TodoEvent => {
    const archived =
      r.todoStatus !== null
        ? isAutoArchived(
            {
              status: r.todoStatus,
              settledAt: r.todoSettledAt?.toISOString() ?? null,
              doneAt: r.todoDoneAt?.toISOString() ?? null,
              abandonedAt: r.todoAbandonedAt?.toISOString() ?? null,
            },
            now,
          )
        : false
    return {
      id: r.id,
      todoId: r.todoId,
      eventType: r.eventType,
      todoTitle: r.todoTitle,
      groupName: r.groupName,
      meta: r.meta,
      occurredAt: r.occurredAt.toISOString(),
      isArchived: archived,
    }
  })

  const last = page.at(-1)
  const nextCursor =
    rows.length > query.limit && last
      ? encodeTimeCursor({ at: last.occurredAt, id: last.id })
      : null

  return { items: page, nextCursor }
}
