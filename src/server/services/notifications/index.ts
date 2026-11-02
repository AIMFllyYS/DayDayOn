import 'server-only'
import { and, count, desc, eq, gte, inArray, isNull, lt } from 'drizzle-orm'
import type {
  MarkNotificationReadInput,
  MarkNotificationReadResponse,
  NotificationItem,
  NotificationListQuery,
  NotificationListResponse,
  NotificationSummary,
} from '@/features/notification/schemas'
import { db as defaultDb, type DbOrTx } from '@/server/db/client'
import { notifications, profiles, user, type NotificationKind } from '@/server/db/schema'

const FEED_KINDS: NotificationKind[] = [
  'checkin_aggregate',
  'pet_interaction',
  'visit_footprint',
  'friend',
]
const SYSTEM_KINDS: NotificationKind[] = ['system']

/** 格式化简短时间 HH:mm */
function formatTimeHM(d: Date): string {
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/** 批量获取用户公开昵称与头像 */
async function loadPublicUsers(
  db: DbOrTx,
  userIds: string[],
): Promise<Map<string, { nickname: string; avatar: string | null }>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)))
  if (uniqueIds.length === 0) return new Map()

  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      nickname: profiles.nickname,
      avatar: profiles.avatar,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(inArray(user.id, uniqueIds))

  const map = new Map<string, { nickname: string; avatar: string | null }>()
  for (const r of rows) {
    const nickname = r.nickname?.trim() || r.name?.trim() || 'DayDayOn 伙伴'
    map.set(r.userId, { nickname, avatar: r.avatar ?? null })
  }
  return map
}

/**
 * 获取用户未读通知摘要（未读数 + 是否有未读）
 * 用于顶栏铃铛 NotificationBellBadge
 */
export async function getNotificationSummary(
  db: DbOrTx = defaultDb,
  userId: string,
): Promise<NotificationSummary> {
  const [res] = await db
    .select({ unreadCount: count(notifications.id) })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))

  const unreadCount = Number(res?.unreadCount ?? 0)
  return {
    unreadCount,
    hasUnread: unreadCount > 0,
  }
}

/**
 * 分页获取通知列表
 * 支持按频道 (feed / system / all) 过滤与按未读状态过滤
 */
export async function listNotifications(
  db: DbOrTx = defaultDb,
  userId: string,
  options: Partial<NotificationListQuery> = {},
): Promise<NotificationListResponse> {
  const limit = options.limit ?? 20
  const channel = options.channel ?? 'all'
  const unreadOnly = options.unreadOnly ?? false
  const cursor = options.cursor

  const conditions = [eq(notifications.userId, userId)]

  if (unreadOnly) {
    conditions.push(isNull(notifications.readAt))
  }

  if (channel === 'feed') {
    conditions.push(inArray(notifications.kind, FEED_KINDS))
  } else if (channel === 'system') {
    conditions.push(inArray(notifications.kind, SYSTEM_KINDS))
  }

  if (cursor) {
    const cursorDate = new Date(cursor)
    if (!Number.isNaN(cursorDate.getTime())) {
      conditions.push(lt(notifications.createdAt, cursorDate))
    }
  }

  // 查询 limit + 1 条以检测是否有下一页
  const rows = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const resultRows = hasMore ? rows.slice(0, limit) : rows

  // 加载发送者公开信息
  const actorIds = resultRows.map((r) => r.actorId).filter((id): id is string => Boolean(id))
  const userMap = await loadPublicUsers(db, actorIds)

  const items: NotificationItem[] = resultRows.map((r) => {
    const actorInfo = r.actorId ? userMap.get(r.actorId) : undefined
    return {
      id: r.id,
      userId: r.userId,
      actorId: r.actorId,
      actorNickname: actorInfo?.nickname ?? null,
      actorAvatar: actorInfo?.avatar ?? null,
      kind: r.kind,
      title: r.title,
      content: r.content,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      readAt: r.readAt ? r.readAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }
  })

  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].createdAt : null

  return {
    items,
    nextCursor,
  }
}

/**
 * 标记通知已读（全部、指定频道、指定类别或指定 ID 列表）
 */
export async function markNotificationsRead(
  db: DbOrTx = defaultDb,
  userId: string,
  options: MarkNotificationReadInput = {},
  now: Date = new Date(),
): Promise<MarkNotificationReadResponse> {
  const conditions = [eq(notifications.userId, userId), isNull(notifications.readAt)]

  if (options.notificationIds && options.notificationIds.length > 0) {
    conditions.push(inArray(notifications.id, options.notificationIds))
  } else if (options.channel === 'feed') {
    conditions.push(inArray(notifications.kind, FEED_KINDS))
  } else if (options.channel === 'system') {
    conditions.push(inArray(notifications.kind, SYSTEM_KINDS))
  } else if (options.kind) {
    conditions.push(eq(notifications.kind, options.kind as NotificationKind))
  }

  const updatedRows = await db
    .update(notifications)
    .set({
      readAt: now,
      updatedAt: now,
    })
    .where(and(...conditions))
    .returning({ id: notifications.id })

  return {
    success: true,
    markedCount: updatedRows.length,
  }
}

/**
 * 5 分钟滑动窗口打卡动态聚合记录器（Issue #20 · Feature 15）
 * 同一好友 5 分钟内连续打卡多项时，合并为一个卡片更新明细，避免通知轰炸
 */
