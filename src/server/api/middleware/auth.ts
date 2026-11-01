import 'server-only'
import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { type AccountState, loadAccountState } from '@/server/auth/account-state'
import { checkAccount, checkAdmin, checkOnboarded } from '@/server/auth/guards'
import { clientIp } from '@/server/auth/ip'
import type { SessionUser } from '@/server/auth/session'
import type { AppEnv } from '../app'
import { ApiError } from '../errors'

/*
 * 鉴权中间件（api-conventions.md 第 7 节、auth.md 第 5、6 节、PRD 7.1）。签名 F1，实现 P1。
 * 领域路由挂 `middleware: [requireUser, requireOnboarded] as const`；/admin/* 只挂 requireAdmin。
 *
 * 失败时直接返回错误体（不抛错），子应用单独 app.request() 测试时也能得到正确的状态码。
 * session.ts 按需动态加载：只 import 路由文件（导出 OpenAPI、单测）时不会初始化 Better Auth。
 */

/** 同一请求里 requireUser 查过的实时状态，requireOnboarded 复用，不再查库 */
const accountStates = new WeakMap<Request, AccountState>()

function fail(c: Context<AppEnv>, error: ApiError): Response {
  return c.json(error.toBody(), error.status)
}

/** 取会话 + 实时状态并判定（封禁状态查库，不信任会话缓存） */
async function resolveUser(
  c: Context<AppEnv>,
): Promise<{ user: SessionUser; state: AccountState } | ApiError> {
  const { getSessionFromHeaders } = await import('@/server/auth/session')
  const session = await getSessionFromHeaders(c.req.raw.headers)
  if (!session) return new ApiError('UNAUTHENTICATED', '未登录或会话已过期')
  const state = await loadAccountState(session.user.id)
  const error = checkAccount(state, new Date())
  if (error) return error
  if (!state) return new ApiError('UNAUTHENTICATED', '用户不存在')
  return { user: session.user, state }
}

/**
 * 取会话写入 c.set('user') 与 c.set('ip')（ip 只取 x-real-ip，本地记 127.0.0.1）。
 * 无会话 401 UNAUTHENTICATED；被封 403 ACCOUNT_BANNED（带 ban）。
 */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  c.set('ip', clientIp(c.req.raw.headers))
  const r = await resolveUser(c)
  if (r instanceof ApiError) return fail(c, r)
  c.set('user', r.user)
  accountStates.set(c.req.raw, r.state)
  await next()
})

/**
 * 必须在 requireUser 之后。profiles.onboardedAt 为空返回 403 ONBOARDING_REQUIRED。
 * 免检接口：GET /me、POST /me/onboarding、DELETE /me、GET /me/export。
 */
export const requireOnboarded = createMiddleware<AppEnv>(async (c, next) => {
  const state = accountStates.get(c.req.raw)
  if (!state) {
    return fail(c, new ApiError('UNAUTHENTICATED', 'requireOnboarded 必须挂在 requireUser 之后'))
  }
  const error = checkOnboarded(state)
  if (error) return fail(c, error)
  await next()
})

/**
 * requireUser + role === 'admin'（否则 403 FORBIDDEN）+ 已开启两步验证（否则 403 TWO_FACTOR_REQUIRED）。
 */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  c.set('ip', clientIp(c.req.raw.headers))
  const r = await resolveUser(c)
  if (r instanceof ApiError) return fail(c, r)
  const error = checkAdmin(r.user)
  if (error) return fail(c, error)
  c.set('user', r.user)
  accountStates.set(c.req.raw, r.state)
  await next()
})
