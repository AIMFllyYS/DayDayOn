import 'server-only'
import { createMiddleware } from 'hono/factory'
import type { MiddlewareHandler } from 'hono'
import { clientIp } from '@/server/auth/ip'
import { consume, type RateLimitRule } from '@/server/rate-limit'
import type { AppEnv } from '../app'
import { ApiError } from '../errors'

/*
 * /api/v1 限流中间件（api-conventions.md 第 8 节）。签名 F1，实现 P1。
 * 超限返回 429 RATE_LIMITED + Retry-After。
 */

export interface RateLimitOptions {
  rule: RateLimitRule
  /** 计数主体：默认已登录用 userId，否则用 ip */
  by?: 'user' | 'ip'
}

/** 用法：`middleware: [requireUser, rateLimit({ rule: { name: 'ai-hourly', windowSeconds: 3600, max: 60 } })]` */
export function rateLimit(options: RateLimitOptions): MiddlewareHandler<AppEnv> {
  return createMiddleware<AppEnv>(async (c, next) => {
    // c.get('user') 在 requireUser 之前是 undefined（类型上声明为必有，运行时可能没有）
    const user = c.get('user') as AppEnv['Variables']['user'] | undefined
    const ip = c.get('ip') ?? clientIp(c.req.raw.headers)
    const subject =
      options.by === 'ip' || (options.by === undefined && !user) ? `ip:${ip}` : `user:${user?.id}`
    if (options.by === 'user' && !user) {
      throw new Error(`rateLimit(${options.rule.name}) by: 'user' 必须挂在 requireUser 之后`)
    }
    const result = await consume(options.rule, subject)
    if (!result.ok) {
      const error = new ApiError('RATE_LIMITED', `触发限流：${options.rule.name}`, {
        retryAfterSeconds: result.retryAfterSeconds,
      })
      c.header('Retry-After', String(result.retryAfterSeconds))
      return c.json(error.toBody(), error.status)
    }
    await next()
  })
}
