import 'server-only'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import {
  AdminCodeIdParamSchema,
  AdminCodePageSchema,
  AdminCodeQuerySchema,
  AdminCodeRowSchema,
  AdminOverviewSchema,
  AdminUserIdParamSchema,
  AdminUserPageSchema,
  AdminUserQuerySchema,
  AiSwitchResultSchema,
  GenerateCodesSchema,
  GeneratedCodesSchema,
  QuotaAdjustmentResultSchema,
  QuotaAdjustmentSchema,
} from '@/features/admin/schemas'
import { db } from '@/server/db/client'
import * as admin from '@/server/services/admin'
import { AppSettingsPatchSchema, AppSettingsSchema } from '@/server/settings-schema'
import type { AppEnv } from '../app'
import { requireAdmin } from '../middleware/auth'
import { idempotency } from '../middleware/idempotency'
import { ADMIN_ERRORS, errorResponses, IdempotencyHeadersSchema } from '../schemas'

/*
 * 后台接口（PRD 2.12、5、7.3，D7）。全部只挂 requireAdmin（不要求完成引导）。
 * 封号 / 解封走 Better Auth（authClient.admin.banUser / unbanUser），不在这里。
 * handler 只做：取入参 → 取当前管理员 → 调 service → 返回。
 */

const json = <T>(schema: T, description: string) => ({
  content: { 'application/json': { schema } },
  description,
})
const body = <T>(schema: T) => ({
  body: { content: { 'application/json': { schema } }, required: true },
})

const getOverview = createRoute({
  method: 'get',
  path: '/admin/overview',
  tags: ['admin'],
  summary: '今日花费、AI 开关、30 天曲线、异常',
  middleware: [requireAdmin] as const,
  responses: {
    200: json(AdminOverviewSchema, '后台首页数据'),
    ...errorResponses(...ADMIN_ERRORS),
  },
})

const pauseAi = createRoute({
  method: 'post',
  path: '/admin/ai/pause',
  tags: ['admin'],
  summary: '暂停全站 AI',
  middleware: [requireAdmin] as const,
  responses: {
    200: json(AiSwitchResultSchema, '暂停后的状态'),
    ...errorResponses(...ADMIN_ERRORS),
  },
})

const resumeAi = createRoute({
  method: 'post',
  path: '/admin/ai/resume',
  tags: ['admin'],
  summary: '恢复全站 AI（只清手动暂停；capReached 为 true 时仍处于日上限暂停）',
  middleware: [requireAdmin] as const,
  responses: {
    200: json(AiSwitchResultSchema, '恢复后的状态'),
    ...errorResponses(...ADMIN_ERRORS),
  },
})

const listUsers = createRoute({
  method: 'get',
  path: '/admin/users',
  tags: ['admin'],
  summary: '用户表（偏移分页，按邮箱搜索）',
  middleware: [requireAdmin] as const,
  request: { query: AdminUserQuerySchema },
  responses: {
    200: json(AdminUserPageSchema, '一页用户'),
    ...errorResponses(...ADMIN_ERRORS, 'VALIDATION_FAILED'),
  },
})

const adjustQuota = createRoute({
  method: 'post',
  path: '/admin/users/{userId}/quota-adjustments',
  tags: ['admin'],
  summary: '调整加购余额（± 金额 + 原因，写流水）',
  middleware: [requireAdmin] as const,
  request: { params: AdminUserIdParamSchema, ...body(QuotaAdjustmentSchema) },
  responses: {
    200: json(QuotaAdjustmentResultSchema, '调整后的加购余额'),
    ...errorResponses(...ADMIN_ERRORS, 'VALIDATION_FAILED', 'USER_NOT_FOUND'),
  },
})

const listCodes = createRoute({
  method: 'get',
  path: '/admin/redeem-codes',
  tags: ['admin'],
  summary: '兑换码列表（偏移分页）',
  middleware: [requireAdmin] as const,
  request: { query: AdminCodeQuerySchema },
  responses: {
    200: json(AdminCodePageSchema, '一页兑换码'),
    ...errorResponses(...ADMIN_ERRORS, 'VALIDATION_FAILED'),
  },
})

