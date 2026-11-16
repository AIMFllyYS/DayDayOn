import 'server-only'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import * as z from 'zod'
import { CreateCheckinSchema } from '@/features/checkin/schemas'
import { GoalIdParamSchema } from '@/features/goal/schemas'
import { startReferee } from '@/server/services/referee'
import type { AppEnv } from '../app'
import { requireOnboarded, requireUser } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'
import { AUTH_ERRORS, errorResponses } from '../schemas'

/*
 * Agent 裁判接口（checkin-modules.md 第 4 节）。
 *   POST /goals/{goalId}/referee   流式（UI message stream）：预占额度 → 裁判 Agent → 结算；不写业务表
 * 请求体：{ checkin: 创建打卡的请求体, idempotencyKey, conversation? }。
 * 带 conversation 时分析跑在那个 Agent 会话里（不存在就新建），用户消息与分析回合都落库，历史对话里能看到。
 * 和 Agent 对话一样不走幂等中间件（流式响应体无法缓存）；重复的 idempotencyKey 在额度层被拒绝。
 */

/** 「让 Agent 分析」= 在一个新的 Agent 会话里分析：用户那句话和分析过程都存进对话历史 */
const RefereeConversationSchema = z.object({
  id: z.uuid(),
  messageId: z.string().min(1).max(100),
  text: z.string().trim().min(1).max(500),
})

const RefereeRequestSchema = z
  .object({
    checkin: CreateCheckinSchema,
    idempotencyKey: z.uuid(),
    conversation: RefereeConversationSchema.optional(),
  })
  .meta({ id: 'RefereeRequest' })

const refereeRoute = createRoute({
  method: 'post',
  path: '/goals/{goalId}/referee',
  tags: ['referee'],
  summary: '打卡裁判分析（流式 SSE）',
  middleware: [
    requireUser,
    requireOnboarded,
    rateLimit({ rule: { name: 'referee-minute', windowSeconds: 60, max: 8 }, by: 'user' }),
  ] as const,
  request: {
    params: GoalIdParamSchema,
    body: { content: { 'application/json': { schema: RefereeRequestSchema } }, required: true },
  },
  responses: {
    200: {
      content: { 'text/event-stream': { schema: z.string() } },
      description: '流式裁判响应（UI message stream）',
    },
    ...errorResponses(
      ...AUTH_ERRORS,
      'VALIDATION_FAILED',
      'QUOTA_INSUFFICIENT',
      'GOAL_NOT_FOUND',
      'IDEMPOTENCY_KEY_REUSED',
      'REQUEST_IN_PROGRESS',
      'RATE_LIMITED',
      'AI_PAUSED',
    ),
  },
})

export const refereeRoutes = new OpenAPIHono<AppEnv>().openapi(refereeRoute, async (c) => {
  const { goalId } = c.req.valid('param')
  const body = c.req.valid('json')
  return startReferee({
    userId: c.get('user').id,
    ip: c.get('ip'),
    idempotencyKey: body.idempotencyKey,
    goalId,
    checkin: body.checkin,
    conversation: body.conversation ?? null,
  })
})
