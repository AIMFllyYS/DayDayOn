import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import type { AgentConversation } from '@/features/agent/schemas'
import { ApiError } from '@/server/api/errors'
import type { DbOrTx } from '@/server/db/client'
import { db } from '@/server/db/client'
import { agentConversations, agentMessages } from '@/server/db/schema'
import type { AgentMessageRole } from '@/server/db/schema/agent'

/*
 * Agent 会话与消息的持久化。图片永不落盘：入库前把 file part 换成一行文字说明（ai-and-quota.md）。
 * 消息按 (conversationId, messageId) 幂等写入：重放或重试不会重复。
 */

const LIST_LIMIT = 50
const TITLE_FROM_TEXT_MAX = 20

const conversationColumns = {
  id: agentConversations.id,
  title: agentConversations.title,
  lastMessageAt: agentConversations.lastMessageAt,
  createdAt: agentConversations.createdAt,
}

function toConversationDto(row: {
  id: string
  title: string
  lastMessageAt: Date
  createdAt: Date
}): AgentConversation {
  return {
    id: row.id,
    title: row.title,
    lastMessageAt: row.lastMessageAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}

/** 首条用户消息的纯文本 → 会话标题（前 20 字） */
export function titleFromFirstUserText(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return '新对话'
  return t.length > TITLE_FROM_TEXT_MAX ? `${t.slice(0, TITLE_FROM_TEXT_MAX)}…` : t
}

/** 去掉图片 file part：换成一行文字说明，合并连续图片为一条 */
export function stripFileParts(parts: unknown[]): unknown[] {
  const out: unknown[] = []
  let pendingImages = 0
  const flush = () => {
    if (pendingImages > 0) {
      out.push({
        type: 'text',
        text: `${pendingImages} 张照片（识别后不保存）`,
      })
      pendingImages = 0
    }
  }
  for (const part of parts) {
    if (typeof part === 'object' && part !== null && (part as { type?: string }).type === 'file') {
      pendingImages += 1
      continue
    }
    flush()
    out.push(part)
  }
  flush()
  return out
}

export async function listConversations(userId: string): Promise<AgentConversation[]> {
  const rows = await db
    .select(conversationColumns)
    .from(agentConversations)
    .where(eq(agentConversations.userId, userId))
    .orderBy(desc(agentConversations.lastMessageAt))
    .limit(LIST_LIMIT)
  return rows.map(toConversationDto)
}

export async function getConversation(
  userId: string,
  conversationId: string,
): Promise<AgentConversation> {
  const [row] = await db
    .select(conversationColumns)
    .from(agentConversations)
    .where(and(eq(agentConversations.id, conversationId), eq(agentConversations.userId, userId)))
    .limit(1)
  if (!row) throw new ApiError('NOT_FOUND', '对话不存在')
  return toConversationDto(row)
}

/** 落库/读出的消息形状：parts 是 UIMessage.parts 的原始 JSON（不含图片字节） */
export interface StoredMessage {
  id: string
  role: AgentMessageRole
  parts: unknown[]
  createdAt?: Date
}

export async function loadMessages(
  dbOrTx: DbOrTx,
  userId: string,
  conversationId: string,
): Promise<StoredMessage[]> {
  const [conversation] = await dbOrTx
    .select({ id: agentConversations.id })
    .from(agentConversations)
    .where(and(eq(agentConversations.id, conversationId), eq(agentConversations.userId, userId)))
    .limit(1)
  if (!conversation) throw new ApiError('NOT_FOUND', '对话不存在')

  const rows = await dbOrTx
    .select({
      messageId: agentMessages.messageId,
      role: agentMessages.role,
      parts: agentMessages.parts,
      createdAt: agentMessages.createdAt,
    })
    .from(agentMessages)
    .where(and(eq(agentMessages.conversationId, conversationId), eq(agentMessages.userId, userId)))
    .orderBy(agentMessages.createdAt, agentMessages.id)
    .limit(500)

  return rows.map((r) => ({
    id: r.messageId,
    role: r.role,
    parts: r.parts as unknown[],
    createdAt: r.createdAt,
  }))
}

/** 会话不存在时创建（幂等），返回是否已存在 */
export async function ensureConversation(
  dbOrTx: DbOrTx,
  userId: string,
  conversationId: string,
  title: string,
  now: Date,
): Promise<void> {
  await dbOrTx
    .insert(agentConversations)
    .values({
      id: conversationId,
      userId,
      title,
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
}

export async function touchConversation(
  dbOrTx: DbOrTx,
  userId: string,
  conversationId: string,
  now: Date,
): Promise<void> {
  await dbOrTx
    .update(agentConversations)
    .set({ lastMessageAt: now, updatedAt: now })
    .where(and(eq(agentConversations.id, conversationId), eq(agentConversations.userId, userId)))
}

export async function renameConversation(
  userId: string,
  conversationId: string,
  title: string,
): Promise<void> {
  const [row] = await db
    .update(agentConversations)
    .set({ title, updatedAt: new Date() })
    .where(and(eq(agentConversations.id, conversationId), eq(agentConversations.userId, userId)))
    .returning({ id: agentConversations.id })
  if (!row) throw new ApiError('NOT_FOUND', '对话不存在')
}

export async function deleteConversation(userId: string, conversationId: string): Promise<void> {
  const rows = await db
    .delete(agentConversations)
    .where(and(eq(agentConversations.id, conversationId), eq(agentConversations.userId, userId)))
    .returning({ id: agentConversations.id })
  if (rows.length === 0) throw new ApiError('NOT_FOUND', '对话不存在')
}

interface StoredMessageInput {
  messageId: string
  role: AgentMessageRole
  parts: unknown[]
  createdAt: Date
}

/** 幂等写入一轮消息：文件 part 已去掉图片，同 (conversationId, messageId) 重复不报错 */
export async function saveMessages(
  dbOrTx: DbOrTx,
  userId: string,
  conversationId: string,
  messages: StoredMessageInput[],
): Promise<void> {
  if (messages.length === 0) return
  await dbOrTx
    .insert(agentMessages)
    .values(
      messages.map((m) => ({
        conversationId,
        userId,
        messageId: m.messageId,
        role: m.role,
        parts: m.parts,
        createdAt: m.createdAt,
      })),
    )
    .onConflictDoNothing({ target: [agentMessages.conversationId, agentMessages.messageId] })
}
