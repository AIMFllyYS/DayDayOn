import * as z from 'zod'
import { InstantSchema, ModuleSchema, PublicUserSchema } from '@/features/shared/schemas'

/*
 * 排行榜与榜单动态契约（PRD 2.8 第 5 项、2.9、7.2）。D4 实现。
 * 只显示昵称、头像、打卡天数、连续天数；体重、饮食、睡眠的数值一律不出现。
 */

export const RankRangeSchema = z.enum(['week', 'month']).meta({ id: 'RankRange' })
export type RankRange = z.infer<typeof RankRangeSchema>

/** 接口收到非法值返回 400（页面的查询参数才静默回落到 week） */
export const RankQuerySchema = z.object({ range: RankRangeSchema.default('week') })

export const RankEntrySchema = PublicUserSchema.extend({
  rank: z.number().int().min(1),
  /** 范围内有非补卡打卡的打卡日数（stats.countRankDays） */
  days: z.number().int().min(0),
  streak: z.number().int().min(0),
}).meta({ id: 'RankEntry' })
export type RankEntry = z.infer<typeof RankEntrySchema>

export const RankMeSchema = z
  .discriminatedUnion('optedIn', [
    z.object({ optedIn: z.literal(false) }),
    z.object({
      optedIn: z.literal(true),
      entry: RankEntrySchema,
      /** "再打卡 N 天追上前一名"；第一名或并列时为 null */
      daysToNext: z.number().int().min(1).nullable(),
    }),
  ])
  .meta({ id: 'RankMe' })
export type RankMe = z.infer<typeof RankMeSchema>

export const RankBoardSchema = z
  .object({
    range: RankRangeSchema,
    /** 北京时间的起止日期（含） */
    from: z.iso.date(),
    to: z.iso.date(),
    /** 最多 50 名，前三名由前端放领奖台 */
    entries: z.array(RankEntrySchema).max(50),
    me: RankMeSchema,
  })
  .meta({ id: 'RankBoard' })
export type RankBoard = z.infer<typeof RankBoardSchema>

/** 榜单动态一条："阿柚 · 完成了运动 · 07:42"。不含任何数值和备注 */
export const FeedItemSchema = PublicUserSchema.extend({
  /** 用 checkinId 作为稳定 key */
  id: z.uuid(),
  module: ModuleSchema,
  occurredAt: InstantSchema,
}).meta({ id: 'FeedItem' })
export type FeedItem = z.infer<typeof FeedItemSchema>

/** GET /rank/feed */
export const FeedSchema = z.object({ items: z.array(FeedItemSchema).max(10) }).meta({ id: 'Feed' })
export type Feed = z.infer<typeof FeedSchema>
