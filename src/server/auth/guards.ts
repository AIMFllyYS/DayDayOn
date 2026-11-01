import { ApiError, type BanInfo } from '@/server/api/errors'

/*
 * 鉴权判定（auth.md 第 5、6 节、PRD 7.1）：纯函数，带单元测试。
 * Hono 中间件、页面保护、runAi 都用这里的判定，只是失败时的处理不同（返回错误体 / redirect）。
 * 不 import 'server-only'、不碰数据库：调用方先取会话和 AccountState 再传进来。
 */

interface BanFields {
  banned?: boolean | null
  banReason?: string | null
  banExpires?: Date | null
}

/** 用户当前是否处于封禁中（banned 且未过期） */
export function isBanned(u: BanFields, now: Date): boolean {
  if (!u.banned) return false
  if (!u.banExpires) return true
  return u.banExpires.getTime() > now.getTime()
}

export function banInfo(u: BanFields): BanInfo {
  return {
    reason: u.banReason ?? null,
    expiresAt: u.banExpires ? u.banExpires.toISOString() : null,
  }
}

export function bannedError(u: BanFields): ApiError {
  return new ApiError('ACCOUNT_BANNED', '账号已被停用', { ban: banInfo(u) })
}

/**
 * 已登录用户的通用检查：会话对应的用户还在、未被封禁。
 * state 为 null 表示用户已不存在（注销后会话残留）。
 */
export function checkAccount(state: BanFields | null, now: Date): ApiError | null {
  if (!state) return new ApiError('UNAUTHENTICATED', '用户不存在或已注销')
  if (isBanned(state, now)) return bannedError(state)
  return null
}

/** 新人引导是否完成：只看 onboardedAt（PRD 7.1） */
export function checkOnboarded(state: { onboardedAt: Date | null }): ApiError | null {
  return state.onboardedAt ? null : new ApiError('ONBOARDING_REQUIRED', '先完成新人引导')
}

/** 管理员：role === 'admin'，且已开启两步验证（auth.md 第 6 节） */
export function checkAdmin(u: {
  role?: string | null
  twoFactorEnabled?: boolean | null
}): ApiError | null {
  if (u.role !== 'admin') return new ApiError('FORBIDDEN', '需要管理员权限')
  if (!u.twoFactorEnabled) return new ApiError('TWO_FACTOR_REQUIRED', '管理员需要先开启两步验证')
  return null
}
