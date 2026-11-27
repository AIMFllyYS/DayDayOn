import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import type { PublicUser } from '@/features/shared/schemas'
import { ApiError } from '@/server/api/errors'
import type { DbOrTx } from '@/server/db/client'
import { friendships, profiles, user } from '@/server/db/schema'

/*
 * 好友关系鉴权与公开用户信息加载（friends 域共享基础设施）：
 * - 供 friends/index.ts 与 friends/metrics.ts 共用，避免跨文件重复查询或循环依赖。
 */

export async function loadPublicUsers(
  db: DbOrTx,
  userIds: string[],
): Promise<Map<string, PublicUser & { mascot?: string | null }>> {
  if (userIds.length === 0) return new Map()
  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      nickname: profiles.nickname,
      avatar: profiles.avatar,
      mascot: profiles.mascot,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(inArray(user.id, userIds))

  const map = new Map<string, PublicUser & { mascot?: string | null }>()
  for (const r of rows) {
    const nickname = r.nickname?.trim() || r.name?.trim() || 'DayDayOn 伙伴'
    map.set(r.userId, {
      userId: r.userId,
      nickname,
      avatar: r.avatar ?? null,
      mascot: r.mascot ?? null,
    })
  }
  return map
}

/** 校验双向好友关系，否则统一抛出 404 FRIEND_NOT_FOUND（不泄露目标用户存在性） */
export async function assertFriendship(
  db: DbOrTx,
  userId: string,
  friendUserId: string,
): Promise<{ createdAt: Date }> {
  if (userId === friendUserId) {
    throw new ApiError('FRIEND_NOT_FOUND', 'Friendship not found')
  }
  const [relation] = await db
    .select({ createdAt: friendships.createdAt })
    .from(friendships)
    .where(and(eq(friendships.userId, userId), eq(friendships.friendId, friendUserId)))
    .limit(1)
  if (!relation) {
    throw new ApiError('FRIEND_NOT_FOUND', 'Friendship not found')
  }
  return relation
}
