import 'server-only'
import { OpenAPIHono } from '@hono/zod-openapi'
import type { AppEnv } from '../app'

/*
 * 领域路由（空壳，F1）。实现：D3。路径写完整路径，app.ts 统一挂在根上（PRD 7.5）。
 * 每个接口用 createRoute 定义，写全 request / responses（errorResponses(...)），
 * 领域路由默认 middleware: [requireUser, requireOnboarded] as const（另有说明的除外）。
 *
 *   GET    /goals/{goalId}/checkins   CheckinHistoryQuerySchema → CheckinHistorySchema（游标分页）
 *   POST   /goals/{goalId}/checkins   idempotency-key；CreateCheckinSchema → 201 CreateCheckinResultSchema；409 CHECKIN_EXISTS；400 MAKEUP_NOT_ALLOWED
 *   GET    /goals/{goalId}/calendar   ?month=YYYY-MM → CheckinCalendarSchema
 *   GET    /checkins/today            CheckinTodaySchema
 *   PATCH  /checkins/{checkinId}      UpdateCheckinSchema → CheckinSchema（只允许饮食条目与备注）
 *   DELETE /checkins/{checkinId}      204；404 CHECKIN_NOT_FOUND
 */
export const checkinRoutes = new OpenAPIHono<AppEnv>()
