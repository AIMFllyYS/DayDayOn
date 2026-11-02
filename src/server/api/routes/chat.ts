import 'server-only'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import * as z from 'zod'
import {
  ChatHistoryQuerySchema,
  ChatHistoryResponseSchema,
  ChatThreadsResponseSchema,
  MarkChatReadResponseSchema,
  SendChatMessageInputSchema,
  SendChatMessageResponseSchema,
} from '@/features/chat/schemas'
import { UserIdSchema } from '@/features/shared/schemas'
import { db } from '@/server/db/client'
import * as chatService from '@/server/services/chat'
import type { AppEnv } from '../app'
import { requireOnboarded, requireUser } from '../middleware/auth'
import { AUTH_ERRORS, errorResponses } from '../schemas'

/*
 * 1v1 好友私聊接口（Issue #25 · #26 · M6 · Decision #4 & #6）：
 *   GET  /chats                     获取当前用户的会话列表
 *   GET  /chats/{friendUserId}      获取与指定好友的历史记录（支持游标分页与只读冻结归档模式）
 *   POST /chats/{friendUserId}      发送纯文本私聊消息（集成 M5 本地 DFA 过滤与解除好友拦截）
 *   POST /chats/{friendUserId}/read 批量将来自指定好友的消息标记为已读
 *
 * 兼容别名路径：
 *   GET  /friends/{friendUserId}/chat
 *   POST /friends/{friendUserId}/chat
 */

const json = <T extends z.ZodType>(schema: T) => ({ 'application/json': { schema } })

const FriendIdParamSchema = z.object({
  friendUserId: UserIdSchema,
})

const getChatThreadsRoute = createRoute({
  method: 'get',
  path: '/chats',
  tags: ['chat'],
  summary: '获取当前用户的私聊会话列表',
  middleware: [requireUser, requireOnboarded] as const,
  responses: {
    200: { content: json(ChatThreadsResponseSchema), description: '私聊会话列表' },
    ...errorResponses(...AUTH_ERRORS),
  },
})

const getChatHistoryRoute = createRoute({
  method: 'get',
  path: '/chats/{friendUserId}',
  tags: ['chat'],
  summary: '获取与指定好友的 1v1 私聊历史记录',
  middleware: [requireUser, requireOnboarded] as const,
  request: {
    params: FriendIdParamSchema,
    query: ChatHistoryQuerySchema,
  },
  responses: {
    200: { content: json(ChatHistoryResponseSchema), description: '私聊历史记录与只读冻结状态' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED', 'FRIEND_NOT_FOUND'),
  },
})

const sendChatMessageRoute = createRoute({
  method: 'post',
  path: '/chats/{friendUserId}',
  tags: ['chat'],
  summary: '向指定好友发送 1v1 私聊消息',
  middleware: [requireUser, requireOnboarded] as const,
  request: {
    params: FriendIdParamSchema,
    body: { content: json(SendChatMessageInputSchema), required: true },
  },
  responses: {
    201: { content: json(SendChatMessageResponseSchema), description: '消息发送成功' },
    ...errorResponses(
      ...AUTH_ERRORS,
      'VALIDATION_FAILED',
      'FRIEND_RELATION_FROZEN',
      'CONTENT_SENSITIVE',
      'USER_MUTED',
      'FORBIDDEN',
    ),
  },
})

const markChatReadRoute = createRoute({
  method: 'post',
  path: '/chats/{friendUserId}/read',
  tags: ['chat'],
  summary: '批量将指定好友发来的私聊消息标记为已读',
  middleware: [requireUser, requireOnboarded] as const,
  request: {
    params: FriendIdParamSchema,
  },
  responses: {
    200: { content: json(MarkChatReadResponseSchema), description: '批量标记已读成功' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED'),
  },
})

const getFriendsChatHistoryRoute = createRoute({
  method: 'get',
  path: '/friends/{friendUserId}/chat',
  tags: ['chat'],
  summary: '获取与指定好友的 1v1 私聊历史记录（别名）',
  middleware: [requireUser, requireOnboarded] as const,
  request: {
    params: FriendIdParamSchema,
    query: ChatHistoryQuerySchema,
  },
  responses: {
    200: { content: json(ChatHistoryResponseSchema), description: '私聊历史记录与只读冻结状态' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED', 'FRIEND_NOT_FOUND'),
  },
})

const sendFriendsChatMessageRoute = createRoute({
  method: 'post',
  path: '/friends/{friendUserId}/chat',
  tags: ['chat'],
  summary: '向指定好友发送 1v1 私聊消息（别名）',
  middleware: [requireUser, requireOnboarded] as const,
  request: {
    params: FriendIdParamSchema,
    body: { content: json(SendChatMessageInputSchema), required: true },
  },
  responses: {
    201: { content: json(SendChatMessageResponseSchema), description: '消息发送成功' },
    ...errorResponses(
      ...AUTH_ERRORS,
      'VALIDATION_FAILED',
      'FRIEND_RELATION_FROZEN',
      'CONTENT_SENSITIVE',
      'USER_MUTED',
      'FORBIDDEN',
    ),
  },
})

export const chatRoutes = new OpenAPIHono<AppEnv>()
  .openapi(getChatThreadsRoute, async (c) => {
    const data = await chatService.getChatThreads(db, c.get('user').id)
    return c.json(data, 200)
  })
  .openapi(getChatHistoryRoute, async (c) => {
    const { friendUserId } = c.req.valid('param')
    const query = c.req.valid('query')
    const data = await chatService.getChatHistory(
      db,
      c.get('user').id,
      friendUserId,
      query,
      new Date(),
    )
    return c.json(data, 200)
  })
  .openapi(sendChatMessageRoute, async (c) => {
    const { friendUserId } = c.req.valid('param')
    const body = c.req.valid('json')
    const data = await chatService.sendChatMessage(
      db,
      c.get('user').id,
      friendUserId,
      body,
      new Date(),
    )
    return c.json(data, 201)
  })
  .openapi(markChatReadRoute, async (c) => {
    const { friendUserId } = c.req.valid('param')
    const data = await chatService.markChatRead(db, c.get('user').id, friendUserId, new Date())
    return c.json(data, 200)
  })
  .openapi(getFriendsChatHistoryRoute, async (c) => {
    const { friendUserId } = c.req.valid('param')
    const query = c.req.valid('query')
    const data = await chatService.getChatHistory(
      db,
      c.get('user').id,
      friendUserId,
      query,
      new Date(),
    )
    return c.json(data, 200)
  })
  .openapi(sendFriendsChatMessageRoute, async (c) => {
    const { friendUserId } = c.req.valid('param')
    const body = c.req.valid('json')
    const data = await chatService.sendChatMessage(
      db,
      c.get('user').id,
      friendUserId,
      body,
      new Date(),
    )
    return c.json(data, 201)
  })
