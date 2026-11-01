import 'server-only'
import { createMiddleware } from 'hono/factory'
import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../app'
import { notImplemented } from './not-implemented'

/*
 * 幂等中间件（api-conventions.md 第 9 节、PRD 7.3）。签名 F1，实现 P1。
 * 读 'idempotency-key' 请求头（路由的 request.headers 用 IdempotencyHeadersSchema 声明）。
 * 新请求放行并在响应后 completeIdempotent；重放原样返回；处理中 409 REQUEST_IN_PROGRESS；
 * 摘要不同 409 IDEMPOTENCY_KEY_REUSED；handler 抛错时 abortIdempotent。
 */

export interface IdempotencyOptions {
  /** false：只存状态和摘要，不存响应体（批量生成兑换码），同键重放返回 409 IDEMPOTENCY_KEY_REUSED */
  storeBody?: boolean
}

/** 必须挂在 requireUser 之后。实现：P1 */
export function idempotency(options: IdempotencyOptions = {}): MiddlewareHandler<AppEnv> {
  void options
  return createMiddleware<AppEnv>(async (c) => notImplemented(c, 'P1'))
}
