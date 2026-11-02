import * as z from 'zod'
import { DashboardTodaySchema } from '@/features/dashboard/schemas'
import { InstantSchema, PublicUserSchema, RatingValueSchema } from '@/features/shared/schemas'

/*
 * 好友体系契约（ADR-0026）：
 * 1. 顶栏堆叠头像与好友列表（本人置顶 + 好友按添加时间排序，附今日完成度与连续打卡天数）
 * 2. 6 位 10 分钟持久化配对码（发起邀请 / 预览邀请人 / 接受邀请）
 * 3. 好友完整打卡仪表盘（完全透明公开，不可单向关闭）
 */

export const FriendSummarySchema = PublicUserSchema.extend({
  /** 连续打卡天数 */
  streak: z.number().int().min(0),
  /** 今日已完成目标数 */
  todayDone: z.number().int().min(0),
  /** 今日计划目标数 */
  todayPlanned: z.number().int().min(0),
  /** 今日心情评分（1–5，未记为 null） */
  todayMood: RatingValueSchema.nullable(),
  /** 成为好友的时间 */
  createdAt: InstantSchema,
}).meta({ id: 'FriendSummary' })
export type FriendSummary = z.infer<typeof FriendSummarySchema>

export const FriendListSchema = z
  .object({
    me: PublicUserSchema,
    friends: z.array(FriendSummarySchema),
  })
  .meta({ id: 'FriendList' })
export type FriendList = z.infer<typeof FriendListSchema>

export const FriendInviteCodeInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, { error: '请输入 6 位数字配对码' }),
  })
  .meta({ id: 'FriendInviteCodeInput' })
export type FriendInviteCodeInput = z.infer<typeof FriendInviteCodeInputSchema>

export const FriendInviteSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/),
    expiresAt: InstantSchema,
    serverNow: InstantSchema,
  })
  .meta({ id: 'FriendInvite' })
export type FriendInvite = z.infer<typeof FriendInviteSchema>

export const FriendInvitePreviewSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/),
    inviter: PublicUserSchema,
    expiresAt: InstantSchema,
  })
  .meta({ id: 'FriendInvitePreview' })
export type FriendInvitePreview = z.infer<typeof FriendInvitePreviewSchema>

export const FriendAcceptResultSchema = z
  .object({
    friend: FriendSummarySchema,
  })
  .meta({ id: 'FriendAcceptResult' })
export type FriendAcceptResult = z.infer<typeof FriendAcceptResultSchema>

export const FriendDashboardSchema = z
  .object({
    friend: FriendSummarySchema,
    dashboard: DashboardTodaySchema,
  })
  .meta({ id: 'FriendDashboard' })
export type FriendDashboard = z.infer<typeof FriendDashboardSchema>
