import 'server-only'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
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

/**
 * 按请求头取会话（Hono 中间件用 `c.req.raw.headers`）。没有会话返回 null。
 */
export async function getSessionFromHeaders(headers: Headers): Promise<Session | null> {
  const result = await auth.api.getSession({ headers })
  return result ?? null
}

/**
 * Server Component 里读取会话（内部 `auth.api.getSession({ headers: await headers() })`）。
 * 必须在 <Suspense> 内调用。没登录返回 null。
 */
export async function getSession(): Promise<Session | null> {
  return getSessionFromHeaders(await headers())
}

/**
 * 页面保护：未登录 redirect('/login')；被封 redirect('/login?banned=1')。返回用户。
 * 封禁状态查库，不信任会话缓存（auth.md 第 5 节）。
 */
export async function requireUser(): Promise<SessionUser> {
  return (await requirePageUser()).user
}

/** requireUser 的内部版本：顺带返回实时状态，requireOnboardedUser 不用再查一次 */
async function requirePageUser() {
  const session = await getSession()
  if (!session) redirect('/login')
  const state = await loadAccountState(session.user.id)
  const error = checkAccount(state, new Date())
  if (error?.code === 'ACCOUNT_BANNED') redirect('/login?banned=1')
  if (error || !state) redirect('/login')
  return { user: session.user, state }
}

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
