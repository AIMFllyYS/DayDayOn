import 'server-only'
import { OpenAPIHono } from '@hono/zod-openapi'
import { csrf } from 'hono/csrf'
import { HTTPException } from 'hono/http-exception'
import * as z from 'zod'
import type { SessionUser } from '@/server/auth'
import { env } from '@/server/env'
import { ApiError, type ErrorBody, type ErrorCode } from './errors'
import { adminRoutes } from './routes/admin'
import { agentRoutes } from './routes/agent'
import { aiRoutes } from './routes/ai'
import { checkinRoutes } from './routes/checkins'
import { dashboardRoutes } from './routes/dashboard'
import { goalRoutes } from './routes/goals'
import { meRoutes } from './routes/me'
import { metricRoutes } from './routes/metrics'
import { quotaRoutes } from './routes/quota'
import { rankRoutes } from './routes/rank'
import { redeemRoutes } from './routes/redeem'
import { todoRoutes } from './routes/todos'

/*
 * /api/v1 根应用（api-conventions.md 第 2、6 节，F1）。
 * 领域路由在 routes/<领域>.ts 里写完整路径，这里统一挂在根上（PRD 7.5）；领域 Agent 不改本文件。
 */

/** 上下文变量：requireUser 写入 user 与 ip（ip 只取 x-real-ip） */
export type AppEnv = {
  Variables: {
    user: SessionUser
    ip: string
  }
}

/** Hono 自身抛出的 HTTPException 状态码 → 错误码 */
const HTTP_STATUS_CODE: Partial<Record<number, ErrorCode>> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'RATE_LIMITED',
}

const base = new OpenAPIHono<AppEnv>({
  // 校验失败统一 400 VALIDATION_FAILED + fields；单个路由不写自己的 hook
  defaultHook: (result, c) => {
    if (result.success) return
    const body: ErrorBody = {
      code: 'VALIDATION_FAILED',
      detail: `${result.target} 校验失败`,
      fields: z.flattenError(result.error).fieldErrors as Record<string, string[]>,
    }
    return c.json(body, 400)
  },
}).basePath('/api/v1')

// 写请求的 CSRF：只允许本站来源（api-conventions.md 第 7 节）。origin 懒读取，构建期不触发 env 校验
base.use('*', csrf({ origin: (origin) => origin === new URL(env.NEXT_PUBLIC_APP_URL).origin }))

base.onError((err, c) => {
  if (err instanceof ApiError) {
    if (err.extras.retryAfterSeconds !== undefined) {
      c.header('Retry-After', String(err.extras.retryAfterSeconds))
    }
    return c.json(err.toBody(), err.status)
  }
  if (err instanceof HTTPException) {
    const code = HTTP_STATUS_CODE[err.status] ?? 'INTERNAL'
    const body: ErrorBody = { code, detail: err.message || code }
    return c.json(body, err.status)
  }
  // 只记方法、路径和错误本身；不记请求体（可能含图片或个人数据）
  console.error('[api] 未处理的错误', c.req.method, c.req.path, err)
  const body: ErrorBody = { code: 'INTERNAL', detail: '服务器内部错误' }
  return c.json(body, 500)
})

base.notFound((c) => {
  const body: ErrorBody = { code: 'NOT_FOUND', detail: `${c.req.method} ${c.req.path} 不存在` }
  return c.json(body, 404)
})

export const app = base
  .route('/', meRoutes)
  .route('/', quotaRoutes)
  .route('/', goalRoutes)
  .route('/', checkinRoutes)
  .route('/', metricRoutes)
  .route('/', dashboardRoutes)
  .route('/', rankRoutes)
  .route('/', todoRoutes)
  .route('/', aiRoutes)
  .route('/', agentRoutes)
  .route('/', redeemRoutes)
  .route('/', adminRoutes)

/** hono/client 的类型来源：src/lib/api/client.ts 只 `import type` 它 */
export type AppType = typeof app
