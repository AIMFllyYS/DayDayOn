import 'server-only'
import { and, asc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm'
import {
  TODO_GROUP_LIMIT,
  type CreateTodoGroup,
  type ReorderTodoGroups,
  type TodoGroup,
  type TodoGroupList,
  type TodoTag,
  type TodoTagList,
  type UpdateTodoGroup,
} from '@/features/todo/schemas'
import { DUE_SOON_SECONDS } from '@/features/todo/rules'
import { ApiError } from '@/server/api/errors'
import type { DbOrTx, Tx } from '@/server/db/client'
import { todoGroups, todos, todoTags } from '@/server/db/schema'
import { ensureDefaultTodoGroup, lockUserTodos } from './defaults'

/*
 * 待办分组与标签管理服务：
 * - 分组支持新建、重命名、长按拖拽排序与删除；
 * - 删除自定义分组时在事务内将该组所有待办安全迁回「默认待办」分组，绝不误删待办；
 * - 「默认待办」受保护不可删除或重命名，但可参与排序。
 */

function toTagDto(row: { id: string; name: string; createdAt: Date }): TodoTag {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listTodoGroups(
  db: DbOrTx,
  userId: string,
  now: Date,
  tag?: string,
): Promise<TodoGroupList> {
  await ensureDefaultTodoGroup(db, userId)
  const soonDeadline = new Date(now.getTime() + DUE_SOON_SECONDS * 1000)

  const groups = await db
    .select({
      id: todoGroups.id,
      name: todoGroups.name,
      isDefault: todoGroups.isDefault,
      sortOrder: todoGroups.sortOrder,
      createdAt: todoGroups.createdAt,
      updatedAt: todoGroups.updatedAt,
    })
    .from(todoGroups)
    .where(eq(todoGroups.userId, userId))
    .orderBy(asc(todoGroups.sortOrder), asc(todoGroups.createdAt), asc(todoGroups.id))
    .limit(TODO_GROUP_LIMIT)

  // 只统计未过期的进行中待办（已过期单独归入「已过期」分组）
  const activeConditions = [
    eq(todos.userId, userId),
    eq(todos.status, 'open'),
    or(isNull(todos.dueAt), gt(todos.dueAt, now)),
  ]
  if (tag !== undefined) {
    activeConditions.push(sql`${todos.tags} @> ${JSON.stringify([tag])}::jsonb`)
  }

  const countRows = await db
    .select({
      groupId: todos.groupId,
      openCount: sql<number>`count(*)::int`,
      soonCount: sql<number>`count(*) filter (where ${todos.dueAt} is not null and ${todos.dueAt} <= ${soonDeadline})::int`,
    })
    .from(todos)
    .where(and(...activeConditions))
    .groupBy(todos.groupId)

  const countMap = new Map(
    countRows.map((r) => [
      r.groupId,
      { openCount: Number(r.openCount ?? 0), soonCount: Number(r.soonCount ?? 0) },
    ]),
  )

  const items: TodoGroup[] = groups.map((g) => {
    const counts = countMap.get(g.id)
    return {
      id: g.id,
      name: g.name,
      isDefault: g.isDefault,
      sortOrder: g.sortOrder,
      openCount: counts?.openCount ?? 0,
      soonCount: counts?.soonCount ?? 0,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    }
  })

  return { items }
}

export async function createTodoGroup(
  tx: Tx,
  userId: string,
  input: CreateTodoGroup,
): Promise<TodoGroup> {
  await lockUserTodos(tx, userId)
  await ensureDefaultTodoGroup(tx, userId)

  const [dup] = await tx
    .select({ id: todoGroups.id })
    .from(todoGroups)
    .where(and(eq(todoGroups.userId, userId), eq(todoGroups.name, input.name)))
    .limit(1)
  if (dup) throw new ApiError('TODO_GROUP_NAME_EXISTS', '分组名已存在')

  const [stats] = await tx
    .select({
      count: sql<number>`count(*)::int`,
      maxSort: sql<number>`coalesce(max(${todoGroups.sortOrder}), 0)::int`,
    })
    .from(todoGroups)
    .where(eq(todoGroups.userId, userId))
  if (Number(stats?.count ?? 0) >= TODO_GROUP_LIMIT) {
    throw new ApiError('TODO_GROUP_LIMIT_REACHED', `最多创建 ${TODO_GROUP_LIMIT} 个分组`)
  }

  const [row] = await tx
    .insert(todoGroups)
    .values({
      userId,
      name: input.name,
      isDefault: false,
      sortOrder: Number(stats?.maxSort ?? 0) + 1,
    })
    .returning({
      id: todoGroups.id,
      name: todoGroups.name,
      isDefault: todoGroups.isDefault,
      sortOrder: todoGroups.sortOrder,
      createdAt: todoGroups.createdAt,
      updatedAt: todoGroups.updatedAt,
    })
  if (!row) throw new Error('创建分组失败')

  return {
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    sortOrder: row.sortOrder,
    openCount: 0,
    soonCount: 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function updateTodoGroup(
  tx: Tx,
  userId: string,
  groupId: string,
  input: UpdateTodoGroup,
  now: Date,
): Promise<TodoGroup> {
  await lockUserTodos(tx, userId)
  const [target] = await tx
    .select({
      id: todoGroups.id,
      name: todoGroups.name,
      isDefault: todoGroups.isDefault,
      sortOrder: todoGroups.sortOrder,
      createdAt: todoGroups.createdAt,
    })
    .from(todoGroups)
    .where(and(eq(todoGroups.id, groupId), eq(todoGroups.userId, userId)))
    .limit(1)
  if (!target) throw new ApiError('TODO_GROUP_NOT_FOUND', '分组不存在')
  if (target.isDefault) {
    throw new ApiError('TODO_DEFAULT_GROUP_PROTECTED', '默认待办分组不可重命名')
  }

  if (input.name !== target.name) {
    const [dup] = await tx
      .select({ id: todoGroups.id })
      .from(todoGroups)
      .where(and(eq(todoGroups.userId, userId), eq(todoGroups.name, input.name)))
      .limit(1)
    if (dup) throw new ApiError('TODO_GROUP_NAME_EXISTS', '分组名已存在')
  }

  const [updated] = await tx
    .update(todoGroups)
    .set({ name: input.name, updatedAt: now })
    .where(and(eq(todoGroups.id, groupId), eq(todoGroups.userId, userId)))
    .returning({
      id: todoGroups.id,
      name: todoGroups.name,
      isDefault: todoGroups.isDefault,
      sortOrder: todoGroups.sortOrder,
      createdAt: todoGroups.createdAt,
      updatedAt: todoGroups.updatedAt,
    })
  if (!updated) throw new ApiError('TODO_GROUP_NOT_FOUND', '分组不存在')

  const soonDeadline = new Date(now.getTime() + DUE_SOON_SECONDS * 1000)
  const [counts] = await tx
    .select({
      openCount: sql<number>`count(*)::int`,
      soonCount: sql<number>`count(*) filter (where ${todos.dueAt} is not null and ${todos.dueAt} <= ${soonDeadline})::int`,
    })
    .from(todos)
    .where(
      and(
        eq(todos.userId, userId),
        eq(todos.groupId, groupId),
        eq(todos.status, 'open'),
        or(isNull(todos.dueAt), gt(todos.dueAt, now)),
      ),
    )

  return {
    id: updated.id,
    name: updated.name,
    isDefault: updated.isDefault,
    sortOrder: updated.sortOrder,
    openCount: Number(counts?.openCount ?? 0),
    soonCount: Number(counts?.soonCount ?? 0),
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  }
}

export async function deleteTodoGroup(
  tx: Tx,
  userId: string,
  groupId: string,
  now: Date,
): Promise<void> {
  await lockUserTodos(tx, userId)
  const defaultGroup = await ensureDefaultTodoGroup(tx, userId)
  const [target] = await tx
    .select({ id: todoGroups.id, isDefault: todoGroups.isDefault })
    .from(todoGroups)
    .where(and(eq(todoGroups.id, groupId), eq(todoGroups.userId, userId)))
    .limit(1)
  if (!target) throw new ApiError('TODO_GROUP_NOT_FOUND', '分组不存在')
  if (target.isDefault) {
    throw new ApiError('TODO_DEFAULT_GROUP_PROTECTED', '默认待办分组不可删除')
  }

  // 先将该分组下所有待办（含进行中/已完成/已放弃/已归档）安全迁回「默认待办」
  await tx
    .update(todos)
    .set({ groupId: defaultGroup.id, updatedAt: now })
    .where(and(eq(todos.userId, userId), eq(todos.groupId, groupId)))

  await tx.delete(todoGroups).where(and(eq(todoGroups.id, groupId), eq(todoGroups.userId, userId)))
}

/** 长按拖拽重排分组顺序（未出现在入参里的分组自动顺延在后） */
export async function reorderTodoGroups(
  tx: Tx,
  userId: string,
  input: ReorderTodoGroups,
  now: Date,
): Promise<TodoGroupList> {
  await lockUserTodos(tx, userId)
  await ensureDefaultTodoGroup(tx, userId)

  const existing = await tx
    .select({ id: todoGroups.id })
    .from(todoGroups)
    .where(eq(todoGroups.userId, userId))
    .orderBy(asc(todoGroups.sortOrder), asc(todoGroups.createdAt), asc(todoGroups.id))
    .limit(TODO_GROUP_LIMIT)

  const validIds = new Set(existing.map((g) => g.id))
  const ordered: string[] = []
  const seen = new Set<string>()
  for (const id of input.groupIds) {
    if (validIds.has(id) && !seen.has(id)) {
      seen.add(id)
      ordered.push(id)
    }
  }
  for (const g of existing) {
    if (!seen.has(g.id)) ordered.push(g.id)
  }

  for (let i = 0; i < ordered.length; i++) {
    const id = ordered[i]
    if (!id) continue
    await tx
      .update(todoGroups)
      .set({ sortOrder: i, updatedAt: now })
      .where(and(eq(todoGroups.id, id), eq(todoGroups.userId, userId)))
  }

  return listTodoGroups(tx, userId, now)
}

export async function listTodoTags(db: DbOrTx, userId: string): Promise<TodoTagList> {
  const rows = await db
    .select({ id: todoTags.id, name: todoTags.name, createdAt: todoTags.createdAt })
    .from(todoTags)
    .where(eq(todoTags.userId, userId))
    .orderBy(asc(todoTags.createdAt), asc(todoTags.name))
    .limit(200)
  return { items: rows.map(toTagDto) }
}

export async function deleteTodoTag(tx: Tx, userId: string, tagId: string): Promise<void> {
  const [removed] = await tx
    .delete(todoTags)
    .where(and(eq(todoTags.id, tagId), eq(todoTags.userId, userId)))
    .returning({ id: todoTags.id, name: todoTags.name })
  if (!removed) throw new ApiError('TODO_TAG_NOT_FOUND', '标签不存在')

  // 从已关联待办的 tags 数组中一并剔除该标签
  await tx
    .update(todos)
    .set({ tags: sql`${todos.tags} - ${removed.name}` })
    .where(
      and(eq(todos.userId, userId), sql`${todos.tags} @> ${JSON.stringify([removed.name])}::jsonb`),
    )
}

export function isDueSoonExpr(now: Date) {
  return lte(todos.dueAt, new Date(now.getTime() + DUE_SOON_SECONDS * 1000))
}
