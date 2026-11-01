import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db/client'
import { profiles, user } from '@/server/db/schema'

/*
 * 账号的实时状态：封禁信息（不信任会话里的缓存，auth.md 第 5 节）+ 是否完成引导（PRD 7.1）。
 * 一条 LEFT JOIN 查询，requireUser / requireOnboarded 与 runAi 共用。
 */

export interface AccountState {
  banned: boolean
  banReason: string | null
  banExpires: Date | null
  /** profiles.onboardedAt；没有 profile 行（注册钩子失败）时为 null */
  onboardedAt: Date | null
}

/** 用户不存在（已注销）返回 null */
export async function loadAccountState(userId: string): Promise<AccountState | null> {
  const [row] = await db
    .select({
      banned: user.banned,
      banReason: user.banReason,
      banExpires: user.banExpires,
      onboardedAt: profiles.onboardedAt,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(eq(user.id, userId))
    .limit(1)
  if (!row) return null
  return {
    banned: row.banned ?? false,
    banReason: row.banReason ?? null,
    banExpires: row.banExpires ?? null,
    onboardedAt: row.onboardedAt ?? null,
  }
}
