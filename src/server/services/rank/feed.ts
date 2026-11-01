import 'server-only'
import type { FeedItem } from '@/features/rank/schemas'
import type { Module } from '@/features/shared/schemas'
import { isRankEligible, type RankProfileFields } from './board'

/*
 * 榜单动态的纯规则（PRD 2.8 第 5 项）：只展示已上榜用户最近 24 小时的打卡事件，
 * 只含昵称、头像、板块和时间，不含任何数值和备注；最多 10 条；被封的人不出现。
 */

export const FEED_LIMIT = 10
export const FEED_WINDOW_MS = 24 * 60 * 60 * 1000

/** 查询得到的一行：打卡 + 发布者资料（只取需要的列） */
export interface FeedSourceRow extends RankProfileFields {
  checkinId: string
  userId: string
  avatar: string | null
  module: Module
  occurredAt: Date
}

/** 动态窗口的起点：now 往前 24 小时 */
export function feedSince(now: Date): Date {
  return new Date(now.getTime() - FEED_WINDOW_MS)
}

/**
 * 过滤 + 排序 + 截断 + 只留公开字段。
 * 查询已经按窗口和上榜过滤过，这里再判一次（封禁到期时间要和 now 比较），并防止未来时刻混入。
 */
export function shapeFeed(rows: readonly FeedSourceRow[], now: Date): FeedItem[] {
  const since = feedSince(now).getTime()
  const until = now.getTime()
  return rows
    .filter((r) => {
      const t = r.occurredAt.getTime()
      return t >= since && t <= until && isRankEligible(r, now)
    })
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, FEED_LIMIT)
    .map((r) => ({
      id: r.checkinId,
      userId: r.userId,
      // isRankEligible 已保证昵称非空
      nickname: r.nickname ?? '',
      avatar: r.avatar,
      module: r.module,
      occurredAt: r.occurredAt.toISOString(),
    }))
}
