import 'server-only'
import { and, gte, inArray, lte } from 'drizzle-orm'
import type { LocalDate } from '@/features/shared/schemas'
import { addDays, compareLocalDate, daysBetween } from '@/lib/time'
import type { DbOrTx } from '@/server/db/client'
import { checkins } from '@/server/db/schema'
import { computeStreak } from '@/server/services/stats'

/*
 * 连续天数的批量读取（PRD 3「连续天数」，含补卡）：主页取自己的，排行取所有上榜用户的。
 * 只读最近一段窗口内的打卡日；连续天数顶到窗口边上的人，把窗口加倍再读一次，结果总是准确的。
 */

/** 首次读取的窗口（天）；一般人的连续天数远小于它 */
const INITIAL_WINDOW_DAYS = 120
/** 安全上限：约 30 年，防止数据异常时无限循环 */
const MAX_WINDOW_DAYS = 120 * 2 ** 7

export interface StreakSubject {
  userId: string
  /** 该用户今天的打卡日（按他自己的时区和日切换时间） */
  today: LocalDate
}

/**
 * 连续天数是否已经数到了窗口起点：是的话窗口外可能还有，需要扩大窗口。
 * streak 从 today（或昨天）往回数，最早一天 = 起点日 − (streak − 1)。
 */
export function streakReachesWindow(
  streak: number,
  dates: ReadonlySet<LocalDate>,
  today: LocalDate,
  windowStart: LocalDate,
): boolean {
  if (streak === 0) return false
  const first = dates.has(today) ? today : addDays(today, -1)
  const earliest = addDays(first, -(streak - 1))
  return compareLocalDate(earliest, windowStart) <= 0
}

/** 一批用户的连续天数：userId → streak。subjects 为空返回空 Map */
export async function loadStreaks(
  db: DbOrTx,
  subjects: readonly StreakSubject[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  let pending = [...subjects]
  let window = INITIAL_WINDOW_DAYS
  while (pending.length > 0) {
    const latestToday = pending.reduce(
      (max, s) => (compareLocalDate(s.today, max) > 0 ? s.today : max),
      pending[0]?.today ?? '',
    )
    const earliestToday = pending.reduce(
      (min, s) => (compareLocalDate(s.today, min) < 0 ? s.today : min),
      latestToday,
    )
    const from = addDays(earliestToday, -window)
    const rows = await db
      .selectDistinct({ userId: checkins.userId, localDate: checkins.localDate })
      .from(checkins)
      .where(
        and(
          inArray(
            checkins.userId,
            pending.map((s) => s.userId),
          ),
          gte(checkins.localDate, from),
          lte(checkins.localDate, latestToday),
        ),
      )
      // 每人每天最多一行：人数 × (窗口天数 + 时区差)
      .limit(pending.length * (window + daysBetween(earliestToday, latestToday) + 2))

    const byUser = new Map<string, Set<LocalDate>>()
    for (const r of rows) {
      let set = byUser.get(r.userId)
      if (!set) byUser.set(r.userId, (set = new Set()))
      set.add(r.localDate)
    }

    const next: StreakSubject[] = []
    for (const s of pending) {
      const dates = byUser.get(s.userId) ?? new Set<LocalDate>()
      const streak = computeStreak([...dates], s.today)
      const ownStart = addDays(s.today, -window)
      if (window < MAX_WINDOW_DAYS && streakReachesWindow(streak, dates, s.today, ownStart)) {
        next.push(s)
      } else {
        result.set(s.userId, streak)
      }
    }
    pending = next
    window *= 2
  }
  return result
}

/** 单个用户的连续天数 */
export async function loadStreak(db: DbOrTx, userId: string, today: LocalDate): Promise<number> {
  const map = await loadStreaks(db, [{ userId, today }])
  return map.get(userId) ?? 0
}
