import { index, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core'
import { user } from './auth'
import { id, timestamptz } from './columns'

/**
 * 1v1 好友私聊消息表（Issue #25 · #26 · M6 · Decision #6）
 * 仅存储纯文本消息（单条 ≤ 300 字），严格遵守服务器零媒体落盘规范。
 * 解除好友后保留历史消息供只读归档查阅（isFrozen: true），严禁向已解除好友发送新消息。
 */
export const chatMessages = pgTable(
  'chat_messages',
  {
    ...id,
    senderId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    recipientId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    content: varchar({ length: 300 }).notNull(),
    idempotencyKey: text().notNull(),
    readAt: timestamptz(),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [
    index('chat_messages_conversation_idx').on(t.senderId, t.recipientId, t.createdAt.desc()),
    index('chat_messages_recipient_unread_idx').on(t.recipientId, t.readAt),
    uniqueIndex('chat_messages_sender_idempotency_idx').on(t.senderId, t.idempotencyKey),
  ],
)

export type ChatMessage = typeof chatMessages.$inferSelect
export type NewChatMessage = typeof chatMessages.$inferInsert
