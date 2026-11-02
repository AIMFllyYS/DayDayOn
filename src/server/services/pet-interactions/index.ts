import 'server-only'
import { and, desc, eq, inArray } from 'drizzle-orm'
import type {
  PetActionState,
  PetInteractInput,
  PetInteractResult,
  PetInteractionKind,
  PetInteractionTreatId,
  PetInteractionsStatus,
} from '@/features/friend/schemas'
import { localDateOf } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import { db as defaultDb, type DbOrTx } from '@/server/db/client'
import { friendPetInteractions, friendships, profiles, user } from '@/server/db/schema'
import { getDashboardToday } from '@/server/services/dashboard'
import { createNotification } from '@/server/services/notifications'

/** 互动冷却时长：30 分钟（1800 秒） */
export const COOLDOWN_SECONDS = 30 * 60

/** 各互动类型的每日上限（按被互动好友本地日历日计算） */
export const DAILY_LIMITS: Record<PetInteractionKind, number> = {
  poke: 3,
  feed: 1,
  remind: 1,
}

const MASCOT_NAMES: Record<string, string> = {
  tuan: '团团',
  dun: '墩墩',
  mian: '绵绵',
  you: '柚柚',
}

const TREAT_DEFS: Record<PetInteractionTreatId, { label: string; flavor: string }> = {
  onigiri: { label: '海苔饭团', flavor: '饱腹蓄力跳' },
  strawberry: { label: '奶油草莓', flavor: '酸甜冒爱心' },
  cookie: { label: '黄油曲奇', flavor: '酥脆掉饼渣' },
  pudding: { label: '焦糖布丁', flavor: 'Q弹转圈圈' },
  dango: { label: '三色团子', flavor: '软糯害羞笑' },
  milk: { label: '晚安热奶', flavor: '暖胃乖乖点头' },
}

interface UserProfileBasic {
  userId: string
  nickname: string
  avatar: string | null
  mascot: string
  timeZone: string
  dayStartHour: number
}

async function loadUserProfiles(
  db: DbOrTx,
  userIds: string[],
): Promise<Map<string, UserProfileBasic>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)))
  if (uniqueIds.length === 0) return new Map()

  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      nickname: profiles.nickname,
      avatar: profiles.avatar,
      mascot: profiles.mascot,
      timeZone: profiles.timeZone,
      dayStartHour: profiles.dayStartHour,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(inArray(user.id, uniqueIds))

  const map = new Map<string, UserProfileBasic>()
  for (const r of rows) {
    const nickname = r.nickname?.trim() || r.name?.trim() || 'DayDayOn 伙伴'
    map.set(r.userId, {
      userId: r.userId,
      nickname,
      avatar: r.avatar ?? null,
      mascot: r.mascot ?? 'tuan',
      timeZone: r.timeZone ?? 'Asia/Shanghai',
      dayStartHour: r.dayStartHour ?? 4,
    })
  }
  return map
}

/**
 * 校验双方好友关系：必须双向为好友
 */
async function assertFriendship(
  db: DbOrTx,
  actorId: string,
  targetFriendId: string,
): Promise<void> {
  if (actorId === targetFriendId) {
    throw new ApiError('FRIEND_NOT_FOUND', '无法与自己进行好友互动')
  }

  const [relation] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(and(eq(friendships.userId, actorId), eq(friendships.friendId, targetFriendId)))
    .limit(1)

  if (!relation) {
    throw new ApiError('FRIEND_NOT_FOUND', '未找到该好友关系')
  }
}

/**
 * 查询指定好友的宠物互动额度状态、剩余冷却时长与提醒打卡可用性
 * （GET /friends/{friendUserId}/interactions）
 */
