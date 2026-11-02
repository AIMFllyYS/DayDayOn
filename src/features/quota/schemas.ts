import * as z from 'zod'
import { IdSchema, InstantSchema, MicrosSchema } from '@/features/shared/schemas'

/*
 * AI 额度、调用记录、兑换码契约（PRD 2.7、7.3，ADR-0002 第 5 节）。
 * D6 实现 /me/quota、/me/ai-runs、/redeem-codes/redeem；P1 实现账本。
 */

/** AI 用途：每个用途一个 prompt 文件（src/server/ai/prompts/<purpose>.ts）。agent-chat 走 ToolLoopAgent 流式对话 */
export const AI_PURPOSES = ['diet-recognition', 'agent-chat'] as const
export const AiPurposeSchema = z.enum(AI_PURPOSES).meta({ id: 'AiPurpose' })
export type AiPurpose = z.infer<typeof AiPurposeSchema>

export const AiRunStatusSchema = z
  .enum(['running', 'succeeded', 'failed', 'invalid-output', 'timeout'])
  .meta({ id: 'AiRunStatus' })
export type AiRunStatus = z.infer<typeof AiRunStatusSchema>

export const LedgerKindSchema = z.enum([
  'reserve',
  'settle',
  'release',
  'reset',
  'redeem',
  'adjust',
  'grant',
])
export type LedgerKind = z.infer<typeof LedgerKindSchema>

export const LedgerBucketSchema = z.enum(['weekly', 'bonus'])
export type LedgerBucket = z.infer<typeof LedgerBucketSchema>

export const RedeemCodeStatusSchema = z
  .enum(['unused', 'redeemed', 'void'])
  .meta({ id: 'RedeemCodeStatus' })
export type RedeemCodeStatus = z.infer<typeof RedeemCodeStatusSchema>

/** GET /me/quota */
export const QuotaViewSchema = z
  .object({
    /** 北京时间 ISO 周键 */
    periodKey: z.string(),
    weeklyLimitMicros: MicrosSchema,
    weeklyUsedMicros: MicrosSchema,
    /** 本周剩余 = limit - used - 已预占中属于本周的部分，不小于 0 */
    weeklyRemainingMicros: MicrosSchema,
    bonusMicros: MicrosSchema,
    reservedMicros: MicrosSchema,
    /** 本周期结束（下周一 00:00 北京时间）的时刻 */
    periodEndsAt: InstantSchema,
    /** 全站 AI 是否处于暂停或达到日上限状态（前端拍照界面提前提示降级） */
    aiPaused: z.boolean().optional(),
  })
  .meta({ id: 'QuotaView' })
export type QuotaView = z.infer<typeof QuotaViewSchema>

/** GET /me/ai-runs：最近 20 次 */
export const AiRunItemSchema = z
  .object({
    id: IdSchema,
    purpose: AiPurposeSchema,
    status: AiRunStatusSchema,
    costMicros: MicrosSchema,
    createdAt: InstantSchema,
  })
  .meta({ id: 'AiRunItem' })
export type AiRunItem = z.infer<typeof AiRunItemSchema>

export const AiRunListSchema = z
  .object({ items: z.array(AiRunItemSchema).max(20) })
  .meta({ id: 'AiRunList' })
export type AiRunList = z.infer<typeof AiRunListSchema>

/** 兑换码明文：DDON-XXXX-XXXX-XXXX；服务端用 normalizeCode() 规范化，这里只做长度兜底 */
export const RedeemCodeInputSchema = z
  .string()
  .trim()
  .min(1, { error: '请输入兑换码' })
  .max(40, { error: '兑换码格式不对' })

/** POST /redeem-codes/redeem（带 idempotency-key） */
export const RedeemSchema = z.object({ code: RedeemCodeInputSchema }).meta({ id: 'Redeem' })
export type Redeem = z.infer<typeof RedeemSchema>

export const RedeemResultSchema = z
  .object({ addedMicros: MicrosSchema, quota: QuotaViewSchema })
  .meta({ id: 'RedeemResult' })
export type RedeemResult = z.infer<typeof RedeemResultSchema>