const generateCodes = createRoute({
  method: 'post',
  path: '/admin/redeem-codes',
  tags: ['admin'],
  summary: '批量生成兑换码（明文只在本响应里出现一次）',
  // 幂等记录不存响应体：明文码不落库；同键重放返回 409 IDEMPOTENCY_KEY_REUSED（PRD 7.3）
  middleware: [requireAdmin, idempotency({ storeBody: false })] as const,
  request: { headers: IdempotencyHeadersSchema, ...body(GenerateCodesSchema) },
  responses: {
    201: json(GeneratedCodesSchema, '已生成'),
    ...errorResponses(
      ...ADMIN_ERRORS,
      'VALIDATION_FAILED',
      'IDEMPOTENCY_KEY_REUSED',
      'REQUEST_IN_PROGRESS',
    ),
  },
})

const voidCode = createRoute({
  method: 'post',
  path: '/admin/redeem-codes/{codeId}/void',
  tags: ['admin'],
  summary: '作废未使用的兑换码',
  middleware: [requireAdmin] as const,
  request: { params: AdminCodeIdParamSchema },
  responses: {
    200: json(AdminCodeRowSchema, '作废后的兑换码'),
    ...errorResponses(
      ...ADMIN_ERRORS,
      'VALIDATION_FAILED',
      'REDEEM_CODE_NOT_FOUND',
      'REDEEM_CODE_USED',
    ),
  },
})

const getSettings = createRoute({
  method: 'get',
  path: '/admin/settings',
  tags: ['admin'],
  summary: '全站配置',
  middleware: [requireAdmin] as const,
  responses: {
    200: json(AppSettingsSchema, '当前配置'),
    ...errorResponses(...ADMIN_ERRORS),
  },
})

const putSettings = createRoute({
  method: 'put',
  path: '/admin/settings',
  tags: ['admin'],
  summary: '修改全站配置（只传要改的项）',
  middleware: [requireAdmin] as const,
  request: body(AppSettingsPatchSchema),
  responses: {
    200: json(AppSettingsSchema, '修改后的配置'),
    ...errorResponses(...ADMIN_ERRORS, 'VALIDATION_FAILED'),
  },
})

export const adminRoutes = new OpenAPIHono<AppEnv>()
  .openapi(getOverview, async (c) => c.json(await admin.getOverview(db, new Date()), 200))
  .openapi(pauseAi, async (c) => {
    const adminId = c.get('user').id
    const result = await db.transaction((tx) => admin.setAiPaused(tx, adminId, true, new Date()))
    return c.json(result, 200)
  })
  .openapi(resumeAi, async (c) => {
    const adminId = c.get('user').id
    const result = await db.transaction((tx) => admin.setAiPaused(tx, adminId, false, new Date()))
    return c.json(result, 200)
  })
  .openapi(listUsers, async (c) =>
    c.json(await admin.listUsers(db, c.req.valid('query'), new Date()), 200),
  )
  .openapi(adjustQuota, async (c) => {
    const adminId = c.get('user').id
    const { userId } = c.req.valid('param')
    const input = c.req.valid('json')
    const result = await db.transaction((tx) =>
      admin.adjustUserQuota(tx, adminId, userId, input, new Date()),
    )
    return c.json(result, 200)
  })
  .openapi(listCodes, async (c) => c.json(await admin.listCodes(db, c.req.valid('query')), 200))
  .openapi(generateCodes, async (c) => {
    const adminId = c.get('user').id
    const input = c.req.valid('json')
    const result = await db.transaction((tx) => admin.generateCodes(tx, adminId, input, new Date()))
    return c.json(result, 201)
  })
  .openapi(voidCode, async (c) => {
    const adminId = c.get('user').id
    const { codeId } = c.req.valid('param')
    const result = await db.transaction((tx) => admin.voidCode(tx, adminId, codeId, new Date()))
    return c.json(result, 200)
  })
  .openapi(getSettings, async (c) => c.json(await admin.readSettings(), 200))
  .openapi(putSettings, async (c) => {
    const adminId = c.get('user').id
    const patch = c.req.valid('json')
    const result = await db.transaction((tx) => admin.writeSettings(tx, adminId, patch, new Date()))
    return c.json(result, 200)
  })