export async function getPetInteractionsStatus(
  db: DbOrTx = defaultDb,
  actorId: string,
  targetFriendId: string,
  now: Date = new Date(),
): Promise<PetInteractionsStatus> {
  await assertFriendship(db, actorId, targetFriendId)

  const profilesMap = await loadUserProfiles(db, [targetFriendId])
  const targetProfile = profilesMap.get(targetFriendId)
  if (!targetProfile) {
    throw new ApiError('USER_NOT_FOUND', '找不到好友资料')
  }

  // Decision #5：按目标好友的时区与日切换时间计算本地日期
  const targetLocalDate = localDateOf(now, targetProfile.timeZone, targetProfile.dayStartHour)

  // 查询好友今日打卡目标进度（用于校验提醒打卡可用性）
  const dashboard = await getDashboardToday(db, targetFriendId, now)
  const todayPlanned = dashboard.completion.planned
  const todayDone = dashboard.completion.done

  let remindDisabledReason: string | null = null
  if (todayPlanned === 0) {
    remindDisabledReason = '今日休息'
  } else if (todayDone >= todayPlanned) {
    remindDisabledReason = '今日已达标'
  }
  const remindEligible = remindDisabledReason === null

  // 查询今天该 actor 对该 targetFriend 的所有互动记录
  const todayInteractions = await db
    .select({
      id: friendPetInteractions.id,
      kind: friendPetInteractions.kind,
      createdAt: friendPetInteractions.createdAt,
    })
    .from(friendPetInteractions)
    .where(
      and(
        eq(friendPetInteractions.actorId, actorId),
        eq(friendPetInteractions.targetFriendId, targetFriendId),
        eq(friendPetInteractions.targetLocalDate, targetLocalDate),
      ),
    )

  // 查询各类型最近一次互动的发生时间（用于计算 30 分钟冷却）
  const lastInteractions = await Promise.all(
    (['poke', 'feed', 'remind'] as const).map(async (kind) => {
      const [last] = await db
        .select({ createdAt: friendPetInteractions.createdAt })
        .from(friendPetInteractions)
        .where(
          and(
            eq(friendPetInteractions.actorId, actorId),
            eq(friendPetInteractions.targetFriendId, targetFriendId),
            eq(friendPetInteractions.kind, kind),
          ),
        )
        .orderBy(desc(friendPetInteractions.createdAt))
        .limit(1)
      return { kind, lastAt: last?.createdAt ?? null }
    }),
  )

  const nowMs = now.getTime()
  const cooldownMap: Record<PetInteractionKind, number> = { poke: 0, feed: 0, remind: 0 }
  for (const { kind, lastAt } of lastInteractions) {
    if (lastAt) {
      const elapsedSec = Math.floor((nowMs - lastAt.getTime()) / 1000)
      if (elapsedSec < COOLDOWN_SECONDS) {
        cooldownMap[kind] = COOLDOWN_SECONDS - elapsedSec
      }
    }
  }

  const usedCounts: Record<PetInteractionKind, number> = { poke: 0, feed: 0, remind: 0 }
  for (const row of todayInteractions) {
    if (row.kind in usedCounts) {
      usedCounts[row.kind] += 1
    }
  }

  function buildActionState(kind: PetInteractionKind): PetActionState {
    const limit = DAILY_LIMITS[kind]
    const used = usedCounts[kind]
    const cooldownLeftSec = cooldownMap[kind]
    const exhausted = used >= limit
    let disabledReason: string | null = null

    if (kind === 'remind' && remindDisabledReason) {
      disabledReason = remindDisabledReason
    } else if (exhausted) {
      disabledReason = '今日已用完'
    } else if (cooldownLeftSec > 0) {
      disabledReason = '冷却中'
    }

    return {
      used,
      limit,
      cooldownLeftSec,
      disabledReason,
    }
  }

  const actions = {
    poke: buildActionState('poke'),
    feed: buildActionState('feed'),
    remind: buildActionState('remind'),
  }

  const overallCooldownLeftSec = Math.max(
    actions.poke.cooldownLeftSec,
    actions.feed.cooldownLeftSec,
    actions.remind.cooldownLeftSec,
  )

  return {
    friendUserId: targetFriendId,
    targetLocalDate,
    cooldownLeftSec: overallCooldownLeftSec,
    actions,
    remindEligible,
    remindDisabledReason,
  }
}

/**
 * 执行宠物互动（戳戳、投喂、提醒打卡）
 * （POST /friends/{friendUserId}/interact）
 */
