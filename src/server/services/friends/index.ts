import 'server-only'
import { randomInt } from 'node:crypto'
import { and, asc, count, desc, eq, gt, inArray, isNull, or } from 'drizzle-orm'
import type {
  FriendAcceptResult,
  FriendDashboard,
  FriendInvite,
  FriendInvitePreview,
  FriendList,
  FriendSummary,
} from '@/features/friend/schemas'
import type { MascotRegistryCharacter } from '@/features/me/schemas'
import type { PublicUser } from '@/features/shared/schemas'
import { ApiError } from '@/server/api/errors'
import { db as defaultDb, type DbOrTx } from '@/server/db/client'
import { friendInvites, friendships, profiles, user } from '@/server/db/schema'
import { getDashboardToday } from '@/server/services/dashboard'
import { recordVisitFootprint } from '@/server/services/notifications'

/** 好友上限：最多 50 位 */
export const MAX_FRIENDS = 50

/** 配对码有效期：10 分钟（600,000 ms） */
export const FRIEND_INVITE_TTL_MS = 10 * 60 * 1000

const MASCOT_NAMES: Record<string, string> = {
  tuan: '团团',
  dun: '墩墩',
  mian: '绵绵',
  you: '柚柚',
}

async function loadPublicUsers(
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

async function buildFriendSummary(
  db: DbOrTx,
  friendUserId: string,
  publicUser: PublicUser & { mascot?: string | null },
  friendshipCreatedAt: Date,
  now: Date,
): Promise<FriendSummary> {
  const dash = await getDashboardToday(db, friendUserId, now)
  const rawMascot = publicUser.mascot
  const mascot: MascotRegistryCharacter =
    rawMascot === 'tuan' || rawMascot === 'dun' || rawMascot === 'mian' || rawMascot === 'you'
      ? rawMascot
      : 'tuan'
  return {
    userId: publicUser.userId,
    nickname: publicUser.nickname,
    avatar: publicUser.avatar,
    mascot,
    streak: dash.streak,
    todayDone: dash.completion.done,
    todayPlanned: dash.completion.planned,
    todayMood: dash.mood,
    createdAt: friendshipCreatedAt.toISOString(),
  }
}

/**
 * 获取当前用户与好友列表（含每人今日完成度、连续打卡天数、今日心情）。
 * 按成为好友的时间正序排列，对应左上角堆叠头像与好友切换面板的顺序。
 */
export async function listFriends(
  db: DbOrTx,
  userId: string,
  now: Date = new Date(),
): Promise<FriendList> {
  const relationRows = await db
    .select({
      friendId: friendships.friendId,
      createdAt: friendships.createdAt,
    })
    .from(friendships)
    .where(eq(friendships.userId, userId))
    .orderBy(asc(friendships.createdAt))

  const allUserIds = [userId, ...relationRows.map((r) => r.friendId)]
  const userMap = await loadPublicUsers(db, allUserIds)

  const me: PublicUser = userMap.get(userId) ?? {
    userId,
    nickname: '我',
    avatar: null,
  }

  const friends = await Promise.all(
    relationRows.map(async (row) => {
      const pub = userMap.get(row.friendId) ?? {
        userId: row.friendId,
        nickname: '好友',
        avatar: null,
      }
      return buildFriendSummary(db, row.friendId, pub, row.createdAt, now)
    }),
  )

  return { me, friends }
}

/**
 * 发起好友邀请（10 分钟有效，6 位随机数字）：
 * - 若当前用户已有未过期且未使用的配对码，直接返回该配对码与原 expiresAt（保证关闭弹窗再打开倒计时连续）
 * - 若无或已满 10 分钟过期，生成新的 6 位数字配对码并从当前时刻起算 10 分钟
 */
export async function getOrCreateInviteCode(
  db: DbOrTx,
  userId: string,
  now: Date = new Date(),
): Promise<FriendInvite> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        code: friendInvites.code,
        expiresAt: friendInvites.expiresAt,
      })
      .from(friendInvites)
      .where(
        and(
          eq(friendInvites.inviterId, userId),
          isNull(friendInvites.usedAt),
          gt(friendInvites.expiresAt, now),
        ),
      )
      .orderBy(desc(friendInvites.createdAt))
      .limit(1)

    if (existing) {
      return {
        code: existing.code,
        expiresAt: existing.expiresAt.toISOString(),
        serverNow: now.toISOString(),
      }
    }

    let code = String(randomInt(100000, 1000000))
    for (let attempt = 0; attempt < 5; attempt++) {
      const [collision] = await tx
        .select({ id: friendInvites.id })
        .from(friendInvites)
        .where(
          and(
            eq(friendInvites.code, code),
            isNull(friendInvites.usedAt),
            gt(friendInvites.expiresAt, now),
          ),
        )
        .limit(1)
      if (!collision) break
      code = String(randomInt(100000, 1000000))
    }

    const expiresAt = new Date(now.getTime() + FRIEND_INVITE_TTL_MS)
    await tx.insert(friendInvites).values({
      inviterId: userId,
      code,
      expiresAt,
    })

    return {
      code,
      expiresAt: expiresAt.toISOString(),
      serverNow: now.toISOString(),
    }
  })
}

