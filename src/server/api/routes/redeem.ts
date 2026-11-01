import 'server-only'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { RedeemResultSchema, RedeemSchema } from '@/features/quota/schemas'
import { redeemCode } from '@/server/services/redeem'
import type { AppEnv } from '../app'
import { requireOnboarded, requireUser } from '../middleware/auth'
import { idempotency } from '../middleware/idempotency'
import { rateLimit } from '../middleware/rate-limit'
import { AUTH_ERRORS, errorResponses, IdempotencyHeadersSchema } from '../schemas'

/*
 * 兑换码（PRD 2.7、7.3）。实现：D6。
 *   POST /redeem-codes/redeem  idempotency-key；RedeemSchema → RedeemResultSchema
 * 用户维度：近 1 小时失败过多锁定（service，429 REDEEM_LOCKED）；IP 维度：这里的限流防多账号猜码。
 */

const redeemRoute = createRoute({
  method: 'post',
  path: '/redeem-codes/redeem',
  summary: '兑换额度码，加到长期有效的加购余额',
  middleware: [
    requireUser,
    requireOnboarded,
    rateLimit({ rule: { name: 'redeem-ip-hourly', windowSeconds: 3600, max: 30 }, by: 'ip' }),
    idempotency(),
  ] as const,
  request: {
    headers: IdempotencyHeadersSchema,
    body: { content: { 'application/json': { schema: RedeemSchema } }, required: true },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: RedeemResultSchema } },
      description: '兑换成功：本次加了多少、兑换后的额度',
    },
    ...errorResponses(
      ...AUTH_ERRORS,
      'VALIDATION_FAILED',
      'REDEEM_CODE_INVALID',
      'REDEEM_CODE_USED',
      'IDEMPOTENCY_KEY_REUSED',
      'REQUEST_IN_PROGRESS',
      'REDEEM_LOCKED',
    ),
  },
})

export const redeemRoutes = new OpenAPIHono<AppEnv>().openapi(redeemRoute, async (c) => {
  const result = await redeemCode({
    userId: c.get('user').id,
    ip: c.get('ip'),
    idempotencyKey: c.req.valid('header')['idempotency-key'],
    body: c.req.valid('json'),
  })
  return c.json(result, 200)
})
