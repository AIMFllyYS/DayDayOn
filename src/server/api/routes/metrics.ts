import 'server-only'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import {
  DeleteMetricQuerySchema,
  DeleteRatingQuerySchema,
  MetricCalendarQuerySchema,
  MetricCalendarSchema,
  MetricDateParamSchema,
  MetricHistoryQuerySchema,
  MetricHistorySchema,
  MetricKindParamSchema,
  PutRatingSchema,
  PutStepsSchema,
  PutWeightSchema,
  RatingSchema,
  RatingTrendQuerySchema,
  RatingTrendSchema,
  StepEntrySchema,
  StepTrendQuerySchema,
  StepTrendSchema,
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
 * 每日指标接口（PRD 2.5、7.2、7.5，Issue #104）。
 * PUT 支持今天/昨天覆盖写，天然幂等；DELETE 支持手动删任意历史日或 Agent 删今天/昨天。
 */

const json = <T>(schema: T) => ({ 'application/json': { schema } })

const putWeightRoute = createRoute({
  method: 'put',
  path: '/metrics/weight',
  middleware: [requireUser, requireOnboarded] as const,
  request: { body: { content: json(PutWeightSchema), required: true } },
  responses: {
    200: { content: json(WeightEntrySchema), description: '已记录今天或昨天的体重' },
    ...errorResponses(
      ...AUTH_ERRORS,
      'VALIDATION_FAILED',
      'MAKEUP_NOT_ALLOWED',
      'WEIGHT_CHANGE_UNCONFIRMED',
    ),
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

const deleteWeightRoute = createRoute({
  method: 'delete',
  path: '/metrics/weight/{localDate}',
  middleware: [requireUser, requireOnboarded] as const,
  request: { params: MetricDateParamSchema, query: DeleteMetricQuerySchema },
  responses: {
    204: { description: '已删除该日体重记录' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED', 'MAKEUP_NOT_ALLOWED', 'NOT_FOUND'),
  },
})

const putRatingRoute = createRoute({
  method: 'put',
  path: '/ratings',
  middleware: [requireUser, requireOnboarded] as const,
  request: { body: { content: json(PutRatingSchema), required: true } },
  responses: {
    200: { content: json(RatingSchema), description: '已记录今天或昨天的满意度' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED', 'MAKEUP_NOT_ALLOWED'),
  },
})

const ratingTrendRoute = createRoute({
  method: 'get',
  path: '/ratings',
  middleware: [requireUser, requireOnboarded] as const,
  request: { query: RatingTrendQuerySchema },
  responses: {
    200: { content: json(RatingTrendSchema), description: '心情与满意度历史走势' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED'),
  },
})

const deleteRatingRoute = createRoute({
  method: 'delete',
  path: '/ratings/{localDate}',
  middleware: [requireUser, requireOnboarded] as const,
  request: { params: MetricDateParamSchema, query: DeleteRatingQuerySchema },
  responses: {
    204: { description: '已删除该日心情记录' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED', 'MAKEUP_NOT_ALLOWED', 'NOT_FOUND'),
  },
})

const putStepsRoute = createRoute({
  method: 'put',
  path: '/metrics/steps',
  middleware: [requireUser, requireOnboarded] as const,
  request: { body: { content: json(PutStepsSchema), required: true } },
  responses: {
    200: { content: json(StepEntrySchema), description: '已记录今天或昨天的步数' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED', 'MAKEUP_NOT_ALLOWED'),
  },
})

const stepTrendRoute = createRoute({
  method: 'get',
  path: '/metrics/steps',
  middleware: [requireUser, requireOnboarded] as const,
  request: { query: StepTrendQuerySchema },
  responses: {
    200: { content: json(StepTrendSchema), description: '步数走势与今日步数（无记录恒为 0）' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED'),
  },
})

const deleteStepsRoute = createRoute({
  method: 'delete',
  path: '/metrics/steps/{localDate}',
  middleware: [requireUser, requireOnboarded] as const,
  request: { params: MetricDateParamSchema, query: DeleteMetricQuerySchema },
  responses: {
    204: { description: '已删除该日步数记录' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED', 'MAKEUP_NOT_ALLOWED', 'NOT_FOUND'),
  },
})

const metricHistoryRoute = createRoute({
  method: 'get',
  path: '/metrics/{kind}/history',
  middleware: [requireUser, requireOnboarded] as const,
  request: { params: MetricKindParamSchema, query: MetricHistoryQuerySchema },
  responses: {
    200: { content: json(MetricHistorySchema), description: '指标历史分页记录' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED'),
  },
})

const metricCalendarRoute = createRoute({
  method: 'get',
  path: '/metrics/{kind}/calendar',
  middleware: [requireUser, requireOnboarded] as const,
  request: { params: MetricKindParamSchema, query: MetricCalendarQuerySchema },
  responses: {
    200: { content: json(MetricCalendarSchema), description: '指标月度日历' },
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
  .openapi(deleteWeightRoute, async (c) => {
    const { localDate } = c.req.valid('param')
    const { origin } = c.req.valid('query')
    await metrics.deleteWeight(db, c.get('user').id, localDate, origin, new Date())
    return c.body(null, 204)
  })
  .openapi(putRatingRoute, async (c) => {
    return c.json(
      await metrics.putRating(db, c.get('user').id, c.req.valid('json'), new Date()),
      200,
    )
  })
  .openapi(ratingTrendRoute, async (c) => {
    const { scope, days } = c.req.valid('query')
    return c.json(await metrics.ratingTrend(db, c.get('user').id, scope, days, new Date()), 200)
  })
  .openapi(deleteRatingRoute, async (c) => {
    const { localDate } = c.req.valid('param')
    const { scope, origin } = c.req.valid('query')
    await metrics.deleteRating(db, c.get('user').id, localDate, scope, origin, new Date())
    return c.body(null, 204)
  })
  .openapi(putStepsRoute, async (c) => {
    return c.json(
      await metrics.putSteps(db, c.get('user').id, c.req.valid('json'), new Date()),
      200,
    )
  })
  .openapi(stepTrendRoute, async (c) => {
    const { days } = c.req.valid('query')
    return c.json(await metrics.stepTrend(db, c.get('user').id, days, new Date()), 200)
  })
  .openapi(deleteStepsRoute, async (c) => {
    const { localDate } = c.req.valid('param')
    const { origin } = c.req.valid('query')
    await metrics.deleteSteps(db, c.get('user').id, localDate, origin, new Date())
    return c.body(null, 204)
  })
  .openapi(metricHistoryRoute, async (c) => {
    const { kind } = c.req.valid('param')
    return c.json(
      await metrics.listMetricHistory(db, c.get('user').id, kind, c.req.valid('query')),
      200,
    )
  })
  .openapi(metricCalendarRoute, async (c) => {
    const { kind } = c.req.valid('param')
    const { month } = c.req.valid('query')
    return c.json(await metrics.metricCalendar(db, c.get('user').id, kind, month), 200)
  })
