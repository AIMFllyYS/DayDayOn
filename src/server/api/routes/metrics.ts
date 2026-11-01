import 'server-only'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import {
  PutRatingSchema,
  PutWeightSchema,
  RatingSchema,
  WeightEntrySchema,
  WeightTrendQuerySchema,
  WeightTrendSchema,
} from '@/features/metric/schemas'
import { db } from '@/server/db/client'
import * as metrics from '@/server/services/metrics'
import type { AppEnv } from '../app'
import { requireOnboarded, requireUser } from '../middleware/auth'
import { AUTH_ERRORS, errorResponses } from '../schemas'

/*
 * 每日指标接口（PRD 2.5、7.2、7.5），D3。PUT 是覆盖写，天然幂等，不挂幂等中间件。
 */

const json = <T>(schema: T) => ({ 'application/json': { schema } })

const putWeightRoute = createRoute({
  method: 'put',
  path: '/metrics/weight',
  middleware: [requireUser, requireOnboarded] as const,
  request: { body: { content: json(PutWeightSchema), required: true } },
  responses: {
    200: { content: json(WeightEntrySchema), description: '已记录今天的体重' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED', 'WEIGHT_CHANGE_UNCONFIRMED'),
  },
})

const weightTrendRoute = createRoute({
  method: 'get',
  path: '/metrics/weight',
  middleware: [requireUser, requireOnboarded] as const,
  request: { query: WeightTrendQuerySchema },
  responses: {
    200: { content: json(WeightTrendSchema), description: '体重走势' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED'),
  },
})

const putRatingRoute = createRoute({
  method: 'put',
  path: '/ratings',
  middleware: [requireUser, requireOnboarded] as const,
  request: { body: { content: json(PutRatingSchema), required: true } },
  responses: {
    200: { content: json(RatingSchema), description: '已记录今天的满意度' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED'),
  },
})

export const metricRoutes = new OpenAPIHono<AppEnv>()
  .openapi(putWeightRoute, async (c) => {
    return c.json(
      await metrics.putWeight(db, c.get('user').id, c.req.valid('json'), new Date()),
      200,
    )
  })
  .openapi(weightTrendRoute, async (c) => {
    const { days } = c.req.valid('query')
    return c.json(await metrics.weightTrend(db, c.get('user').id, days, new Date()), 200)
  })
  .openapi(putRatingRoute, async (c) => {
    return c.json(
      await metrics.putRating(db, c.get('user').id, c.req.valid('json'), new Date()),
      200,
    )
  })
