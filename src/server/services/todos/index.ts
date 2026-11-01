import 'server-only'
import { and, asc, desc, eq, gte, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import {
  TODO_OPEN_LIMIT,
  type CreateTodo,
  type Todo,
  type TodoList,
  type TodoListQuery,
  type UpdateTodo,
} from '@/features/todo/schemas'
import { compareOpenTodos, DONE_WINDOW_SECONDS } from '@/features/todo/rules'
import { ApiError } from '@/server/api/errors'
import type { DbOrTx, Tx } from '@/server/db/client'
import { todos } from '@/server/db/schema'
import { decodeDoneCursor, encodeDoneCursor } from './cursor'

/*
 * 待办（PRD 2.10、7.5）。每条查询都带 userId；返回值就是接口 DTO（TodoSchema）。
 * - 进行中：不分页，按 DDL 升序、无 DDL 排后，上限 500 条（TODO_LIMIT_REACHED）。
 * - 已完成：最近 30 天，按完成时间降序游标分页。
 * 写函数接收 tx：新建和"取消勾选"会让未完成数 +1，在同一事务里先按用户加锁再计数，避免并发越过上限。
 */

const columns = {
  id: todos.id,
  title: todos.title,
  dueAt: todos.dueAt,
  priority: todos.priority,
  doneAt: todos.doneAt,
  createdAt: todos.createdAt,
  updatedAt: todos.updatedAt,
}

type Row = {
  id: string
  title: string
  dueAt: Date | null
  priority: Todo['priority']
  doneAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export function toTodoDto(row: Row): Todo {
  return {
    id: row.id,
    title: row.title,
    dueAt: row.dueAt?.toISOString() ?? null,
    priority: row.priority,
    doneAt: row.doneAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listTodos(
  db: DbOrTx,
  userId: string,
  query: TodoListQuery,
  now: Date,
): Promise<TodoList> {
  if (query.status === 'open') {
    const rows = await db
      .select(columns)
      .from(todos)
      .where(and(eq(todos.userId, userId), isNull(todos.doneAt)))
      // PostgreSQL 的 ASC 默认 NULLS LAST：没有 DDL 的排在最后
      .orderBy(asc(todos.dueAt), asc(todos.createdAt), asc(todos.id))
      .limit(TODO_OPEN_LIMIT)
    // SQL 已排好；再用共享比较函数排一次，保证与前端乐观更新的顺序完全一致
    return { items: rows.map(toTodoDto).sort(compareOpenTodos), nextCursor: null }
  }

  const since = new Date(now.getTime() - DONE_WINDOW_SECONDS * 1000)
  const conditions = [eq(todos.userId, userId), isNotNull(todos.doneAt), gte(todos.doneAt, since)]
  if (query.cursor !== undefined) {
    const cursor = decodeDoneCursor(query.cursor)
    if (!cursor) {
      throw new ApiError('VALIDATION_FAILED', 'cursor 无效', { fields: { cursor: ['游标无效'] } })
    }
    const at = new Date(cursor.doneAt)
    const before = or(lt(todos.doneAt, at), and(eq(todos.doneAt, at), lt(todos.id, cursor.id)))
    if (before) conditions.push(before)
  }
  const rows = await db
    .select(columns)
    .from(todos)
    .where(and(...conditions))
    .orderBy(desc(todos.doneAt), desc(todos.id))
    .limit(query.limit + 1)
  const page = rows.slice(0, query.limit).map(toTodoDto)
  const last = page.at(-1)
  const nextCursor =
    rows.length > query.limit && last?.doneAt
      ? encodeDoneCursor({ doneAt: last.doneAt, id: last.id })
      : null
  return { items: page, nextCursor }
}

/** 事务级的按用户加锁：同一用户的"未完成数 +1"串行执行，事务结束自动释放 */
async function lockUserTodos(tx: Tx, userId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`todos:${userId}`}, 0))`)
}

async function assertOpenCapacity(tx: Tx, userId: string): Promise<void> {
  await lockUserTodos(tx, userId)
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(todos)
    .where(and(eq(todos.userId, userId), isNull(todos.doneAt)))
  if ((row?.n ?? 0) >= TODO_OPEN_LIMIT) {
    throw new ApiError('TODO_LIMIT_REACHED', `未完成的待办最多 ${TODO_OPEN_LIMIT} 条`)
  }
}

export async function createTodo(tx: Tx, userId: string, input: CreateTodo): Promise<Todo> {
  await assertOpenCapacity(tx, userId)
  const [row] = await tx
    .insert(todos)
    .values({
      userId,
      title: input.title,
      dueAt: input.dueAt === null ? null : new Date(input.dueAt),
      priority: input.priority,
    })
    .returning(columns)
  if (!row) throw new Error('插入待办没有返回行')
  return toTodoDto(row)
}

/**
 * 修改（含勾选）。done: true 写 doneAt = now（已完成的保持原完成时间）；false 清空。
 * 从已完成改回未完成时同样检查 500 条上限。
 */
export async function updateTodo(
  tx: Tx,
  userId: string,
  todoId: string,
  patch: UpdateTodo,
  now: Date,
): Promise<Todo> {
  const scope = and(eq(todos.id, todoId), eq(todos.userId, userId))
  const [current] = await tx
    .select({ doneAt: todos.doneAt })
    .from(todos)
    .where(scope)
    .limit(1)
    .for('update')
  if (!current) throw new ApiError('TODO_NOT_FOUND', '待办不存在')

  const values: Partial<typeof todos.$inferInsert> = {}
  if (patch.title !== undefined) values.title = patch.title
  if (patch.dueAt !== undefined) values.dueAt = patch.dueAt === null ? null : new Date(patch.dueAt)
  if (patch.priority !== undefined) values.priority = patch.priority
  if (patch.done === true && current.doneAt === null) values.doneAt = now
  if (patch.done === false && current.doneAt !== null) {
    await assertOpenCapacity(tx, userId)
    values.doneAt = null
  }
  // updatedAt 由 $onUpdate 写入；什么都没变时也刷新一次，返回最新行
  values.updatedAt = now

  const [row] = await tx.update(todos).set(values).where(scope).returning(columns)
  if (!row) throw new ApiError('TODO_NOT_FOUND', '待办不存在')
  return toTodoDto(row)
}

export async function deleteTodo(db: DbOrTx, userId: string, todoId: string): Promise<void> {
  const rows = await db
    .delete(todos)
    .where(and(eq(todos.id, todoId), eq(todos.userId, userId)))
    .returning({ id: todos.id })
  if (rows.length === 0) throw new ApiError('TODO_NOT_FOUND', '待办不存在')
}
