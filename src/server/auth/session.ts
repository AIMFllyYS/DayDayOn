import 'server-only'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { loadAccountState } from './account-state'
import { auth } from './auth'
import { checkAccount, checkAdmin, checkOnboarded, isBanned as isBannedAt } from './guards'

/*
 * 会话读取（auth.md 第 5、6 节）。签名由 F1 定，实现 P1。
 * 业务代码只用这里的函数，不直接 import better-auth。
 * 判定逻辑在 guards.ts（纯函数，有单测）；这里负责取会话、查实时状态、redirect。
 */

type InferredSession = typeof auth.$Infer.Session

/** 当前登录用户（Better Auth user 行，含 admin / twoFactor 插件字段） */
export type SessionUser = InferredSession['user']
export type SessionData = InferredSession['session']
export interface Session {
  user: SessionUser
  session: SessionData
}

export interface GetSessionOptions {
  /** 只读校验不触发滑动续期写库（供 Server Component 使用，避免抢先更新 DB 却无法发 Set-Cookie） */
  disableRefresh?: boolean
  /** 收集 Better Auth 返回的 Set-Cookie（续期或失效清理），由 Hono 中间件写回浏览器 */
  onSetCookie?: (cookies: string[]) => void
}

/**
 * 按请求头取会话（Hono 中间件用 `c.req.raw.headers`）。没有会话返回 null。
 * 默认启用 returnHeaders，将滑动续期或失效清理产生的 Set-Cookie 通过回调交给响应层透传。
 */
export async function getSessionFromHeaders(
  headers: Headers,
  options?: GetSessionOptions,
): Promise<Session | null> {
  if (options?.disableRefresh) {
    const result = await auth.api.getSession({ headers, query: { disableRefresh: true } })
    return result ?? null
  }
  const { response, headers: resHeaders } = await auth.api.getSession({
    headers,
    returnHeaders: true,
  })
  const setCookies = resHeaders.getSetCookie()
  if (setCookies.length > 0) options?.onSetCookie?.(setCookies)
  return response ?? null
}

/**
 * Server Component 里读取会话（只读不续期，防止抢先推进 DB expires_at 饿死后续 /api/v1 续期 Cookie）。
 * 必须在 <Suspense> 内调用。同一请求内用 React cache() 去重。没登录返回 null。
 */
export const getSession = cache(async (): Promise<Session | null> => {
  return getSessionFromHeaders(await headers(), { disableRefresh: true })
})

/**
 * 页面保护：未登录 redirect('/login')；被封 redirect('/login?banned=1')。返回用户。
 * 封禁状态查库，不信任会话缓存（auth.md 第 5 节）。
 */
export async function requireUser(): Promise<SessionUser> {
  return (await requirePageUser()).user
}

/** requireUser 的内部版本：顺带返回实时状态，同一请求内用 cache() 去重，layout 与 page 不重复查库 */
const requirePageUser = cache(async () => {
  const session = await getSession()
  if (!session) redirect('/login')
  const state = await loadAccountState(session.user.id)
  const error = checkAccount(state, new Date())
  if (error?.code === 'ACCOUNT_BANNED') redirect('/login?banned=1')
  if (error || !state) redirect('/login')
  return { user: session.user, state }
})

/**
 * 页面保护：requireUser + 未完成引导 redirect('/onboarding')（PRD 7.1）
 */
export async function requireOnboardedUser(): Promise<SessionUser> {
  const { user, state } = await requirePageUser()
  if (checkOnboarded(state)) redirect('/onboarding')
  return user
}

/**
 * 后台页面保护：requireUser + role === 'admin'（否则 redirect('/')）。
 * 不强制两步验证：返回 twoFactorEnabled，供页面显示绑定流程（PRD 7.1）。接口层的 requireAdmin 才强制。
 */
export async function requireAdmin(): Promise<SessionUser & { twoFactorEnabled: boolean }> {
  const user = await requireUser()
  const error = checkAdmin({ role: user.role, twoFactorEnabled: true })
  if (error) redirect('/')
  return { ...user, twoFactorEnabled: user.twoFactorEnabled === true }
}

/** 用户当前是否处于封禁中（banned 且未过期）。纯函数（实现在 guards.ts，带单测） */
export function isBanned(user: Pick<SessionUser, 'banned' | 'banExpires'>, now: Date): boolean {
  return isBannedAt(user, now)
}
