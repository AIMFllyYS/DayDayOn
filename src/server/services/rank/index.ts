import 'server-only'
import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, max, or } from 'drizzle-orm'
import type { Feed, RankBoard, RankRange } from '@/features/rank/schemas'
import { localDateOf, monthRange, weekRange } from '@/lib/time'
import type { DbOrTx } from '@/server/db/client'
import { checkins, profiles, user } from '@/server/db/schema'
import { buildRankBoard, isRankEligible, type RankCandidate, type RankCheckin } from './board'
import { FEED_LIMIT, feedSince, shapeFeed } from './feed'
import { loadStreaks } from './streaks'

/*
 * 排行榜与榜单动态（PRD 2.8 第 5 项、2.9、7.2）。读操作，接收 db 或 tx。
 * 只返回公开字段：昵称、头像、打卡天数、连续天数、板块、时间。不出现任何数值和备注。
 */

/** 上榜用户的安全上限：朋友圈子规模，远小于它 */
const MAX_CANDIDATES = 2000
/** 动态多取一些：查询之后还要按封禁到期时间再过滤一次 */
const FEED_FETCH = FEED_LIMIT * 3

/** 未被封（或封禁已到期）的 SQL 条件；JS 里还会用 isRankEligible 再判一次 */
function notBannedAt(now: Date) {
  return or(isNull(user.banned), eq(user.banned, false), lt(user.banExpires, now))
}

const publicProfileColumns = {
  userId: profiles.userId,
  nickname: profiles.nickname,
  avatar: profiles.avatar,
  leaderboardOptIn: profiles.leaderboardOptIn,
  onboardedAt: profiles.onboardedAt,
  banned: user.banned,
  banExpires: user.banExpires,
}

/** 北京时间的本周（ISO 周）/ 本月范围（PRD 7.2：先求起止日期，再按 localDate 计数） */
export function rankRange(range: RankRange, now: Date): { from: string; to: string } {
  const r = range === 'week' ? weekRange(now) : monthRange(now)
  return { from: r.start, to: r.end }
}

export async function getRankBoard(
  db: DbOrTx,
  userId: string,
  range: RankRange,
  now: Date,
): Promise<RankBoard> {
  const { from, to } = rankRange(range, now)

  const people = await db
    .select({
      ...publicProfileColumns,
      timeZone: profiles.timeZone,
      dayStartHour: profiles.dayStartHour,
    })
    .from(profiles)
    .innerJoin(user, eq(user.id, profiles.userId))
    .where(
      and(
        eq(profiles.leaderboardOptIn, true),
        isNotNull(profiles.onboardedAt),
        isNotNull(profiles.nickname),
        notBannedAt(now),
      ),
    )
    .limit(MAX_CANDIDATES)
  const eligible = people.filter((p) => isRankEligible(p, now))
  if (eligible.length === 0)
    return buildRankBoard({ range, from, to, candidates: [], meUserId: userId })

  const ids = eligible.map((p) => p.userId)
  // 每人每天、补卡与否各一行；最后打卡时间用于并列排序
  const days = await db
    .select({
      userId: checkins.userId,
      localDate: checkins.localDate,
      isMakeup: checkins.isMakeup,
      lastAt: max(checkins.occurredAt),
    })
    .from(checkins)
    .where(
      and(
        inArray(checkins.userId, ids),
        gte(checkins.localDate, from),
        lte(checkins.localDate, to),
      ),
    )
    .groupBy(checkins.userId, checkins.localDate, checkins.isMakeup)
    // 每人最多 31 天 × 2
    .limit(ids.length * 62)

  const byUser = new Map<string, RankCheckin[]>()
  for (const d of days) {
    if (d.lastAt === null) continue
    const row: RankCheckin = {
      localDate: d.localDate,
      isMakeup: d.isMakeup,
      occurredAt: d.lastAt.toISOString(),
    }
    const list = byUser.get(d.userId)
    if (list) list.push(row)
    else byUser.set(d.userId, [row])
  }

  const streaks = await loadStreaks(
    db,
    eligible.map((p) => ({
      userId: p.userId,
      today: localDateOf(now, p.timeZone, p.dayStartHour),
    })),
  )

  const candidates: RankCandidate[] = eligible.map((p) => ({
    userId: p.userId,
    nickname: p.nickname ?? '',
    avatar: p.avatar,
    streak: streaks.get(p.userId) ?? 0,
    checkins: byUser.get(p.userId) ?? [],
  }))
  return buildRankBoard({ range, from, to, candidates, meUserId: userId })
}

/**
 * 榜单动态：已上榜用户最近 24 小时的打卡事件（不含补卡：补卡的时刻是补记的，不是刚发生的事）。
 * 自己上榜时也会看到自己的动态。
 */
export async function getRankFeed(db: DbOrTx, now: Date): Promise<Feed> {
  const rows = await db
    .select({
      ...publicProfileColumns,
      checkinId: checkins.id,
      module: checkins.module,
      occurredAt: checkins.occurredAt,
    })
    .from(checkins)
    .innerJoin(profiles, eq(profiles.userId, checkins.userId))
    .innerJoin(user, eq(user.id, checkins.userId))
    .where(
      and(
        gte(checkins.occurredAt, feedSince(now)),
        lte(checkins.occurredAt, now),
        eq(checkins.isMakeup, false),
        eq(profiles.leaderboardOptIn, true),
        isNotNull(profiles.onboardedAt),
        isNotNull(profiles.nickname),
        notBannedAt(now),
      ),
    )
    .orderBy(desc(checkins.occurredAt))
    .limit(FEED_FETCH)
  return { items: shapeFeed(rows, now) }
}
