import { index, pgTable, text } from 'drizzle-orm/pg-core'
import { user } from './auth'
import { id, timestamps, timestamptz } from './columns'

export type TodoPriority = 'normal' | 'important'

/** 待办（PRD 2.10） */
export const todos = pgTable(
  'todos',
  {
    ...id,
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    // 可空：DDL 可以不设
    dueAt: timestamptz(),
    priority: text().$type<TodoPriority>().notNull().default('normal'),
    // 可空：未完成时为空
    doneAt: timestamptz(),
    ...timestamps,
  },
  (t) => [
    index('todos_user_id_done_at_idx').on(t.userId, t.doneAt),
    index('todos_user_id_due_at_idx').on(t.userId, t.dueAt),
  ],
)