export async function interactWithFriendPet(
  db: DbOrTx = defaultDb,
  actorId: string,
  targetFriendId: string,
  input: PetInteractInput,
  now: Date = new Date(),
): Promise<PetInteractResult> {
  await assertFriendship(db, actorId, targetFriendId)

  const profilesMap = await loadUserProfiles(db, [actorId, targetFriendId])
  const actorProfile = profilesMap.get(actorId)
  const targetProfile = profilesMap.get(targetFriendId)
  if (!actorProfile || !targetProfile) {
    throw new ApiError('USER_NOT_FOUND', '找不到用户资料')
  }

  const targetPetName = MASCOT_NAMES[targetProfile.mascot] ?? '团团'

  // 1. 提醒打卡资格校验
  if (input.kind === 'remind') {
    const dashboard = await getDashboardToday(db, targetFriendId, now)
    const todayPlanned = dashboard.completion.planned
    const todayDone = dashboard.completion.done

    if (todayPlanned === 0 || todayDone >= todayPlanned) {
      throw new ApiError('REMIND_NOT_APPLICABLE', '好友今日目标已达标或今日休息，暂无需提醒')
    }
  }

  // 2. 30 分钟冷却校验（1800 秒）：先阻断频繁请求
  const [latestRow] = await db
    .select({ createdAt: friendPetInteractions.createdAt })
    .from(friendPetInteractions)
    .where(
      and(
        eq(friendPetInteractions.actorId, actorId),
        eq(friendPetInteractions.targetFriendId, targetFriendId),
        eq(friendPetInteractions.kind, input.kind),
      ),
    )
    .orderBy(desc(friendPetInteractions.createdAt))
    .limit(1)

  if (latestRow) {
    const elapsedSec = Math.floor((now.getTime() - latestRow.createdAt.getTime()) / 1000)
    if (elapsedSec < COOLDOWN_SECONDS) {
      const retryAfterSeconds = COOLDOWN_SECONDS - elapsedSec
      throw new ApiError(
        'INTERACTION_COOLDOWN',
        `互动冷却中，请在 ${Math.ceil(retryAfterSeconds / 60)} 分钟后再试`,
        { retryAfterSeconds },
      )
    }
  }

  // 3. 每日限额校验（Decision #5：根据好友时区与日切换时间获取 targetLocalDate）
  const targetLocalDate = localDateOf(now, targetProfile.timeZone, targetProfile.dayStartHour)

  const todaySameKindRows = await db
    .select({ id: friendPetInteractions.id })
    .from(friendPetInteractions)
    .where(
      and(
        eq(friendPetInteractions.actorId, actorId),
        eq(friendPetInteractions.targetFriendId, targetFriendId),
        eq(friendPetInteractions.kind, input.kind),
        eq(friendPetInteractions.targetLocalDate, targetLocalDate),
      ),
    )

  const limit = DAILY_LIMITS[input.kind]
  if (todaySameKindRows.length >= limit) {
    throw new ApiError(
      'INTERACTION_DAILY_LIMIT_EXCEEDED',
      `今日对该好友的「${input.kind}」互动次数已达上限（${limit}次/日）`,
    )
  }

  // 4. 插入互动记录
  const treatId = input.kind === 'feed' ? (input.treatId ?? 'strawberry') : null
  const [inserted] = await db
    .insert(friendPetInteractions)
    .values({
      actorId,
      targetFriendId,
      kind: input.kind,
      treatId,
      targetLocalDate,
      createdAt: now,
    })
    .returning({
      id: friendPetInteractions.id,
      kind: friendPetInteractions.kind,
      treatId: friendPetInteractions.treatId,
      createdAt: friendPetInteractions.createdAt,
    })

  // 5. 向目标好友发送互动通知
  let notifTitle = ''
  let notifContent = ''
  let feedback = ''

  if (input.kind === 'poke') {
    notifTitle = `${actorProfile.nickname} 戳了戳你的${targetPetName}`
    notifContent = `${actorProfile.nickname} 戳了戳你的小窝伙伴，叫你快来看看～`
    feedback = `已戳了戳 ${targetProfile.nickname} 的${targetPetName}～对方将收到一条互动通知`
  } else if (input.kind === 'feed') {
    const treat = TREAT_DEFS[treatId ?? 'strawberry']
    notifTitle = `${actorProfile.nickname} 给你的${targetPetName}投喂了「${treat.label}」`
    notifContent = `${actorProfile.nickname} 投喂了「${treat.label}」，${targetPetName}【${treat.flavor}】！`
    feedback = `给 ${targetProfile.nickname} 的${targetPetName}投喂了「${treat.label}」→ 触发【${treat.flavor}】专属反应！`
  } else {
    const dashboard = await getDashboardToday(db, targetFriendId, now)
    const remaining = Math.max(1, dashboard.completion.planned - dashboard.completion.done)
    notifTitle = `${actorProfile.nickname} 温柔提醒你今日打卡`
    notifContent = `今天的小目标还差 ${remaining} 个就圆满啦，一起加油～`
    feedback = `已派${targetPetName}温柔提醒 ${targetProfile.nickname}：「今天的小目标还差 ${remaining} 个就圆满啦，一起加油～」`
  }

  await createNotification(db, {
    userId: targetFriendId,
    actorId,
    kind: 'pet_interaction',
    title: notifTitle,
    content: notifContent,
    metadata: {
      kind: input.kind,
      treatId,
      actorNickname: actorProfile.nickname,
      actorAvatar: actorProfile.avatar,
    },
    now,
  }).catch((err) => {
    console.error('Failed to insert pet interaction notification:', err)
  })

  // 6. 获取更新后的状态
  const updatedStatus = await getPetInteractionsStatus(db, actorId, targetFriendId, now)

  return {
    success: true,
    interaction: {
      id: inserted.id,
      kind: inserted.kind,
      treatId: inserted.treatId,
      createdAt: inserted.createdAt.toISOString(),
    },
    status: updatedStatus,
    feedback,
  }
}
