import 'server-only'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import {
  DeleteMeSchema,
  ExportSchema,
  MeSchema,
  OnboardingSchema,
  UpdatePreferencesSchema,
  UpdateProfileSchema,
} from '@/features/me/schemas'
import { db } from '@/server/db/client'
import * as me from '@/server/services/me'
import { exportFileName } from '@/server/services/me/dto'
import { completeOnboarding } from '@/server/services/onboarding'
import type { AppEnv } from '../app'
import { requireOnboarded, requireUser } from '../middleware/auth'
import { idempotency } from '../middleware/idempotency'
import { AUTH_ERRORS, errorResponses, IdempotencyHeadersSchema } from '../schemas'

/*
 * 账号路由（PRD 2.2、2.11、7.1、7.5）。D1。路径写完整路径，app.ts 统一挂在根上。
 * 免引导检查的只有 GET /me、POST /me/onboarding、DELETE /me、GET /me/export（PRD 7.1）：
 * 没完成引导的人也要能看到自己是谁、完成引导、导出或注销。
 */

const jsonBody = <T>(schema: T) => ({
  content: { 'application/json': { schema } },
  required: true,
})
const meResponse = {
  content: { 'application/json': { schema: MeSchema } },
  description: '当前用户',
}

const getMe = createRoute({
  method: 'get',
  path: '/me',
  middleware: [requireUser] as const,
  responses: { 200: meResponse, ...errorResponses(...AUTH_ERRORS) },
})

const postOnboarding = createRoute({
  method: 'post',
  path: '/me/onboarding',
  middleware: [requireUser, idempotency()] as const,
  request: { headers: IdempotencyHeadersSchema, body: jsonBody(OnboardingSchema) },
  responses: {
    200: { ...meResponse, description: '引导完成' },
    ...errorResponses(
      ...AUTH_ERRORS,
      'VALIDATION_FAILED',
      'ALREADY_ONBOARDED',
      'GOAL_LIMIT_REACHED',
      'IDEMPOTENCY_KEY_REUSED',
      'REQUEST_IN_PROGRESS',
    ),
  },
})

const patchProfile = createRoute({
  method: 'patch',
  path: '/me/profile',
  middleware: [requireUser, requireOnboarded] as const,
  request: { body: jsonBody(UpdateProfileSchema) },
  responses: {
    200: { ...meResponse, description: '已保存' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED'),
  },
})

const patchPreferences = createRoute({
  method: 'patch',
  path: '/me/preferences',
  middleware: [requireUser, requireOnboarded] as const,
  request: { body: jsonBody(UpdatePreferencesSchema) },
  responses: {
    200: { ...meResponse, description: '已保存' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED'),
  },
})

const getExport = createRoute({
  method: 'get',
  path: '/me/export',
  middleware: [requireUser] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: ExportSchema } },
      description: 'JSON 附件（Content-Disposition: attachment），只含本人数据',
    },
    ...errorResponses(...AUTH_ERRORS),
  },
})

const deleteMe = createRoute({
  method: 'delete',
  path: '/me',
  middleware: [requireUser] as const,
  request: { body: jsonBody(DeleteMeSchema) },
  responses: {
    204: { description: '已注销：业务数据级联删除，账本去关联保留，会话一并删除' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED'),
  },
})

export const meRoutes = new OpenAPIHono<AppEnv>()
  .openapi(getMe, async (c) => {
    const data = await me.getMe(db, c.get('user').id, new Date())
    return c.json(data, 200)
  })
  .openapi(postOnboarding, async (c) => {
    const input = c.req.valid('json')
    const userId = c.get('user').id
    const data = await db.transaction((tx) => completeOnboarding(tx, userId, input, new Date()))
    return c.json(data, 200)
  })
  .openapi(patchProfile, async (c) => {
    const input = c.req.valid('json')
    const userId = c.get('user').id
    const data = await db.transaction((tx) => me.updateProfile(tx, userId, input, new Date()))
    return c.json(data, 200)
  })
  .openapi(patchPreferences, async (c) => {
    const input = c.req.valid('json')
    const userId = c.get('user').id
    const data = await db.transaction((tx) => me.updatePreferences(tx, userId, input, new Date()))
    return c.json(data, 200)
  })
  .openapi(getExport, async (c) => {
    const { data, localDate } = await me.exportMyData(db, c.get('user').id, new Date())
    return c.json(data, 200, {
      'Content-Disposition': `attachment; filename="${exportFileName(localDate)}"`,
      'Cache-Control': 'no-store',
    })
  })
  .openapi(deleteMe, async (c) => {
    c.req.valid('json')
    const userId = c.get('user').id
    await db.transaction((tx) => me.deleteAccount(tx, userId))
    return c.body(null, 204)
  })
