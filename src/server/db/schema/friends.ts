import { index, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { user } from './auth'
import { id, timestamps, timestamptz } from './columns'

/**
 * 好友配对邀请码（10 分钟有效，6 位随机数字，见 ADR-0026）。
 * 用户点击「发起邀请」时落库计时；有效期内未消费时再次进入返回同一配对码与原 expiresAt。
 */
export const friendInvites = pgTable(
  'friend_invites',
  {
    ...id,
    inviterId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    code: text().notNull(),
    expiresAt: timestamptz().notNull(),
    // 可空：尚未被好友接受时为空
    usedByUserId: text().references(() => user.id, { onDelete: 'set null' }),
    // 可空：尚未被好友接受时为空
    usedAt: timestamptz(),
    ...timestamps,
  },
  (t) => [
    index('friend_invites_inviter_id_idx').on(t.inviterId),
    index('friend_invites_code_idx').on(t.code),
  ],
)

/**
 * 双向好友关系表（ADR-0026）：接受邀请时在同一事务内写入 (A, B) 与 (B, A) 两行，
 * 使查询某人的好友列表与校验好友权限均为单次索引扫描。
 */
export const friendships = pgTable(
  'friendships',
  {
    ...id,
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    friendId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('friendships_user_id_friend_id_key').on(t.userId, t.friendId),
    index('friendships_user_id_idx').on(t.userId),
  ],
)
