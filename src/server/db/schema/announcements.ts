import { boolean, index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth'
import { id, timestamps, timestamptz } from './columns'

/**
 * 官方与系统公告表（Issue #80）
 * 支持直接在数据库中手动新增公告（指定标题、正文、分类标签、版本号与发布时间），
 * 无需向每个用户扇出复制记录；`published_at <= now()` 的记录对所有用户实时可见。
 */
export const announcements = pgTable(
  'announcements',
  {
    ...id,
    /** 可选幂等标识（供种子或发布脚本防重复写入；手动 SQL 插入可留空） */
    slug: text().unique(),
    /** 公告分类标签，例如「版本更新」「官方公告」「系统通知」 */
    tag: text().notNull().default('官方公告'),
    /** 关联版本号（可选，如 '0.1.9'） */
    version: text(),
    /** 公告标题 */
    title: text().notNull(),
    /** 公告正文（支持多行段落与要点列表） */
    content: text().notNull(),
    /** 是否置顶展示 */
    pinned: boolean().notNull().default(false),
    /** 公告发布时间（支持预设未来时间定时发布，默认当前时间） */
    publishedAt: timestamptz().notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [index('announcements_published_at_idx').on(t.publishedAt)],
)

/**
 * 用户官方公告已读记录表（Issue #80）
 * 复合主键 (user_id, announcement_id)，按需写入已读状态。
 */
export const announcementReads = pgTable(
  'announcement_reads',
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    announcementId: uuid()
      .notNull()
      .references(() => announcements.id, { onDelete: 'cascade' }),
    readAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.announcementId] }),
    index('announcement_reads_user_id_idx').on(t.userId),
  ],
)
