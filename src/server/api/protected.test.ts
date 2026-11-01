import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { describe, expect, it, vi } from 'vitest'
import type { AppEnv } from './app'
import { AUTH_ERRORS, errorResponses } from './schemas'

/*
 * 受保护接口经根应用 app.request() 的端到端行为（testing.md 第 1 节：M3 起至少一个）。
 * 会话层 mock 成"没有会话"；不连数据库、不初始化 Better Auth。
 * 领域路由此时还是空壳，所以在测试里挂一个与领域路由写法相同的探针子应用到 routes/me.ts 上。
 */

vi.mock('@/server/auth/session', () => ({ getSessionFromHeaders: async () => null }))
vi.mock('@/server/auth/account-state', () => ({ loadAccountState: async () => null }))
vi.mock('./routes/me', async () => {
  const { requireUser, requireOnboarded } = await import('./middleware/auth')
  const route = createRoute({
    method: 'get',
    path: '/me/__probe',
    middleware: [requireUser, requireOnboarded] as const,
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } },
        description: 'ok',
      },
      ...errorResponses(...AUTH_ERRORS),
    },
  })
  return { meRoutes: new OpenAPIHono<AppEnv>().openapi(route, (c) => c.json({ ok: true }, 200)) }
})

const { app } = await import('./app')

describe('受保护接口', () => {
  it('没登录：401 UNAUTHENTICATED 错误体', async () => {
    const res = await app.request('/api/v1/me/__probe')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ code: 'UNAUTHENTICATED', detail: '未登录或会话已过期' })
  })

  it('伪造的会话 cookie 同样 401', async () => {
    const res = await app.request('/api/v1/me/__probe', {
      headers: { cookie: 'better-auth.session_token=forged' },
    })
    expect(res.status).toBe(401)
  })
})
