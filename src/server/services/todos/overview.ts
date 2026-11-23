import 'server-only'
import { and, asc, eq, gt, isNull, or, sql } from 'drizzle-orm'
import {
  TODO_INITIAL_GROUP_PAGE_SIZE,
  type Todo,
  type TodoOverview,
  type TodoOverviewQuery,
} from '@/features/todo/schemas'
import { archiveCutoff, isAutoArchived } from '@/features/todo/rules'
import type { DbOrTx } from '@/server/db/client'
import { todoGroups, todos } from '@/server/db/schema'
import { encodeOpenCursor } from './cursor'
import { ensureDefaultTodoGroup } from './defaults'
import { listTodoGroups, listTodoTags } from './groups'

/*
 * 首屏轻量概览查询（GET /api/v1/todos/overview）：
 * - 返回分组目录与计数、系统面板计数（已过期 / 近 30 天已完成 / 近 30 天已放弃 / 已归档）、四象限分布、标签词库；
 * - 仅预热「默认待办」分组首批 20 条未过期待办，其他自定义分组与折叠面板零查询，避免首屏一口气拉取全部待办。
 */

export async function getTodoOverview(
  db: DbOrTx,
  userId: string,
  now: Date,
  query: TodoOverviewQuery = {},
): Promise<TodoOverview> {
  const defaultGroup = await ensureDefaultTodoGroup(db, userId)
  const cutoff = archiveCutoff(now)
  const tag = query.tag

  const baseConds = [eq(todos.userId, userId)]
  if (tag !== undefined) {
    baseConds.push(sql`${todos.tags} @> ${JSON.stringify([tag])}::jsonb`)
  }

  const [{ items: groups }, { items: tags }, aggRows, defaultRows] = await Promise.all([
    listTodoGroups(db, userId, now, tag),
    listTodoTags(db, userId),
    db
      .select({
        openTotal: sql<number>`count(*) filter (where ${todos.status} = 'open')::int`,
        overdueCount: sql<number>`count(*) filter (where ${todos.status} = 'open' and ${todos.dueAt} is not null and ${todos.dueAt} <= ${now})::int`,
        doneRecentCount: sql<number>`count(*) filter (where ${todos.status} = 'done' and ${todos.settledAt} >= ${cutoff})::int`,
        abandonedRecentCount: sql<number>`count(*) filter (where ${todos.status} = 'abandoned' and ${todos.settledAt} >= ${cutoff})::int`,
        archivedCount: sql<number>`count(*) filter (where ${todos.status} in ('done', 'abandoned') and ${todos.settledAt} < ${cutoff})::int`,
        q1: sql<number>`count(*) filter (where ${todos.status} = 'open' and ${todos.priority} = 'urgent-important')::int`,
        q2: sql<number>`count(*) filter (where ${todos.status} = 'open' and ${todos.priority} = 'important-not-urgent')::int`,
        q3: sql<number>`count(*) filter (where ${todos.status} = 'open' and ${todos.priority} = 'urgent-not-important')::int`,
        q4: sql<number>`count(*) filter (where ${todos.status} = 'open' and ${todos.priority} = 'not-important-not-urgent')::int`,
      })
      .from(todos)
      .where(and(...baseConds)),
    db
      .select({
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
      })
      .from(todos)
      .innerJoin(todoGroups, eq(todoGroups.id, todos.groupId))
      .where(
        and(
          ...baseConds,
          eq(todos.groupId, defaultGroup.id),
          eq(todos.status, 'open'),
          or(isNull(todos.dueAt), gt(todos.dueAt, now)),
        ),
      )
      .orderBy(asc(todos.sortOrder), asc(todos.dueAt), asc(todos.createdAt), asc(todos.id))
      .limit(TODO_INITIAL_GROUP_PAGE_SIZE + 1),
  ])

  const agg = aggRows[0]
  const page = defaultRows.slice(0, TODO_INITIAL_GROUP_PAGE_SIZE).map((r): Todo => {
    const settledAt = r.settledAt?.toISOString() ?? null
    const doneAt = r.doneAt?.toISOString() ?? null
    const abandonedAt = r.abandonedAt?.toISOString() ?? null
    return {
      id: r.id,
      groupId: r.groupId,
      groupName: r.groupName,
      title: r.title,
      note: r.note,
      dueAt: r.dueAt?.toISOString() ?? null,
      priority: r.priority,
      tags: r.tags,
      status: r.status,
      doneAt,
      abandonedAt,
      abandonReason: r.abandonReason,
      settledAt,
      isArchived: isAutoArchived({ status: r.status, settledAt, doneAt, abandonedAt }, now),
      sortOrder: r.sortOrder,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }
  })

  const last = page.at(-1)
  const nextCursor =
    defaultRows.length > TODO_INITIAL_GROUP_PAGE_SIZE && last
      ? encodeOpenCursor({
          sortOrder: last.sortOrder,
          dueAt: last.dueAt,
          createdAt: last.createdAt,
          id: last.id,
        })
      : null

  return {
    defaultGroupId: defaultGroup.id,
    groups,
    tags,
    counts: {
      openTotal: Number(agg?.openTotal ?? 0),
      overdueCount: Number(agg?.overdueCount ?? 0),
      doneRecentCount: Number(agg?.doneRecentCount ?? 0),
      abandonedRecentCount: Number(agg?.abandonedRecentCount ?? 0),
      archivedCount: Number(agg?.archivedCount ?? 0),
      quadrants: {
        'urgent-important': Number(agg?.q1 ?? 0),
        'important-not-urgent': Number(agg?.q2 ?? 0),
        'urgent-not-important': Number(agg?.q3 ?? 0),
        'not-important-not-urgent': Number(agg?.q4 ?? 0),
      },
    },
    defaultGroupTodos: {
      items: page,
      nextCursor,
    },
  }
}
