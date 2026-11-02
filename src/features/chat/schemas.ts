import * as z from 'zod'
import { IdSchema, InstantSchema, UserIdSchema } from '@/features/shared/schemas'

/**
 * 1v1 好友私聊单条消息 DTO（Issue #25 · #26 · M6）
 */
export const ChatMessageSchema = z.object({
  id: IdSchema,
  senderId: UserIdSchema,
  recipientId: UserIdSchema,
  content: z.string().min(1).max(300),
  idempotencyKey: z.string().optional(),
  createdAt: InstantSchema,
  readAt: InstantSchema.nullable().optional(),
  isMine: z.boolean().optional(),
})
export type ChatMessageDto = z.infer<typeof ChatMessageSchema>

/**
 * 发送私聊消息请求体
 */
export const SendChatMessageInputSchema = z.object({
  content: z
    .string({ error: '请输入消息内容' })
    .trim()
    .min(1, { error: '请输入消息内容' })
    .max(300, { error: '消息长度不能超过 300 字' }),
  idempotencyKey: z.string().optional(),
})
export type SendChatMessageInput = z.infer<typeof SendChatMessageInputSchema>

/**
 * 查询私聊历史分页请求参数
 */
export const ChatHistoryQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
})
export type ChatHistoryQuery = z.infer<typeof ChatHistoryQuerySchema>

/**
 * 私聊历史分页响应
 */
export const ChatHistoryResponseSchema = z.object({
  messages: z.array(ChatMessageSchema),
  nextCursor: z.string().nullable(),
  isFrozen: z.boolean(),
  friend: z
    .object({
      userId: UserIdSchema,
      nickname: z.string(),
      avatar: z.string().nullable(),
      mascot: z.string().nullable().optional(),
    })
    .optional(),
})
export type ChatHistoryResponse = z.infer<typeof ChatHistoryResponseSchema>

/**
 * 发送私聊消息响应
 */
export const SendChatMessageResponseSchema = z.object({
  message: ChatMessageSchema,
})
export type SendChatMessageResponse = z.infer<typeof SendChatMessageResponseSchema>

/**
 * 会话列表中的单条会话概要 DTO
 */
export const ChatThreadSchema = z.object({
  friendUserId: UserIdSchema,
  friend: z.object({
    userId: UserIdSchema,
    nickname: z.string(),
    avatar: z.string().nullable(),
    mascot: z.string().nullable().optional(),
  }),
  lastMessage: z
    .object({
      id: IdSchema,
      content: z.string(),
      createdAt: InstantSchema,
      senderId: UserIdSchema,
    })
    .nullable(),
  unreadCount: z.number().int().nonnegative(),
  isFrozen: z.boolean(),
})
export type ChatThreadDto = z.infer<typeof ChatThreadSchema>

/**
 * 会话列表响应
 */
export const ChatThreadsResponseSchema = z.object({
  threads: z.array(ChatThreadSchema),
})
export type ChatThreadsResponse = z.infer<typeof ChatThreadsResponseSchema>

/**
 * 标记已读响应
 */
export const MarkChatReadResponseSchema = z.object({
  success: z.boolean(),
  markedCount: z.number().int().nonnegative(),
})
export type MarkChatReadResponse = z.infer<typeof MarkChatReadResponseSchema>
