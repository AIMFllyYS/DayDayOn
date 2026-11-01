import 'server-only'
import { OpenAPIHono } from '@hono/zod-openapi'
import type { AppEnv } from '../app'

/*
 * 领域路由（空壳，F1）。实现：D6。路径写完整路径，app.ts 统一挂在根上（PRD 7.5）。
 * 每个接口用 createRoute 定义，写全 request / responses（errorResponses(...)），
 * 领域路由默认 middleware: [requireUser, requireOnboarded] as const（另有说明的除外）。
 *
 *   POST   /redeem-codes/redeem   idempotency-key；RedeemSchema → RedeemResultSchema；400 REDEEM_CODE_INVALID / 409 REDEEM_CODE_USED / 429 REDEEM_LOCKED
 */
export const redeemRoutes = new OpenAPIHono<AppEnv>()
