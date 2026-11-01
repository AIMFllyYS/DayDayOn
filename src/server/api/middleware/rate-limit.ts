import 'server-only'
import { createMiddleware } from 'hono/factory'
import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../app'
import type { RateLimitRule } from '@/server/rate-limit'
import { notImplemented } from './not-implemented'

/*
 * /api/v1 限流中间件（api-conventions.md 第 8 节）。签名 F1，实现 P1。
 * 超限返回 429 RATE_LIMITED + Retry-After。
 */

export interface RateLimitOptions {
  rule: RateLimitRule
  /** 计数主体：默认已登录用 userId，否则用 ip */
  by?: 'user' | 'ip'
}

/** 用法：`middleware: [requireUser, rateLimit({ rule: { name: 'ai-hourly', windowSeconds: 3600, max: 60 } })]`。实现：P1 */
export function rateLimit(options: RateLimitOptions): MiddlewareHandler<AppEnv> {
  void options
  return createMiddleware<AppEnv>(async (c) => notImplemented(c, 'P1'))
}
