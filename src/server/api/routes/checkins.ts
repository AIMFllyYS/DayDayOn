import 'server-only'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import {
  CalendarQuerySchema,
  CheckinCalendarSchema,
  CheckinHistoryQuerySchema,
  CheckinHistorySchema,
  CheckinIdParamSchema,
  CheckinSchema,
  CheckinTodaySchema,
  CreateCheckinResultSchema,
  CreateCheckinSchema,
  UpdateCheckinSchema,
} from '@/features/checkin/schemas'
import { GoalIdParamSchema } from '@/features/goal/schemas'
import { db } from '@/server/db/client'
import * as checkins from '@/server/services/checkins'
import type { AppEnv } from '../app'
import { requireOnboarded, requireUser } from '../middleware/auth'
import { idempotency } from '../middleware/idempotency'
import { AUTH_ERRORS, errorResponses, IdempotencyHeadersSchema } from '../schemas'

/*
 * 打卡接口（PRD 2.4、3、7.2、7.5），D3。路径写完整路径，app.ts 统一挂在根上。
 * handler 只做：取校验后的入参 → 取当前用户 → 调 service → 返回。
 */

const json = <T>(schema: T) => ({ 'application/json': { schema } })

const listRoute = createRoute({
  method: 'get',
  path: '/goals/{goalId}/checkins',
  middleware: [requireUser, requireOnboarded] as const,
  request: { params: GoalIdParamSchema, query: CheckinHistoryQuerySchema },
  responses: {
    200: { content: json(CheckinHistorySchema), description: '打卡历史（游标分页）' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED', 'GOAL_NOT_FOUND'),
  },
})

const createRouteDef = createRoute({
  method: 'post',
  path: '/goals/{goalId}/checkins',
  middleware: [requireUser, requireOnboarded, idempotency()] as const,
  request: {
    params: GoalIdParamSchema,
    headers: IdempotencyHeadersSchema,
    body: { content: json(CreateCheckinSchema), required: true },
  },
  responses: {
    201: { content: json(CreateCheckinResultSchema), description: '已打卡' },
    ...errorResponses(
      ...AUTH_ERRORS,
      'VALIDATION_FAILED',
      'MAKEUP_NOT_ALLOWED',
      'GOAL_NOT_FOUND',
      'CHECKIN_EXISTS',
      'IDEMPOTENCY_KEY_REUSED',
      'REQUEST_IN_PROGRESS',
    ),
  },
})

const calendarRoute = createRoute({
  method: 'get',
  path: '/goals/{goalId}/calendar',
  middleware: [requireUser, requireOnboarded] as const,
  request: { params: GoalIdParamSchema, query: CalendarQuerySchema },
  responses: {
    200: { content: json(CheckinCalendarSchema), description: '这个月每天的打卡情况' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED', 'GOAL_NOT_FOUND'),
  },
})

const todayRoute = createRoute({
  method: 'get',
  path: '/checkins/today',
  middleware: [requireUser, requireOnboarded] as const,
  responses: {
    200: { content: json(CheckinTodaySchema), description: '打卡弹层：今天各目标状态' },
    ...errorResponses(...AUTH_ERRORS),
  },
})

const updateRoute = createRoute({
  method: 'patch',
  path: '/checkins/{checkinId}',
  middleware: [requireUser, requireOnboarded] as const,
  request: {
    params: CheckinIdParamSchema,
    body: { content: json(UpdateCheckinSchema), required: true },
  },
  responses: {
    200: { content: json(CheckinSchema), description: '已修改（只允许饮食条目与备注）' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED', 'CHECKIN_NOT_FOUND'),
  },
})

const deleteRoute = createRoute({
  method: 'delete',
  path: '/checkins/{checkinId}',
  middleware: [requireUser, requireOnboarded] as const,
  request: { params: CheckinIdParamSchema },
  responses: {
    204: { description: '已删除' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED', 'CHECKIN_NOT_FOUND'),
  },
})

export const checkinRoutes = new OpenAPIHono<AppEnv>()
  .openapi(listRoute, async (c) => {
    const { goalId } = c.req.valid('param')
    const page = await checkins.listCheckins(db, c.get('user').id, goalId, c.req.valid('query'))
    return c.json(page, 200)
  })
  .openapi(createRouteDef, async (c) => {
    const { goalId } = c.req.valid('param')
    const result = await checkins.createCheckin(
      db,
      c.get('user').id,
      goalId,
      c.req.valid('json'),
      new Date(),
    )
    return c.json(result, 201)
  })
  .openapi(calendarRoute, async (c) => {
    const { goalId } = c.req.valid('param')
    const { month } = c.req.valid('query')
    return c.json(await checkins.goalCalendar(db, c.get('user').id, goalId, month), 200)
  })
  .openapi(todayRoute, async (c) => {
    return c.json(await checkins.checkinToday(db, c.get('user').id, new Date()), 200)
  })
  .openapi(updateRoute, async (c) => {
    const { checkinId } = c.req.valid('param')
    const checkin = await checkins.updateCheckin(
      db,
      c.get('user').id,
      checkinId,
      c.req.valid('json'),
    )
    return c.json(checkin, 200)
  })
  .openapi(deleteRoute, async (c) => {
    const { checkinId } = c.req.valid('param')
    await checkins.deleteCheckin(db, c.get('user').id, checkinId)
    return c.body(null, 204)
  })
