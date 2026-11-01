import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { describe, expect, it } from 'vitest'
import type { AppEnv } from '../app'
import { errorResponses } from '../schemas'
import { requireOnboarded, requireUser } from './auth'
import { idempotency } from './idempotency'
import { rateLimit } from './rate-limit'

// 契约测试：中间件桩能挂进 createRoute 的 middleware（类型正确），并在实现落地前返回 501
const route = createRoute({
  method: 'post',
  path: '/probe',
  middleware: [
    requireUser,
    requireOnboarded,
    rateLimit({ rule: { name: 'probe', windowSeconds: 60, max: 1 } }),
    idempotency(),
  ] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } },
      description: 'ok',
    },
    ...errorResponses('UNAUTHENTICATED', 'NOT_IMPLEMENTED'),
  },
})

const probe = new OpenAPIHono<AppEnv>().openapi(route, (c) => c.json({ ok: true }, 200))

describe('中间件桩', () => {
  it('实现落地前返回 501 NOT_IMPLEMENTED', async () => {
    const res = await probe.request('/probe', { method: 'POST' })
    expect(res.status).toBe(501)
    expect(await res.json()).toMatchObject({ code: 'NOT_IMPLEMENTED' })
  })
})
