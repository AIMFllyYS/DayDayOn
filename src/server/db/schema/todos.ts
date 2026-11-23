import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth'
import { id, timestamps, timestamptz } from './columns'

export type TodoPriority =
  'urgent-important' | 'important-not-urgent' | 'urgent-not-important' | 'not-important-not-urgent'

export type TodoLifecycleStatus = 'open' | 'done' | 'abandoned'

export type TodoEventType =
  'created' | 'completed' | 'reopened' | 'abandoned' | 'moved' | 'updated' | 'deleted'

export interface TodoEventMeta {
  fromGroup?: string
  toGroup?: string
  priority?: TodoPriority
  dueAt?: string | null
  reason?: string | null
  tags?: string[]
}

/** 待办自定义分组（每人唯一一个 isDefault = true 的「默认待办」分组） */
export const todoGroups = pgTable(
  'todo_groups',
  {
    ...id,
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    isDefault: boolean().notNull().default(false),
    sortOrder: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('todo_groups_user_id_name_key').on(t.userId, t.name),
    uniqueIndex('todo_groups_user_id_default_key')
      .on(t.userId)
      .where(sql`${t.isDefault} = true`),
    index('todo_groups_user_id_sort_order_idx').on(t.userId, t.sortOrder, t.createdAt),
  ],
)

/** 用户自定义待办标签词库 */
export const todoTags = pgTable(
  'todo_tags',
  {
    ...id,
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [uniqueIndex('todo_tags_user_id_name_key').on(t.userId, t.name)],
)

/** 待办（Todo v2：分组 + 四象限优先级 + 自定义标签 + 2000 字备注 + 30 天懒归档 + 组内拖拽排序） */
export const todos = pgTable(
  'todos',
  {
    ...id,
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    groupId: uuid()
      .notNull()
      .references(() => todoGroups.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    // 可空：备注可选，上限 2000 字
    note: text(),
    // 可空：DDL 可以不设
    dueAt: timestamptz(),
    priority: text().$type<TodoPriority>().notNull().default('not-important-not-urgent'),
    tags: jsonb()
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    status: text().$type<TodoLifecycleStatus>().notNull().default('open'),
    // 可空：未完成时为空（兼容保留）
    doneAt: timestamptz(),
    // 可空：放弃时刻
    abandonedAt: timestamptz(),
    // 可空：放弃原因（上限 120 字）
    abandonReason: text(),
    // 可空：终态时刻 = doneAt 或 abandonedAt，用于 30 天懒归档与倒序分页
    settledAt: timestamptz(),
    sortOrder: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index('todos_user_id_done_at_idx').on(t.userId, t.doneAt),
    index('todos_user_id_due_at_idx').on(t.userId, t.dueAt),
    index('todos_user_status_group_sort_idx').on(
      t.userId,
      t.status,
      t.groupId,
      t.sortOrder,
      t.dueAt,
      t.createdAt,
    ),
    index('todos_user_status_settled_idx').on(t.userId, t.status, t.settledAt, t.id),
    index('todos_user_status_priority_created_idx').on(
      t.userId,
      t.status,
      t.priority,
      t.createdAt,
      t.id,
    ),
    index('todos_tags_gin_idx').using('gin', t.tags),
  ],
)

/** 待办过程事件流（只增不改；待办删除后 todoId 置空保留标题与分组快照，供过程时间轴与 AI 复盘） */
export const todoEvents = pgTable(
  'todo_events',
  {
    ...id,
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // 可空：原待办被删除后自动 SET NULL，快照字段保留历史轨迹
    todoId: uuid().references(() => todos.id, { onDelete: 'set null' }),
    eventType: text().$type<TodoEventType>().notNull(),
    todoTitle: text().notNull(),
    groupName: text().notNull(),
    meta: jsonb()
      .$type<TodoEventMeta>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    occurredAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [
    index('todo_events_user_occurred_idx').on(t.userId, t.occurredAt, t.id),
    index('todo_events_todo_occurred_idx').on(t.todoId, t.occurredAt),
  ],
)
