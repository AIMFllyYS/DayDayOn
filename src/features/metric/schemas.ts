import * as z from 'zod'
import {
  InstantSchema,
  LocalDateSchema,
  RatingScopeSchema,
  RatingValueSchema,
} from '@/features/shared/schemas'

/*
 * 每日指标契约：体重、满意度（PRD 2.5、7.2）。D3 实现，D1（引导写体重）、D4（主页卡片）读取。
 * 体重永远不公开、不参与排行。
 */

export const WEIGHT_MIN_GRAMS = 20_000
export const WEIGHT_MAX_GRAMS = 300_000
/** 与上一条相差超过 3 kg 需要确认 */
export const WEIGHT_CONFIRM_DELTA_GRAMS = 3_000

export const WeightGramsSchema = z
  .number()
  .int({ error: '体重按整克记录' })
  .min(WEIGHT_MIN_GRAMS, { error: '体重应在 20–300 千克之间' })
  .max(WEIGHT_MAX_GRAMS, { error: '体重应在 20–300 千克之间' })

/** PUT /metrics/weight：记今天的体重，再记就覆盖 */
export const PutWeightSchema = z
  .object({
    weightGrams: WeightGramsSchema,
    /** 409 WEIGHT_CHANGE_UNCONFIRMED 后用户确认，带 true 重提 */
    confirmLargeChange: z.boolean().default(false),
  })
  .meta({ id: 'PutWeight' })
export type PutWeight = z.infer<typeof PutWeightSchema>

export const WeightEntrySchema = z
  .object({
    localDate: LocalDateSchema,
    weightGrams: z.number().int(),
    measuredAt: InstantSchema,
  })
  .meta({ id: 'WeightEntry' })
export type WeightEntry = z.infer<typeof WeightEntrySchema>

/** GET /metrics/weight?days=30 */
export const WeightTrendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
})

export const WeightTrendSchema = z
  .object({
    /** 按日期升序，只有记录过的日子 */
    entries: z.array(WeightEntrySchema),
    /** 今天（或最近一次）的体重 */
    latest: WeightEntrySchema.nullable(),
    /** 和 7 天前（含之前最近一条）的差值，克；没有可比的记录为 null */
    deltaGrams7d: z.number().int().nullable(),
  })
  .meta({ id: 'WeightTrend' })
export type WeightTrend = z.infer<typeof WeightTrendSchema>

/** 409 WEIGHT_CHANGE_UNCONFIRMED 的额外字段 */
export const WeightChangeUnconfirmedSchema = z.object({ previousWeightGrams: z.number().int() })

/** PUT /ratings：只能评今天；同一天同一 scope 再评就覆盖 */
export const PutRatingSchema = z
  .object({ scope: RatingScopeSchema, value: RatingValueSchema })
  .meta({ id: 'PutRating' })
export type PutRating = z.infer<typeof PutRatingSchema>

export const RatingSchema = z
  .object({ localDate: LocalDateSchema, scope: RatingScopeSchema, value: RatingValueSchema })
  .meta({ id: 'Rating' })
export type Rating = z.infer<typeof RatingSchema>

// ---------------------------------------------------------------------------
// 每日步数（Issue #57）：与体重同构，无记录或纯网页端固定返回 todaySteps = 0
// ---------------------------------------------------------------------------

export const STEPS_MIN = 0
export const STEPS_MAX = 200_000

export const StepsCountSchema = z
  .number()
  .int({ error: '步数按整数记录' })
  .min(STEPS_MIN, { error: '步数不能小于 0' })
  .max(STEPS_MAX, { error: '单日步数不能超过 200,000 步' })

/** PUT /metrics/steps：记录或同步今天的步数，同一天再记覆盖 */
export const PutStepsSchema = z
  .object({
    steps: StepsCountSchema,
  })
  .meta({ id: 'PutSteps' })
export type PutSteps = z.infer<typeof PutStepsSchema>

export const StepEntrySchema = z
  .object({
    localDate: LocalDateSchema,
    steps: z.number().int().min(0),
    measuredAt: InstantSchema,
  })
  .meta({ id: 'StepEntry' })
export type StepEntry = z.infer<typeof StepEntrySchema>

export const StepTrendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
})

export const StepTrendSchema = z
  .object({
    /** 今天的步数；未下载手机端或今天还没记录时固定为 0，绝不为空或报错 */
    todaySteps: z.number().int().min(0),
    /** 按日期升序，记录过的日子 */
    entries: z.array(StepEntrySchema),
    /** 最近一次记录（可为 null） */
    latest: StepEntrySchema.nullable(),
    /** 和 7 天前（含之前最近一条）的步数差值；没有可比记录为 null */
    deltaSteps7d: z.number().int().nullable(),
  })
  .meta({ id: 'StepTrend' })
export type StepTrend = z.infer<typeof StepTrendSchema>
