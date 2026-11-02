import { index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth'
import { id, timestamps, timestamptz } from './columns'

/**
 * Agent 对话（悬浮团团的弹窗与全屏页）。会话 + 消息两张表，用户注销时级联删除。
 * 图片附件永不落盘（AGENTS.md / ai-and-quota.md）：入库前把 file part 换成一行文字说明。
 * parts 存 UIMessage.parts 的原始 JSON（不含图片字节），读取时用 validateUIMessages 校验。
 */

export type AgentMessageRole = 'user' | 'assistant'

/** 一次 Agent 对话（对应全屏页 /agent/[id]，也用于弹窗里的历史列表） */
export const agentConversations = pgTable(
  'agent_conversations',
  {
    ...id,
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** 标题：新建时取首条用户消息前 20 字，可在历史里重命名 */
    title: text().notNull().default('新对话'),
    lastMessageAt: timestamptz().notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [index('agent_conversations_user_id_last_message_at_idx').on(t.userId, t.lastMessageAt)],
)

export const agentMessages = pgTable(
  'agent_messages',
  {
    ...id,
    conversationId: uuid()
      .notNull()
      .references(() => agentConversations.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** UIMessage.id：用户消息由客户端生成，助手消息由服务端生成，同一会话内唯一 */
    messageId: text().notNull(),
    role: text().$type<AgentMessageRole>().notNull(),
    parts: jsonb().$type<unknown[]>().notNull(),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [
    // 幂等写入：同一 (conversationId, messageId) 重复保存只保留第一条
    uniqueIndex('agent_messages_conversation_id_message_id_key').on(t.conversationId, t.messageId),
    index('agent_messages_conversation_id_created_at_idx').on(t.conversationId, t.createdAt),
    index('agent_messages_user_id_created_at_idx').on(t.userId, t.createdAt),
  ],
)
