import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import {
  TODO_DEFAULT_GROUP_NAME,
  TODO_GROUP_LIMIT,
  type TodoEventMeta,
  type TodoEventType,
} from '@/features/todo/schemas'
import { BUSINESS_TIME_ZONE } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import type { DbOrTx, Tx } from '@/server/db/client'
import { profiles, todoEvents, todoGroups, todoTags } from '@/server/db/schema'

/*
 * 待办模块底层基础设施：
 * - 幂等确保每个用户拥有唯一的「默认待办」分组
 * - 事务级按用户加锁（控制未完成上限与分组上限并发安全）
 * - 同步自定义标签词库（todo_tags）
 * - 追加过程事件快照（todo_events）
 */

export interface DefaultGroupRow {
  id: string
  name: string
  isDefault: boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

/** 事务级按用户加锁，防止并发创建绕过数量上限 */
export async function lockUserTodos(tx: Tx, userId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`todos:${userId}`}, 0))`)
}

/** 幂等确保用户存在「默认待办」分组（并发安全） */
export async function ensureDefaultTodoGroup(db: DbOrTx, userId: string): Promise<DefaultGroupRow> {
  const [existing] = await db
    .select({
      id: todoGroups.id,
      name: todoGroups.name,
      isDefault: todoGroups.isDefault,
      sortOrder: todoGroups.sortOrder,
      createdAt: todoGroups.createdAt,
      updatedAt: todoGroups.updatedAt,
    })
    .from(todoGroups)
    .where(and(eq(todoGroups.userId, userId), eq(todoGroups.isDefault, true)))
    .limit(1)
  if (existing) return existing

  await db
    .insert(todoGroups)
    .values({
      userId,
      name: TODO_DEFAULT_GROUP_NAME,
      isDefault: true,
      sortOrder: 0,
    })
    .onConflictDoNothing()

  const [created] = await db
    .select({
      id: todoGroups.id,
      name: todoGroups.name,
      isDefault: todoGroups.isDefault,
      sortOrder: todoGroups.sortOrder,
      createdAt: todoGroups.createdAt,
      updatedAt: todoGroups.updatedAt,
    })
    .from(todoGroups)
    .where(and(eq(todoGroups.userId, userId), eq(todoGroups.isDefault, true)))
    .limit(1)
  if (!created) throw new Error('无法初始化默认待办分组')
  return created
}

/**
 * 解析或原地创建分组（用于新建/编辑待办时 Combobox 直接输入新分组名）：
 * - 传 newGroupName：若已存在同名分组直接复用，否则检查上限后在同事务创建；
 * - 传 groupId：校验属于当前用户；
 * - 都不传：返回「默认待办」分组。
 */
export async function resolveOrCreateGroup(
  tx: Tx,
  userId: string,
  opts: { groupId?: string; newGroupName?: string },
): Promise<{ id: string; name: string }> {
  const defaultGroup = await ensureDefaultTodoGroup(tx, userId)

  if (opts.newGroupName !== undefined) {
    const trimmed = opts.newGroupName.trim()
    if (trimmed === defaultGroup.name) {
      return { id: defaultGroup.id, name: defaultGroup.name }
    }
    const [existing] = await tx
      .select({ id: todoGroups.id, name: todoGroups.name })
      .from(todoGroups)
      .where(and(eq(todoGroups.userId, userId), eq(todoGroups.name, trimmed)))
      .limit(1)
    if (existing) return existing

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

    const [inserted] = await tx
      .insert(todoGroups)
      .values({
        userId,
        name: trimmed,
        isDefault: false,
        sortOrder: Number(stats?.maxSort ?? 0) + 1,
      })
      .returning({ id: todoGroups.id, name: todoGroups.name })
    if (!inserted) throw new Error('创建待办分组失败')
    return inserted
  }

  if (opts.groupId !== undefined) {
    const [group] = await tx
      .select({ id: todoGroups.id, name: todoGroups.name })
      .from(todoGroups)
      .where(and(eq(todoGroups.id, opts.groupId), eq(todoGroups.userId, userId)))
      .limit(1)
    if (!group) throw new ApiError('TODO_GROUP_NOT_FOUND', '待办分组不存在')
    return group
  }

  return { id: defaultGroup.id, name: defaultGroup.name }
}

/** 将待办使用的标签同步进用户标签词库（幂等） */
export async function syncUserTodoTags(
  tx: Tx,
  userId: string,
  tags: readonly string[],
): Promise<void> {
  if (tags.length === 0) return
  await tx
    .insert(todoTags)
    .values(tags.map((name) => ({ userId, name })))
    .onConflictDoNothing()
}

/** 写入待办过程事件快照 */
export async function appendTodoEvent(
  tx: Tx,
  input: {
    userId: string
    todoId: string | null
    eventType: TodoEventType
    todoTitle: string
    groupName: string
    meta?: TodoEventMeta
    occurredAt: Date
  },
): Promise<void> {
  await tx.insert(todoEvents).values({
    userId: input.userId,
    todoId: input.todoId,
    eventType: input.eventType,
    todoTitle: input.todoTitle,
    groupName: input.groupName,
    meta: input.meta ?? {},
    occurredAt: input.occurredAt,
  })
}

/** 仅读取用户时区（独立查询 profiles，不耦合 checkins 模块） */
export async function loadUserTimeZone(db: DbOrTx, userId: string): Promise<string> {
  const [row] = await db
    .select({ timeZone: profiles.timeZone })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1)
  return row?.timeZone ?? BUSINESS_TIME_ZONE
}
