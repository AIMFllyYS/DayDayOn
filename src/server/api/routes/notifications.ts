import 'server-only'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import * as z from 'zod'
import {
  MarkNotificationReadInputSchema,
  MarkNotificationReadResponseSchema,
  NotificationListQuerySchema,
  NotificationListResponseSchema,
  NotificationSummarySchema,
} from '@/features/notification/schemas'
import { db } from '@/server/db/client'
import * as notificationsService from '@/server/services/notifications'
import type { AppEnv } from '../app'
import { requireOnboarded, requireUser } from '../middleware/auth'
import { AUTH_ERRORS, errorResponses } from '../schemas'

/*
 * 统一通知中心接口（Issue #20 · ADR-0026 · Decision #4）：
 *   GET  /notifications/summary   获取未读通知数与红点状态（供顶栏铃铛）
 *   GET  /notifications           分页获取通知与房间动态列表
 *   POST /notifications/read      批量标记通知已读（支持全部、指定频道或列表）
 */

const json = <T extends z.ZodType>(schema: T) => ({ 'application/json': { schema } })

const getSummaryRoute = createRoute({
  method: 'get',
  path: '/notifications/summary',
  tags: ['notification'],
  summary: '获取未读通知数与是否有未读',
  middleware: [requireUser, requireOnboarded] as const,
  responses: {
    200: { content: json(NotificationSummarySchema), description: '未读通知统计' },
    ...errorResponses(...AUTH_ERRORS),
  },
})

const listNotificationsRoute = createRoute({
  method: 'get',
  path: '/notifications',
  tags: ['notification'],
  summary: '获取通知与动态列表',
  middleware: [requireUser, requireOnboarded] as const,
  request: {
    query: NotificationListQuerySchema,
  },
  responses: {
    200: { content: json(NotificationListResponseSchema), description: '通知与动态列表' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED'),
  },
})

const markReadRoute = createRoute({
  method: 'post',
  path: '/notifications/read',
  tags: ['notification'],
  summary: '标记通知已读',
  middleware: [requireUser, requireOnboarded] as const,
  request: {
    body: { content: json(MarkNotificationReadInputSchema), required: false },
  },
  responses: {
    200: { content: json(MarkNotificationReadResponseSchema), description: '标记已读处理结果' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED'),
  },
})

export const notificationRoutes = new OpenAPIHono<AppEnv>()
  .openapi(getSummaryRoute, async (c) => {
    const data = await notificationsService.getNotificationSummary(db, c.get('user').id)
    return c.json(data, 200)
  })
  .openapi(listNotificationsRoute, async (c) => {
    const query = c.req.valid('query')
    const data = await notificationsService.listNotifications(db, c.get('user').id, query)
    return c.json(data, 200)
  })
  .openapi(markReadRoute, async (c) => {
    const body = (c.req.valid('json') as z.infer<typeof MarkNotificationReadInputSchema>) ?? {}
    const data = await notificationsService.markNotificationsRead(
      db,
      c.get('user').id,
      body,
      new Date(),
    )
    return c.json(data, 200)
  })
