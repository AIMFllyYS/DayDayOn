import 'server-only'
import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../app'
import { notImplemented } from './not-implemented'

/*
 * 鉴权中间件（api-conventions.md 第 7 节、auth.md 第 5、6 节、PRD 7.1）。签名 F1，实现 P1。
 * 领域路由挂 `middleware: [requireUser, requireOnboarded] as const`；/admin/* 只挂 requireAdmin。
 * F1 阶段响应 501 NOT_IMPLEMENTED。
 */

/**
 * 取会话写入 c.set('user') 与 c.set('ip')（ip 只取 x-real-ip，本地记 127.0.0.1）。
 * 无会话 401 UNAUTHENTICATED；被封 403 ACCOUNT_BANNED（带 ban）。实现：P1
 */
export const requireUser = createMiddleware<AppEnv>(async (c) => notImplemented(c, 'P1'))

/**
 * 必须在 requireUser 之后。profiles.onboardedAt 为空返回 403 ONBOARDING_REQUIRED。
 * 免检接口：GET /me、POST /me/onboarding、DELETE /me、GET /me/export。实现：P1
 */
export const requireOnboarded = createMiddleware<AppEnv>(async (c) => notImplemented(c, 'P1'))

/**
 * requireUser + role === 'admin'（否则 403 FORBIDDEN）+ 已开启两步验证（否则 403 TWO_FACTOR_REQUIRED）。
 * 实现：P1
 */
export const requireAdmin = createMiddleware<AppEnv>(async (c) => notImplemented(c, 'P1'))
