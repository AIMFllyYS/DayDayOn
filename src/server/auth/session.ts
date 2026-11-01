import 'server-only'
import type { auth } from './auth'

/*
 * 会话读取（auth.md 第 5、6 节）。签名由 F1 定，实现由 P1。
 * 业务代码只用这里的函数，不直接 import better-auth。
 */

type InferredSession = typeof auth.$Infer.Session

/** 当前登录用户（Better Auth user 行，含 admin / twoFactor 插件字段） */
export type SessionUser = InferredSession['user']
export type SessionData = InferredSession['session']
export interface Session {
  user: SessionUser
  session: SessionData
}

/**
 * Server Component 里读取会话（内部 `auth.api.getSession({ headers: await headers() })`）。
 * 必须在 <Suspense> 内调用。没登录返回 null。实现：P1
 */
export async function getSession(): Promise<Session | null> {
  throw new Error('not implemented: P1')
}

/**
 * 按请求头取会话（Hono 中间件用 `c.req.raw.headers`）。实现：P1
 */
export async function getSessionFromHeaders(headers: Headers): Promise<Session | null> {
  void headers
  throw new Error('not implemented: P1')
}

/**
 * 页面保护：未登录 redirect('/login')；被封 redirect('/login?banned=1')。返回用户。实现：P1
 */
export async function requireUser(): Promise<SessionUser> {
  throw new Error('not implemented: P1')
}

/**
 * 页面保护：requireUser + 未完成引导 redirect('/onboarding')。实现：P1（PRD 7.1）
 */
export async function requireOnboardedUser(): Promise<SessionUser> {
  throw new Error('not implemented: P1')
}

/**
 * 后台页面保护：requireUser + role === 'admin'。
 * 返回 twoFactorEnabled 供页面决定显示绑定流程（PRD 7.1）。实现：P1
 */
export async function requireAdmin(): Promise<SessionUser & { twoFactorEnabled: boolean }> {
  throw new Error('not implemented: P1')
}

/** 用户当前是否处于封禁中（banned 且未过期）。纯函数，实现：P1（带单测） */
export function isBanned(user: Pick<SessionUser, 'banned' | 'banExpires'>, now: Date): boolean {
  void user
  void now
  throw new Error('not implemented: P1')
}
