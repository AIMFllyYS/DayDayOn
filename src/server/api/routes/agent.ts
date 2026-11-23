import 'server-only'
import { bodyLimit } from 'hono/body-limit'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import * as z from 'zod'
import {
  AgentConversationDetailSchema,
  AgentConversationListSchema,
  ConversationIdParamSchema,
  RenameConversationSchema,
} from '@/features/agent/schemas'
import { validateInlineJpegDataUrl } from '@/server/ai/image'
import { loadConversationMessages, streamAgentChat } from '@/server/ai/run-agent'
import {
  deleteConversation,
  getConversation,
  listConversations,
  renameConversation,
} from '@/server/services/agent/conversations'
import type { AppEnv } from '../app'
import { ApiError } from '../errors'
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

const ChatRequestSchema = z
  .object({
    /** 会话 id（客户端 crypto.randomUUID()，不存在时服务端自动创建） */
    id: z.uuid(),
    /** 本条用户消息（UIMessage） */
    message: z.object({
      id: z.string().min(1).max(128),
      role: z.enum(['user', 'assistant']),
      parts: z.array(z.unknown()),
    }),
    deepThink: z.boolean().default(false),
    idempotencyKey: z.uuid(),
  })
  .meta({ id: 'AgentChatRequest' })

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
    200: { content: json(AgentConversationDetailSchema), description: '会话 + 消息' },
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

const AGENT_CHAT_MAX_BODY_BYTES = 11 * 1024 * 1024
const chatTooLarge = new ApiError(
  'PAYLOAD_TOO_LARGE',
  '对话附件体积超过上限（最多 2 张图片，单张不超过 4 MB）',
)

function validateChatMessageFileParts(parts: readonly unknown[]): void {
  let imageCount = 0
  for (const part of parts) {
    if (typeof part !== 'object' || part === null) continue
    const rec = part as { type?: unknown; mediaType?: unknown; url?: unknown }
    if (rec.type !== 'file') continue
    imageCount += 1
    if (imageCount > 2) {
      throw new ApiError('VALIDATION_FAILED', '单次对话最多同时上传 2 张图片', {
        fields: { message: ['单次对话最多同时上传 2 张图片'] },
      })
    }
    if (rec.mediaType !== 'image/jpeg') {
      throw new ApiError('VALIDATION_FAILED', '只接受 image/jpeg 图片', {
        fields: { message: ['图片格式不对，请重新选择'] },
      })
    }
    validateInlineJpegDataUrl(rec.url)
  }
}

const chatRoute = createRoute({
  method: 'post',
  path: '/agent/chat',
  tags: ['agent'],
  summary: 'Agent 流式对话（SSE）',
  middleware: [
    requireUser,
    requireOnboarded,
    bodyLimit({
      maxSize: AGENT_CHAT_MAX_BODY_BYTES,
      onError: (c) => c.json(chatTooLarge.toBody(), chatTooLarge.status),
    }),
    rateLimit({ rule: { name: 'agent-chat-minute', windowSeconds: 60, max: 6 }, by: 'user' }),
  ] as const,
  request: {
    body: { content: json(ChatRequestSchema), required: true },
  },
  responses: {
    200: {
      content: { 'text/event-stream': { schema: z.string() } },
      description: '流式对话响应（UI message stream）',
    },
    ...errorResponses(
      ...AUTH_ERRORS,
      'VALIDATION_FAILED',
      'QUOTA_INSUFFICIENT',
      'IDEMPOTENCY_KEY_REUSED',
      'REQUEST_IN_PROGRESS',
      'PAYLOAD_TOO_LARGE',
      'RATE_LIMITED',
      'AI_PAUSED',
    ),
  },
})

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
  .openapi(chatRoute, async (c) => {
    const { id, message, deepThink, idempotencyKey } = c.req.valid('json')
    validateChatMessageFileParts(message.parts)
    const previous = await loadConversationMessages(c.get('user').id, id, { allowMissing: true })
    // 若客户端重试同一条用户消息（regenerate），截断该消息及其后的旧失败回复，避免把坏回复重新喂给模型
    const existingIdx = previous.findIndex((m) => m.id === message.id)
    const history = existingIdx >= 0 ? previous.slice(0, existingIdx) : previous
    type ChatMessage = Parameters<typeof streamAgentChat>[0]['messages'][number]
    return streamAgentChat({
      userId: c.get('user').id,
      ip: c.get('ip'),
      idempotencyKey,
      conversationId: id,
      messages: [...history, message as unknown as ChatMessage],
      deepThink,
    })
  })
