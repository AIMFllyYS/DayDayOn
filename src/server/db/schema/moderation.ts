import { index, pgTable, text } from 'drizzle-orm/pg-core'
import { user } from './auth'
import { id, timestamptz } from './columns'

export type ModerationAction = 'chat' | 'nickname' | 'remark'

/**
 * 敏感词违规审计日志表（Issue #23 & #24 · M5）
 * 仅存储 SHA-256 哈希与命中分类，严禁明文入库与落盘，确保用户隐私安全。
 */
export const moderationViolations = pgTable(
  'moderation_violations',
  {
    ...id,
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    action: text().$type<ModerationAction>().notNull(),
    category: text().notNull(),
    contentHash: text().notNull(),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [index('moderation_violations_user_created_idx').on(t.userId, t.createdAt.desc())],
)

export type ModerationViolation = typeof moderationViolations.$inferSelect
export type NewModerationViolation = typeof moderationViolations.$inferInsert
