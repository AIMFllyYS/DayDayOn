import 'server-only'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { DashboardTodaySchema } from '@/features/dashboard/schemas'
import { db } from '@/server/db/client'
import { getDashboardToday } from '@/server/services/dashboard'
import type { AppEnv } from '../app'
import { requireOnboarded, requireUser } from '../middleware/auth'
import { AUTH_ERRORS, errorResponses } from '../schemas'

/*
 * 主页仪表盘（PRD 2.8、7.1、7.2）。D4。
 *
 *   GET    /dashboard/today    DashboardTodaySchema
 */

const getToday = createRoute({
  method: 'get',
  path: '/dashboard/today',
  tags: ['dashboard'],
  summary: '主页全部数据',
  middleware: [requireUser, requireOnboarded] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: DashboardTodaySchema } },
      description: '今日完成度、连续天数、目标进度、体重、心情、本周热力图、榜单动态、提醒',
    },
    ...errorResponses(...AUTH_ERRORS, 'USER_NOT_FOUND'),
  },
})

export const dashboardRoutes = new OpenAPIHono<AppEnv>().openapi(getToday, async (c) => {
  const data = await getDashboardToday(db, c.get('user').id, new Date())
  return c.json(data, 200)
})
