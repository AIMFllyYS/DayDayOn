import * as z from 'zod'
import {
  IdSchema,
  InstantSchema,
  MicrosSchema,
  offsetPage,
  UserIdSchema,
} from '@/features/shared/schemas'
import { RedeemCodeStatusSchema } from '@/features/quota/schemas'
import { RoleSchema } from '@/features/me/schemas'

/*
 * 后台契约（PRD 2.12、7.3）。D7 实现。
 * 封号 / 解封不在 /api/v1：前端调 authClient.admin.banUser / unbanUser（PRD 7.3）。
 * 全站配置的 schema 在 src/server/settings-schema.ts（AppSettingsSchema）。
 */

export const AnomalyKindSchema = z
  .enum(['user-daily-spend', 'user-hourly-calls', 'ip-multi-account', 'redeem-failures'])
  .meta({ id: 'AnomalyKind' })
export type AnomalyKind = z.infer<typeof AnomalyKindSchema>

export const AnomalySchema = z
  .object({
    kind: AnomalyKindSchema,
    /** 用户 id 或 IP */
    subject: z.string(),
    /** 昵称或邮箱，便于识别；IP 类为 null */
    label: z.string().nullable(),
    /** 触发值：金额（微元）、次数或账号数 */
    value: z.number(),
    detectedAt: InstantSchema,
  })
  .meta({ id: 'Anomaly' })
export type Anomaly = z.infer<typeof AnomalySchema>

/** GET /admin/overview */
export const AdminOverviewSchema = z
  .object({
    dayKey: z.string(),
    todaySpentMicros: MicrosSchema,
    dailySpendCapMicros: MicrosSchema,
    /** 手动暂停 */
    aiPaused: z.boolean(),
    /** 今日已达上限（实时判断） */
    capReached: z.boolean(),
    /** 近 30 天每日花费，按日期升序，没有花费的日子为 0 */
    spendSeries: z.array(z.object({ dayKey: z.string(), spentMicros: MicrosSchema })).max(31),
    anomalies: z.array(AnomalySchema),
  })
  .meta({ id: 'AdminOverview' })
export type AdminOverview = z.infer<typeof AdminOverviewSchema>

/** POST /admin/ai/pause、/admin/ai/resume 的响应 */
export const AiSwitchResultSchema = z
  .object({ aiPaused: z.boolean(), capReached: z.boolean() })
  .meta({ id: 'AiSwitchResult' })
export type AiSwitchResult = z.infer<typeof AiSwitchResultSchema>

export const UserStatusSchema = z.enum(['active', 'banned']).meta({ id: 'UserStatus' })

/** GET /admin/users 的一行 */
export const AdminUserRowSchema = z
  .object({
    userId: UserIdSchema,
    nickname: z.string().nullable(),
    email: z.string(),
    role: RoleSchema,
    createdAt: InstantSchema,
    signupIp: z.string().nullable(),
    /** 同注册 IP 的账号数（含自己） */
    sameIpCount: z.number().int().min(0),
    weekSpentMicros: MicrosSchema,
    /** 本周 AI 调用次数 */
    weekCalls: z.number().int().min(0),
    bonusMicros: MicrosSchema,
    status: UserStatusSchema,
    banReason: z.string().nullable(),
    banExpiresAt: InstantSchema.nullable(),
  })
  .meta({ id: 'AdminUserRow' })
export type AdminUserRow = z.infer<typeof AdminUserRowSchema>

export const AdminUserQuerySchema = z.object({
  /** 按邮箱搜索（包含匹配） */
  q: z.string().trim().max(100).optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type AdminUserQuery = z.infer<typeof AdminUserQuerySchema>

export const AdminUserPageSchema = offsetPage(AdminUserRowSchema).meta({ id: 'AdminUserPage' })
export type AdminUserPage = z.infer<typeof AdminUserPageSchema>

/** POST /admin/users/{userId}/quota-adjustments：加购余额 ± 金额 + 原因 */
export const QuotaAdjustmentSchema = z
  .object({
    amountMicros: z
      .number()
      .int()
      .refine((v) => v !== 0, { error: '调整金额不能为 0' })
      .refine((v) => Math.abs(v) <= 1_000_000_000, { error: '单次调整最多 1000 元' }),
    reason: z.string().trim().min(1, { error: '请写调整原因' }).max(200),
  })
  .meta({ id: 'QuotaAdjustment' })
export type QuotaAdjustment = z.infer<typeof QuotaAdjustmentSchema>

export const QuotaAdjustmentResultSchema = z
  .object({ userId: UserIdSchema, bonusMicros: MicrosSchema })
  .meta({ id: 'QuotaAdjustmentResult' })
export type QuotaAdjustmentResult = z.infer<typeof QuotaAdjustmentResultSchema>

export const AdminUserIdParamSchema = z.object({ userId: UserIdSchema })

/** GET /admin/redeem-codes 的一行 */
export const AdminCodeRowSchema = z
  .object({
    id: IdSchema,
    prefix: z.string(),
    valueMicros: MicrosSchema,
    status: RedeemCodeStatusSchema,
    createdAt: InstantSchema,
    redeemedBy: z
      .object({ userId: UserIdSchema, nickname: z.string().nullable(), email: z.string() })
      .nullable(),
    redeemedAt: InstantSchema.nullable(),
  })
  .meta({ id: 'AdminCodeRow' })
export type AdminCodeRow = z.infer<typeof AdminCodeRowSchema>

export const AdminCodeQuerySchema = z.object({
  status: RedeemCodeStatusSchema.optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type AdminCodeQuery = z.infer<typeof AdminCodeQuerySchema>

export const AdminCodePageSchema = offsetPage(AdminCodeRowSchema).meta({ id: 'AdminCodePage' })
export type AdminCodePage = z.infer<typeof AdminCodePageSchema>

/** POST /admin/redeem-codes：批量生成 1–100 个，面值 10 元 */
export const GenerateCodesSchema = z
  .object({
    count: z
      .number()
      .int()
      .min(1, { error: '至少生成 1 个' })
      .max(100, { error: '一次最多 100 个' }),
  })
  .meta({ id: 'GenerateCodes' })
export type GenerateCodes = z.infer<typeof GenerateCodesSchema>

/** 201：明文码只在这里出现一次，不落库 */
export const GeneratedCodesSchema = z
  .object({
    codes: z.array(z.object({ id: IdSchema, code: z.string() })),
    valueMicros: MicrosSchema,
  })
  .meta({ id: 'GeneratedCodes' })
export type GeneratedCodes = z.infer<typeof GeneratedCodesSchema>

export const AdminCodeIdParamSchema = z.object({ codeId: IdSchema })
