import 'server-only'
import { OpenAPIHono } from '@hono/zod-openapi'
import type { AppEnv } from '../app'

/*
 * 领域路由（空壳，F1）。实现：D7。路径写完整路径，app.ts 统一挂在根上（PRD 7.5）。
 * 每个接口用 createRoute 定义，写全 request / responses（errorResponses(...)），
 * 领域路由默认 middleware: [requireUser, requireOnboarded] as const（另有说明的除外）。
 *
 *   全部只挂 requireAdmin。封号 / 解封走 Better Auth（authClient.admin.banUser / unbanUser），不在这里
 *   GET    /admin/overview                         AdminOverviewSchema
 *   POST   /admin/ai/pause                         AiSwitchResultSchema
 *   POST   /admin/ai/resume                        AiSwitchResultSchema
 *   GET    /admin/users                            AdminUserQuerySchema → AdminUserPageSchema（偏移分页）
 *   POST   /admin/users/{userId}/quota-adjustments QuotaAdjustmentSchema → QuotaAdjustmentResultSchema；404 USER_NOT_FOUND
 *   GET    /admin/redeem-codes                     AdminCodeQuerySchema → AdminCodePageSchema
 *   POST   /admin/redeem-codes                     idempotency({ storeBody: false })；GenerateCodesSchema → 201 GeneratedCodesSchema
 *   POST   /admin/redeem-codes/{codeId}/void       AdminCodeRowSchema
 *   GET    /admin/settings                         AppSettingsSchema
 *   PUT    /admin/settings                         AppSettingsPatchSchema → AppSettingsSchema
 */
export const adminRoutes = new OpenAPIHono<AppEnv>()
