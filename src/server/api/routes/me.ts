import 'server-only'
import { OpenAPIHono } from '@hono/zod-openapi'
import type { AppEnv } from '../app'

/*
 * 领域路由（空壳，F1）。实现：D1。路径写完整路径，app.ts 统一挂在根上（PRD 7.5）。
 * 每个接口用 createRoute 定义，写全 request / responses（errorResponses(...)），
 * 领域路由默认 middleware: [requireUser, requireOnboarded] as const（另有说明的除外）。
 *
 *   GET    /me                 MeSchema；只要 requireUser（免引导检查）
 *   POST   /me/onboarding      OnboardingSchema → MeSchema；只要 requireUser；已完成 409 ALREADY_ONBOARDED
 *   PATCH  /me/profile         UpdateProfileSchema → MeSchema
 *   PATCH  /me/preferences     UpdatePreferencesSchema → MeSchema
 *   GET    /me/export          ExportSchema（JSON 附件）；只要 requireUser
 *   DELETE /me                 DeleteMeSchema → 204；只要 requireUser
 */
export const meRoutes = new OpenAPIHono<AppEnv>()
