import 'server-only'
import type { RankBoard, RankEntry, RankMe, RankRange } from '@/features/rank/schemas'
import type { LocalDate, PublicUser } from '@/features/shared/schemas'
import { isBanned } from '@/server/auth/guards'
import { countRankDays, type StatCheckin } from '@/server/services/stats'

/*
 * 排行榜的纯规则（PRD 2.9、3、7.2）：资格、计分、并列排序、"再打卡 N 天追上前一名"。
 * 不碰数据库、不读当前时间；查询在 ./index.ts。
 */

export const RANK_TOP_N = 50

/** 排行与动态的参与资格：已上榜、已完成引导、有昵称、未被封（PRD 2.9、3「被封用户」） */
export interface RankProfileFields {
  leaderboardOptIn: boolean
  onboardedAt: Date | null
  nickname: string | null
  banned: boolean | null
  banExpires: Date | null
}

export function isRankEligible(p: RankProfileFields, now: Date): boolean {
  if (!p.leaderboardOptIn || p.onboardedAt === null) return false
  if (p.nickname === null || p.nickname.length === 0) return false
  return !isBanned({ banned: p.banned, banExpires: p.banExpires }, now)
}

/** 某用户在范围内的打卡（按 userId、localDate、isMakeup 聚合后的行也可以，countRankDays 会去重） */
export type RankCheckin = Pick<StatCheckin, 'localDate' | 'isMakeup' | 'occurredAt'>

export interface RankCandidate extends PublicUser {
  streak: number
  /** 只含范围内（localDate 落在 from..to）的打卡 */
  checkins: readonly RankCheckin[]
}

export interface RankRow extends PublicUser {
  days: number
  streak: number
  /** 范围内最后一次非补卡打卡的时刻（ISO）；没有为 null */
  lastCheckinAt: string | null
}

export function toRankRow(c: RankCandidate): RankRow {
  let last: string | null = null
  for (const row of c.checkins) {
    if (row.isMakeup) continue
    if (last === null || Date.parse(row.occurredAt) > Date.parse(last)) last = row.occurredAt
  }
  return {
    userId: c.userId,
    nickname: c.nickname,
    avatar: c.avatar,
    days: countRankDays(c.checkins),
    streak: c.streak,
    lastCheckinAt: last,
  }
}

/**
 * 排序：打卡天数降序 → 连续天数降序 → 最后一次打卡时间升序（先到先得，没有打卡的排后）→ userId（稳定）。
 */
export function compareRankRows(a: RankRow, b: RankRow): number {
  if (a.days !== b.days) return b.days - a.days
  if (a.streak !== b.streak) return b.streak - a.streak
  if (a.lastCheckinAt !== b.lastCheckinAt) {
    if (a.lastCheckinAt === null) return 1
    if (b.lastCheckinAt === null) return -1
    const diff = Date.parse(a.lastCheckinAt) - Date.parse(b.lastCheckinAt)
    if (diff !== 0) return diff
  }
  return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0
}

/** 排好序并编号：rank 就是名次（并列已经由上面的规则分出先后） */
export function rankEntries(rows: readonly RankRow[]): RankEntry[] {
  return [...rows].sort(compareRankRows).map((r, i) => ({
    userId: r.userId,
    nickname: r.nickname,
    avatar: r.avatar,
    rank: i + 1,
    days: r.days,
    streak: r.streak,
  }))
}

/**
 * "再打卡 N 天追上前一名"：和前一名差几个打卡天数。
 * 第一名、或天数和前一名一样（只是并列规则排在后面）时为 null。
 */
export function daysToNext(sorted: readonly RankEntry[], index: number): number | null {
  const me = sorted[index]
  const prev = sorted[index - 1]
  if (me === undefined || prev === undefined) return null
  const gap = prev.days - me.days
  return gap >= 1 ? gap : null
}

export interface BuildRankBoardInput {
  range: RankRange
  from: LocalDate
  to: LocalDate
  candidates: readonly RankCandidate[]
  /** 当前用户 id；不在 candidates 里表示没上榜 */
  meUserId: string
}

export function buildRankBoard(input: BuildRankBoardInput): RankBoard {
  const sorted = rankEntries(input.candidates.map(toRankRow))
  const meIndex = sorted.findIndex((e) => e.userId === input.meUserId)
  const meEntry = sorted[meIndex]
  const me: RankMe =
    meEntry === undefined
      ? { optedIn: false }
      : { optedIn: true, entry: meEntry, daysToNext: daysToNext(sorted, meIndex) }
  return {
    range: input.range,
    from: input.from,
    to: input.to,
    entries: sorted.slice(0, RANK_TOP_N),
    me,
  }
}