export async function recordCheckinNotification(
  db: DbOrTx = defaultDb,
  recipientUserId: string,
  actorUserId: string,
  checkin: {
    goalTitle: string
    module: string
    occurredAt?: Date
    time?: string
  },
  now: Date = new Date(),
): Promise<string | null> {
  if (recipientUserId === actorUserId) return null

  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
  const timeStr = checkin.time ?? formatTimeHM(checkin.occurredAt ?? now)

  // 查 actor 昵称
  const userMap = await loadPublicUsers(db, [actorUserId])
  const actorName = userMap.get(actorUserId)?.nickname ?? '好友'

  // 查找最近 5 分钟内、未读的打卡聚合通知
  const [existing] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, recipientUserId),
        eq(notifications.actorId, actorUserId),
        eq(notifications.kind, 'checkin_aggregate'),
        isNull(notifications.readAt),
        gte(notifications.createdAt, fiveMinutesAgo),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(1)

  if (existing) {
    const meta = (existing.metadata as Record<string, unknown>) ?? {}
    const existingCheckins = Array.isArray(meta.checkins)
      ? (meta.checkins as Array<{ title: string; module: string; time: string }>)
      : []

    const updatedCheckins = [
      ...existingCheckins,
      { title: checkin.goalTitle, module: checkin.module, time: timeStr },
    ]

    const countNum = updatedCheckins.length
    const firstTitle = updatedCheckins[0]?.title ?? checkin.goalTitle
    const title = `${actorName} 5分钟内连打 ${countNum} 项`
    const content = `${actorName} 刚刚一口气完成了「${firstTitle}」等 ${countNum} 项今日打卡！`

    const [updated] = await db
      .update(notifications)
      .set({
        title,
        content,
        metadata: {
          ...meta,
          checkins: updatedCheckins,
        },
        updatedAt: now,
      })
      .where(eq(notifications.id, existing.id))
      .returning({ id: notifications.id })

    return updated?.id ?? null
  }

  // 新增 5 分钟滑动窗口打卡通知卡片
  const title = `${actorName} 完成了「${checkin.goalTitle}」`
  const content = `${actorName} 刚刚完成了「${checkin.goalTitle}」今日打卡！`
  const initialCheckins = [{ title: checkin.goalTitle, module: checkin.module, time: timeStr }]

  const [inserted] = await db
    .insert(notifications)
    .values({
      userId: recipientUserId,
      actorId: actorUserId,
      kind: 'checkin_aggregate',
      title,
      content,
      metadata: {
        checkins: initialCheckins,
      },
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: notifications.id })

  return inserted?.id ?? null
}

/**
 * 24 小时静默去重造访足迹记录器（Issue #20 · Feature 16）
 * 好友串门造访小窝时静默记录；24 小时内多次造访只更新最后访问时间与次数，不重复弹窗骚扰
 */
export async function recordVisitFootprint(
  db: DbOrTx = defaultDb,
  ownerUserId: string,
  visitorUserId: string,
  visitorMascot: string = '墩墩',
  now: Date = new Date(),
): Promise<string | null> {
  if (ownerUserId === visitorUserId) return null

  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const timeStr = formatTimeHM(now)

  const userMap = await loadPublicUsers(db, [visitorUserId])
  const visitorName = userMap.get(visitorUserId)?.nickname ?? '好友'

  // 查找 24 小时内的造访记录
  const [existing] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, ownerUserId),
        eq(notifications.actorId, visitorUserId),
        eq(notifications.kind, 'visit_footprint'),
        gte(notifications.createdAt, oneDayAgo),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(1)

  if (existing) {
    const meta = (existing.metadata as Record<string, unknown>) ?? {}
    const visitCount = (typeof meta.visitCount === 'number' ? meta.visitCount : 1) + 1

    const content = `24 小时内多次造访静默合并更新时间，不重复打扰 · 最近 ${timeStr}`

    const [updated] = await db
      .update(notifications)
      .set({
        content,
        metadata: {
          ...meta,
          visitCount,
          lastVisitedAt: now.toISOString(),
          visitorMascot,
        },
        updatedAt: now,
      })
      .where(eq(notifications.id, existing.id))
      .returning({ id: notifications.id })

    return updated?.id ?? null
  }

  // 首次造访：插入足迹
  const title = `${visitorName} 带着${visitorMascot}来你的小窝看了一眼，留下了小脚印`
  const content = `24 小时内多次造访静默合并更新时间，不重复打扰 · 最近 ${timeStr}`

  const [inserted] = await db
    .insert(notifications)
    .values({
      userId: ownerUserId,
      actorId: visitorUserId,
      kind: 'visit_footprint',
      title,
      content,
      metadata: {
        visitCount: 1,
        lastVisitedAt: now.toISOString(),
        visitorMascot,
      },
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: notifications.id })

  return inserted?.id ?? null
}

/**
 * 通用创建通知辅助函数（供系统公告、宠物戳戳互动等调用）
 */
export async function createNotification(
  db: DbOrTx = defaultDb,
  params: {
    userId: string
    actorId?: string | null
    kind: NotificationKind
    title: string
    content?: string
    metadata?: Record<string, unknown>
    now?: Date
  },
): Promise<string> {
  const now = params.now ?? new Date()
  const [inserted] = await db
    .insert(notifications)
    .values({
      userId: params.userId,
      actorId: params.actorId ?? null,
      kind: params.kind,
      title: params.title,
      content: params.content ?? '',
      metadata: params.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: notifications.id })

  return inserted.id
}
