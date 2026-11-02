import 'server-only'
import { Hono } from 'hono'
import { createRoute, OpenAPIHono, type z } from '@hono/zod-openapi'
import * as zz from 'zod'
import {
  AgentConversationListSchema,
  AgentConversationSchema,
  ConversationIdParamSchema,
  RenameConversationSchema,
} from '@/features/agent/schemas'
import { loadConversationMessages, streamAgentChat } from '@/server/ai/run-agent'
import {
  deleteConversation,
  getConversation,
  listConversations,
  renameConversation,
} from '@/server/services/agent/conversations'
import type { AppEnv } from '../app'
import { requireOnboarded, requireUser } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'
import { AUTH_ERRORS, errorResponses } from '../schemas'

/*
 * Agent 对话接口。
 *   POST /agent/chat                      流式（SSE）：预占额度 → ToolLoopAgent → 结算，消息落库
 *   GET  /agent/conversations             历史列表（下拉菜单 / 全屏侧栏）
 *   GET  /agent/conversations/{id}        单个会话 + 消息（全屏页初次加载）
 *   PATCH  /agent/conversations/{id}      重命名
 *   DELETE /agent/conversations/{id}      删除
 * 流式接口不走幂等中间件（无法缓存流式响应体）；幂等由 run-agent 的 rejectReusedKey 在额度层保证。
 */

const json = <T extends z.ZodType>(schema: T) => ({ 'application/json': { schema } })

const ChatRequestSchema = zz.object({
  /** 会话 id（客户端 crypto.randomUUID()，不存在时服务端自动创建） */
  id: zz.string().uuid(),
  /** 本条用户消息（UIMessage） */
  message: zz.object({
    id: zz.string().min(1).max(128),
    role: zz.enum(['user', 'assistant']),
    parts: zz.array(zz.unknown()),
  }),
  deepThink: zz.boolean().default(false),
  idempotencyKey: zz.string().uuid(),
})

const MessagesResponseSchema = zz.object({
  conversation: AgentConversationSchema,
  messages: zz.array(zz.unknown()),
})

const listRoute = createRoute({
  method: 'get',
  path: '/agent/conversations',
  tags: ['agent'],
  summary: 'Agent 会话列表',
  middleware: [requireUser, requireOnboarded] as const,
  responses: {
    200: { content: json(AgentConversationListSchema), description: '最近会话' },
    ...errorResponses(...AUTH_ERRORS),
  },
})

const getRoute = createRoute({
  method: 'get',
  path: '/agent/conversations/{conversationId}',
  tags: ['agent'],
  summary: '单个会话与消息',
  middleware: [requireUser, requireOnboarded] as const,
  request: { params: ConversationIdParamSchema },
  responses: {
    200: { content: json(MessagesResponseSchema), description: '会话 + 消息' },
    ...errorResponses(...AUTH_ERRORS, 'NOT_FOUND'),
  },
})

const renameRoute = createRoute({
  method: 'patch',
  path: '/agent/conversations/{conversationId}',
  tags: ['agent'],
  summary: '重命名会话',
  middleware: [requireUser, requireOnboarded] as const,
  request: {
    params: ConversationIdParamSchema,
    body: { content: json(RenameConversationSchema), required: true },
  },
  responses: {
    204: { description: '已重命名' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED', 'NOT_FOUND'),
  },
})

const deleteRoute = createRoute({
  method: 'delete',
  path: '/agent/conversations/{conversationId}',
  tags: ['agent'],
  summary: '删除会话',
  middleware: [requireUser, requireOnboarded] as const,
  request: { params: ConversationIdParamSchema },
  responses: {
    204: { description: '已删除' },
    ...errorResponses(...AUTH_ERRORS, 'NOT_FOUND'),
  },
})

/** 流式接口单独挂：`.post()` 会丢失 OpenAPIHono 的类型，合并到 OpenAPI 子应用里 */
const agentChat = new Hono<AppEnv>().post(
  '/agent/chat',
  requireUser,
  requireOnboarded,
  rateLimit({ rule: { name: 'agent-chat-minute', windowSeconds: 60, max: 6 }, by: 'user' }),
  async (c) => {
    const parsed = ChatRequestSchema.safeParse(await c.req.json())
    if (!parsed.success) {
      return c.json(
        {
          code: 'VALIDATION_FAILED',
          detail: '请求体校验失败',
          fields: zz.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
        },
        400,
      )
    }
    const { id, message, deepThink, idempotencyKey } = parsed.data
    const previous = await loadConversationMessages(c.get('user').id, id)
    type ChatMessage = Parameters<typeof streamAgentChat>[0]['messages'][number]
    return streamAgentChat({
      userId: c.get('user').id,
      ip: c.get('ip'),
      idempotencyKey,
      conversationId: id,
      messages: [...previous, message as unknown as ChatMessage],
      deepThink,
    })
  },
)

export const agentRoutes = new OpenAPIHono<AppEnv>()
  .openapi(listRoute, async (c) => {
    const items = await listConversations(c.get('user').id)
    return c.json({ items }, 200)
  })
  .openapi(getRoute, async (c) => {
    const { conversationId } = c.req.valid('param')
    const userId = c.get('user').id
    const [conversation, messages] = await Promise.all([
      getConversation(userId, conversationId),
      loadConversationMessages(userId, conversationId),
    ])
    return c.json({ conversation, messages }, 200)
  })
  .openapi(renameRoute, async (c) => {
    const { conversationId } = c.req.valid('param')
    const { title } = c.req.valid('json')
    await renameConversation(c.get('user').id, conversationId, title)
    return c.body(null, 204)
  })
  .openapi(deleteRoute, async (c) => {
    const { conversationId } = c.req.valid('param')
    await deleteConversation(c.get('user').id, conversationId)
    return c.body(null, 204)
  })
  .route('/', agentChat)
