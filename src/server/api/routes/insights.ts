import 'server-only'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import * as z from 'zod'
import { InsightsSchema } from '@/features/insights/schemas'
import { db } from '@/server/db/client'
import { getInsights } from '@/server/services/insights'
import type { AppEnv } from '../app'
import { requireOnboarded, requireUser } from '../middleware/auth'
import { AUTH_ERRORS, errorResponses } from '../schemas'

/*
 * 板块近况（主页「各板块近况」、目标详情、Agent showStats 共用）。
 *
 *   GET    /insights?days=7|30&goalId=    InsightsSchema
 */

const QuerySchema = z.object({
  days: z
    .enum(['7', '30'])
    .default('7')
    .transform((v) => (v === '30' ? 30 : 7) as 7 | 30),
  goalId: z.uuid().optional(),
})

const getRoute = createRoute({
  method: 'get',
  path: '/insights',
  tags: ['dashboard'],
  summary: '每个进行中目标最近 7 / 30 天的近况',
  middleware: [requireUser, requireOnboarded] as const,
  request: { query: QuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: InsightsSchema } },
      description: '达标率、主数字、每天走势、最常没通过的规则、期限',
    },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED', 'USER_NOT_FOUND', 'GOAL_NOT_FOUND'),
  },
})

export const insightsRoutes = new OpenAPIHono<AppEnv>().openapi(getRoute, async (c) => {
  const q = c.req.valid('query')
  const data = await getInsights(db, c.get('user').id, new Date(), {
    days: q.days,
    ...(q.goalId ? { goalId: q.goalId } : {}),
  })
  return c.json(data, 200)
})