/**
 * 预览配对码对应的邀请方信息（用于弹出屏幕正中央的二次确认弹窗）。
 */
export async function previewInviteCode(
  db: DbOrTx,
  userId: string,
  rawCode: string,
  now: Date = new Date(),
): Promise<FriendInvitePreview> {
  const code = rawCode.trim()
  const [invite] = await db
    .select({
      id: friendInvites.id,
      inviterId: friendInvites.inviterId,
      code: friendInvites.code,
      expiresAt: friendInvites.expiresAt,
    })
    .from(friendInvites)
    .where(
      and(
        eq(friendInvites.code, code),
        isNull(friendInvites.usedAt),
        gt(friendInvites.expiresAt, now),
      ),
    )
    .orderBy(desc(friendInvites.createdAt))
    .limit(1)

  if (!invite) {
    throw new ApiError('FRIEND_INVITE_INVALID', 'Invite code invalid or expired')
  }
  if (invite.inviterId === userId) {
    throw new ApiError('FRIEND_SELF_INVITE', 'Cannot accept own invite code')
  }

  const [existingFriendship] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(and(eq(friendships.userId, userId), eq(friendships.friendId, invite.inviterId)))
    .limit(1)

  if (existingFriendship) {
    throw new ApiError('FRIEND_ALREADY_EXISTS', 'Already friends with this user')
  }

  const userMap = await loadPublicUsers(db, [invite.inviterId])
  const inviter = userMap.get(invite.inviterId)
  if (!inviter) {
    throw new ApiError('USER_NOT_FOUND', 'Inviter user not found')
  }

  return {
    code: invite.code,
    inviter,
    expiresAt: invite.expiresAt.toISOString(),
  }
}

/**
 * 确认接受好友邀请：
 * 在同一事务中消费配对码并双向写入 friendships (A↔B)，返回新好友摘要。
 */
export async function acceptInviteCode(
  db: DbOrTx,
  userId: string,
  rawCode: string,
  now: Date = new Date(),
): Promise<FriendAcceptResult> {
  const code = rawCode.trim()
  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select({
        id: friendInvites.id,
        inviterId: friendInvites.inviterId,
        code: friendInvites.code,
      })
      .from(friendInvites)
      .where(
        and(
          eq(friendInvites.code, code),
          isNull(friendInvites.usedAt),
          gt(friendInvites.expiresAt, now),
        ),
      )
      .orderBy(desc(friendInvites.createdAt))
      .limit(1)

    if (!invite) {
      throw new ApiError('FRIEND_INVITE_INVALID', 'Invite code invalid or expired')
    }
    if (invite.inviterId === userId) {
      throw new ApiError('FRIEND_SELF_INVITE', 'Cannot accept own invite code')
    }

    const [existingFriendship] = await tx
      .select({ id: friendships.id })
      .from(friendships)
      .where(and(eq(friendships.userId, userId), eq(friendships.friendId, invite.inviterId)))
      .limit(1)

    if (existingFriendship) {
      throw new ApiError('FRIEND_ALREADY_EXISTS', 'Already friends with this user')
    }

    const [userCountRow] = await tx
      .select({ count: count() })
      .from(friendships)
      .where(eq(friendships.userId, userId))

    const [inviterCountRow] = await tx
      .select({ count: count() })
      .from(friendships)
      .where(eq(friendships.userId, invite.inviterId))

    if ((userCountRow?.count ?? 0) >= MAX_FRIENDS || (inviterCountRow?.count ?? 0) >= MAX_FRIENDS) {
      throw new ApiError('FRIEND_LIMIT_REACHED', `好友数量已达上限（最多 ${MAX_FRIENDS} 位）`)
    }

    const updated = await tx
      .update(friendInvites)
      .set({
        usedByUserId: userId,
        usedAt: now,
        updatedAt: now,
      })
      .where(and(eq(friendInvites.id, invite.id), isNull(friendInvites.usedAt)))
      .returning({ id: friendInvites.id })

    if (updated.length === 0) {
      throw new ApiError('FRIEND_INVITE_INVALID', 'Invite code already consumed')
    }

    await tx
      .insert(friendships)
      .values([
        { userId, friendId: invite.inviterId, createdAt: now, updatedAt: now },
        { userId: invite.inviterId, friendId: userId, createdAt: now, updatedAt: now },
      ])
      .onConflictDoNothing()

    const userMap = await loadPublicUsers(tx, [invite.inviterId])
    const inviter = userMap.get(invite.inviterId) ?? {
      userId: invite.inviterId,
      nickname: '新好友',
      avatar: null,
    }

    const friend = await buildFriendSummary(tx, invite.inviterId, inviter, now, now)
    return { friend }
  })
}

