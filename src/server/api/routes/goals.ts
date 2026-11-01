import 'server-only'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import {
  CreateGoalSchema,
  GoalDetailSchema,
  GoalIdParamSchema,
  GoalListQuerySchema,
  GoalListSchema,
  GoalSchema,
  UpdateGoalSchema,
} from '@/features/goal/schemas'
import { db } from '@/server/db/client'
import * as goals from '@/server/services/goals'
import type { AppEnv } from '../app'
import { requireOnboarded, requireUser } from '../middleware/auth'
import { idempotency } from '../middleware/idempotency'
import { AUTH_ERRORS, errorResponses, IdempotencyHeadersSchema } from '../schemas'

/*
 * 目标接口（PRD 2.3、7.2、7.5）。实现：D2。路径写完整路径，app.ts 统一挂在根上。
 * handler 只做：取校验后的入参 → 取当前用户 → 调 service → 返回。
 *
 *   GET    /goals              ?status=active|archived → GoalListSchema（不分页，上限 100）
 *   POST   /goals              CreateGoalSchema → 201 GoalSchema；409 GOAL_LIMIT_REACHED
 *   GET    /goals/{goalId}     GoalDetailSchema；404 GOAL_NOT_FOUND
 *   PATCH  /goals/{goalId}     UpdateGoalSchema → GoalSchema（含归档 / 恢复 / 改字段）
 *   DELETE /goals/{goalId}     204（连同打卡记录）
 */

const json = <T>(schema: T) => ({ 'application/json': { schema } })

const listGoals = createRoute({
  method: 'get',
  path: '/goals',
  tags: ['goals'],
  summary: '目标列表',
  middleware: [requireUser, requireOnboarded] as const,
  request: { query: GoalListQuerySchema },
  responses: {
    200: { content: json(GoalListSchema), description: '目标列表（按排序）' },
    ...errorResponses('VALIDATION_FAILED', ...AUTH_ERRORS),
  },
})

const createGoal = createRoute({
  method: 'post',
  path: '/goals',
  tags: ['goals'],
  summary: '新建目标',
  middleware: [requireUser, requireOnboarded, idempotency()] as const,
  request: {
    headers: IdempotencyHeadersSchema,
    body: { content: json(CreateGoalSchema), required: true },
  },
  responses: {
    201: { content: json(GoalSchema), description: '已创建' },
    ...errorResponses(
      'VALIDATION_FAILED',
      'GOAL_LIMIT_REACHED',
      'IDEMPOTENCY_KEY_REUSED',
      'REQUEST_IN_PROGRESS',
      ...AUTH_ERRORS,
    ),
  },
})

const getGoal = createRoute({
  method: 'get',
  path: '/goals/{goalId}',
  tags: ['goals'],
  summary: '目标详情',
  middleware: [requireUser, requireOnboarded] as const,
  request: { params: GoalIdParamSchema },
  responses: {
    200: { content: json(GoalDetailSchema), description: '目标 + 字段版本 + 目标量历史' },
    ...errorResponses('VALIDATION_FAILED', 'GOAL_NOT_FOUND', ...AUTH_ERRORS),
  },
})

const updateGoal = createRoute({
  method: 'patch',
  path: '/goals/{goalId}',
  tags: ['goals'],
  summary: '修改目标（含归档、恢复、自定义字段）',
  middleware: [requireUser, requireOnboarded] as const,
  request: {
    params: GoalIdParamSchema,
    body: { content: json(UpdateGoalSchema), required: true },
  },
  responses: {
    200: { content: json(GoalSchema), description: '修改后的目标' },
    ...errorResponses('VALIDATION_FAILED', 'GOAL_NOT_FOUND', 'GOAL_LIMIT_REACHED', ...AUTH_ERRORS),
  },
})

const deleteGoal = createRoute({
  method: 'delete',
  path: '/goals/{goalId}',
  tags: ['goals'],
  summary: '删除目标（连同打卡记录）',
  middleware: [requireUser, requireOnboarded] as const,
  request: { params: GoalIdParamSchema },
  responses: {
    204: { description: '已删除' },
    ...errorResponses('VALIDATION_FAILED', 'GOAL_NOT_FOUND', ...AUTH_ERRORS),
  },
})

export const goalRoutes = new OpenAPIHono<AppEnv>()
  .openapi(listGoals, async (c) => {
    const result = await goals.listGoals(db, c.get('user').id, c.req.valid('query'))
    return c.json(result, 200)
  })
  .openapi(createGoal, async (c) => {
    const userId = c.get('user').id
    const input = c.req.valid('json')
    const goal = await db.transaction((tx) =>
      goals.createGoalForUser(tx, userId, input, { now: new Date() }),
    )
    return c.json(goal, 201)
  })
  .openapi(getGoal, async (c) => {
    const goal = await goals.getGoal(db, c.get('user').id, c.req.valid('param').goalId)
    return c.json(goal, 200)
  })
  .openapi(updateGoal, async (c) => {
    const userId = c.get('user').id
    const { goalId } = c.req.valid('param')
    const input = c.req.valid('json')
    const goal = await db.transaction((tx) =>
      goals.updateGoal(tx, userId, goalId, input, { now: new Date() }),
    )
    return c.json(goal, 200)
  })
  .openapi(deleteGoal, async (c) => {
    const userId = c.get('user').id
    const { goalId } = c.req.valid('param')
    await db.transaction((tx) => goals.deleteGoal(tx, userId, goalId))
    return c.body(null, 204)
  })
