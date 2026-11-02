import { index, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { user } from './auth'
import { id, timestamps, timestamptz } from './columns'

export type NotificationKind =
  'checkin_aggregate' | 'pet_interaction' | 'visit_footprint' | 'system' | 'friend'

export type NotificationMetadata = Record<string, unknown>

/**
 * 统一通知与消息表（Issue #20 · Decision #4 · M2）
 * 存储 5 分钟滑动窗口打卡聚合、宠物互动、24 小时造访足迹以及系统官方通知等。
 */
export const notifications = pgTable(
  'notifications',
  {
    ...id,
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    actorId: text().references(() => user.id, { onDelete: 'set null' }),
    kind: text().$type<NotificationKind>().notNull(),
    title: text().notNull(),
    content: text().notNull().default(''),
    metadata: jsonb().$type<NotificationMetadata>().notNull().default({}),
    readAt: timestamptz(),
    ...timestamps,
  },
  (t) => [
    index('notifications_user_id_idx').on(t.userId),
    index('notifications_user_id_read_at_idx').on(t.userId, t.readAt),
    index('notifications_user_id_created_at_idx').on(t.userId, t.createdAt),
    index('notifications_user_id_kind_idx').on(t.userId, t.kind),
  ],
)