/**
 * 查看指定好友的完整今日打卡仪表盘（完全透明公开，仅需验证双方为好友关系）。
 */
export async function getFriendDashboard(
  db: DbOrTx,
  userId: string,
  friendUserId: string,
  now: Date = new Date(),
): Promise<FriendDashboard> {
  const [relation] = await db
    .select({
      createdAt: friendships.createdAt,
    })
    .from(friendships)
    .where(and(eq(friendships.userId, userId), eq(friendships.friendId, friendUserId)))
    .limit(1)

  if (!relation) {
    throw new ApiError('FRIEND_NOT_FOUND', 'Friendship not found')
  }

  const userMap = await loadPublicUsers(db, [friendUserId, userId])
  const pub = userMap.get(friendUserId)
  if (!pub) {
    throw new ApiError('USER_NOT_FOUND', 'Friend user not found')
  }

  // 串门造访小窝时静默记录 24 小时足迹（Issue #20 · Feature 16 / Issue #21）
  const visitor = userMap.get(userId)
  const visitorMascot = visitor?.mascot ?? 'tuan'
  const visitorMascotName = MASCOT_NAMES[visitorMascot] ?? '团团'
  await recordVisitFootprint(db, friendUserId, userId, visitorMascotName, now).catch((err) => {
    console.error('Failed to record silent visit footprint:', err)
  })

  const dashboard = await getDashboardToday(db, friendUserId, now)
  const friend = await buildFriendSummary(db, friendUserId, pub, relation.createdAt, now)

  return { friend, dashboard }
}

/**
 * 解除好友关系：
 * - 校验双方当前是否为好友，若不是则抛出 404 FRIEND_NOT_FOUND
 * - 在事务中原子删除双向关系行 (userId ↔ friendUserId)
 */
export async function removeFriend(db: DbOrTx, userId: string, friendUserId: string): Promise<void>
export async function removeFriend(userId: string, friendUserId: string): Promise<void>
export async function removeFriend(
  dbOrUserId: DbOrTx | string,
  userIdOrFriendId: string,
  maybeFriendId?: string,
): Promise<void> {
  const targetDb: DbOrTx = typeof dbOrUserId === 'string' ? defaultDb : dbOrUserId
  const userId = typeof dbOrUserId === 'string' ? dbOrUserId : userIdOrFriendId
  const friendUserId = typeof dbOrUserId === 'string' ? userIdOrFriendId : maybeFriendId!

  return targetDb.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: friendships.id })
      .from(friendships)
      .where(and(eq(friendships.userId, userId), eq(friendships.friendId, friendUserId)))
      .limit(1)

    if (!existing) {
      throw new ApiError('FRIEND_NOT_FOUND', 'Friendship not found')
    }

    await tx
      .delete(friendships)
      .where(
        or(
          and(eq(friendships.userId, userId), eq(friendships.friendId, friendUserId)),
          and(eq(friendships.userId, friendUserId), eq(friendships.friendId, userId)),
        ),
      )
  })
}
