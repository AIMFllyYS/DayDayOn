import 'server-only'
import { OpenAPIHono } from '@hono/zod-openapi'
import type { AppEnv } from '../app'

/*
 * 领域路由（空壳，F1）。实现：D2。路径写完整路径，app.ts 统一挂在根上（PRD 7.5）。
 * 每个接口用 createRoute 定义，写全 request / responses（errorResponses(...)），
 * 领域路由默认 middleware: [requireUser, requireOnboarded] as const（另有说明的除外）。
 *
 *   GET    /goals              ?status=active|archived → GoalListSchema（不分页，上限 100）
 *   POST   /goals              CreateGoalSchema → 201 GoalSchema；409 GOAL_LIMIT_REACHED
 *   GET    /goals/{goalId}     GoalDetailSchema；404 GOAL_NOT_FOUND
 *   PATCH  /goals/{goalId}     UpdateGoalSchema → GoalSchema（含归档 / 恢复 / 改字段）
 *   DELETE /goals/{goalId}     204（连同打卡记录）
 */
export const goalRoutes = new OpenAPIHono<AppEnv>()
