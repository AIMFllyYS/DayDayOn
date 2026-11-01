import 'server-only'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { AiRunListSchema, QuotaViewSchema } from '@/features/quota/schemas'
import { db } from '@/server/db/client'
import { getQuotaView, listAiRuns } from '@/server/services/quota-view'
import type { AppEnv } from '../app'
import { requireOnboarded, requireUser } from '../middleware/auth'
import { AUTH_ERRORS, errorResponses } from '../schemas'

/*
 * 我的额度（PRD 2.7）。实现：D6。
 *   GET /me/quota    QuotaViewSchema
 *   GET /me/ai-runs  AiRunListSchema（最近 20 次）
 */

const quotaRoute = createRoute({
  method: 'get',
  path: '/me/quota',
  summary: '本周 AI 额度、加购余额、周期结束时间',
  middleware: [requireUser, requireOnboarded] as const,
  responses: {
    200: { content: { 'application/json': { schema: QuotaViewSchema } }, description: '额度' },
    ...errorResponses(...AUTH_ERRORS),
  },
})

const aiRunsRoute = createRoute({
  method: 'get',
  path: '/me/ai-runs',
  summary: '最近 20 次 AI 调用（用途、时间、花费）',
  middleware: [requireUser, requireOnboarded] as const,
  responses: {
    200: { content: { 'application/json': { schema: AiRunListSchema } }, description: '调用记录' },
    ...errorResponses(...AUTH_ERRORS),
  },
})

export const quotaRoutes = new OpenAPIHono<AppEnv>()
  .openapi(quotaRoute, async (c) => c.json(await getQuotaView(c.get('user').id), 200))
  .openapi(aiRunsRoute, async (c) => c.json(await listAiRuns(db, c.get('user').id), 200))
