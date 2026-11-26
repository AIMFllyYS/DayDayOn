import * as z from 'zod'
import {
  cursorPage,
  InstantSchema,
  LocalDateSchema,
  MonthSchema,
  RatingScopeSchema,
  RatingValueSchema,
} from '@/features/shared/schemas'

/*
 * 每日指标契约：体重、满意度/心情、步数（PRD 2.5、7.2，Issue #57、#104）。
 * 体重永远不公开、不参与排行；写操作统一支持今日或昨日覆盖写。
 */

export const METRIC_KINDS = ['weight', 'mood', 'steps'] as const
export const MetricKindSchema = z
  .enum(METRIC_KINDS, { error: '指标类型不存在' })
  .meta({ id: 'MetricKind' })
export type MetricKind = z.infer<typeof MetricKindSchema>

export const WEIGHT_MIN_GRAMS = 20_000
export const WEIGHT_MAX_GRAMS = 300_000
/** 与上一条相差超过 3 kg 需要确认 */
export const WEIGHT_CONFIRM_DELTA_GRAMS = 3_000

export const WeightGramsSchema = z
  .number()
  .int({ error: '体重按整克记录' })
  .min(WEIGHT_MIN_GRAMS, { error: '体重应在 20–300 千克之间' })
  .max(WEIGHT_MAX_GRAMS, { error: '体重应在 20–300 千克之间' })

/** PUT /metrics/weight：记今天或昨天的体重，同一天再记就覆盖 */
export const PutWeightSchema = z
  .object({
    weightGrams: WeightGramsSchema,
    /** 409 WEIGHT_CHANGE_UNCONFIRMED 后用户确认，带 true 重提 */
    confirmLargeChange: z.boolean().default(false),
    /** 目标打卡日 YYYY-MM-DD；不传默认今天，传入时仅允许今天或昨天 */
    localDate: LocalDateSchema.optional(),
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

/** PUT /ratings：评今天或昨天；同一天同一 scope 再评就覆盖 */
export const PutRatingSchema = z
  .object({
    scope: RatingScopeSchema,
    value: RatingValueSchema,
    /** 目标打卡日 YYYY-MM-DD；不传默认今天，传入时仅允许今天或昨天 */
    localDate: LocalDateSchema.optional(),
  })
  .meta({ id: 'PutRating' })
export type PutRating = z.infer<typeof PutRatingSchema>

export const RatingSchema = z
  .object({ localDate: LocalDateSchema, scope: RatingScopeSchema, value: RatingValueSchema })
  .meta({ id: 'Rating' })
export type Rating = z.infer<typeof RatingSchema>

export const RatingEntrySchema = z
  .object({ localDate: LocalDateSchema, value: RatingValueSchema })
  .meta({ id: 'RatingEntry' })
export type RatingEntry = z.infer<typeof RatingEntrySchema>

/** GET /ratings?scope=overall&days=365 */
export const RatingTrendQuerySchema = z.object({
  scope: RatingScopeSchema.default('overall'),
  days: z.coerce.number().int().min(1).max(365).default(365),
})

export const RatingTrendSchema = z
  .object({
    scope: RatingScopeSchema,
    /** 按日期升序，只有记录过的日子 */
    entries: z.array(RatingEntrySchema),
    /** 窗口内最近一次评分 */
    latest: RatingEntrySchema.nullable(),
    /** 窗口内平均分（保留 1 位小数），无记录时为 null */
    average: z.number().nullable(),
    /** 窗口内已记录天数 */
    count: z.number().int().min(0),
  })
  .meta({ id: 'RatingTrend' })
export type RatingTrend = z.infer<typeof RatingTrendSchema>

// ---------------------------------------------------------------------------
// 每日步数（Issue #57）：与体重同构，无记录或纯网页端固定返回 todaySteps = 0
// ---------------------------------------------------------------------------

export const STEPS_MIN = 0
export const STEPS_MAX = 200_000
export const DEFAULT_DAILY_STEP_TARGET = 8_000
export const DAILY_STEP_TARGET_MIN = 1_000
export const DAILY_STEP_TARGET_MAX = 100_000

export const StepsCountSchema = z
  .number()
  .int({ error: '步数按整数记录' })
  .min(STEPS_MIN, { error: '步数不能小于 0' })
  .max(STEPS_MAX, { error: '单日步数不能超过 200,000 步' })

export const DailyStepTargetSchema = z
  .number()
  .int({ error: '步数参考线按整数设置' })
  .min(DAILY_STEP_TARGET_MIN, { error: '步数参考线应在 1,000–100,000 步之间' })
  .max(DAILY_STEP_TARGET_MAX, { error: '步数参考线应在 1,000–100,000 步之间' })

/** PUT /metrics/steps：记录或同步今天/昨天的步数，同一天再记覆盖 */
export const PutStepsSchema = z
  .object({
    steps: StepsCountSchema,
    /** 目标打卡日 YYYY-MM-DD；不传默认今天，传入时仅允许今天或昨天 */
    localDate: LocalDateSchema.optional(),
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

// ---------------------------------------------------------------------------
// 删除、分页历史与月度日历（/metrics/[metric] 双 Tab 详情页 + Agent 今日/昨日 CRUD）
// ---------------------------------------------------------------------------

export const MetricDateParamSchema = z.object({ localDate: LocalDateSchema })
export const MetricKindParamSchema = z.object({ kind: MetricKindSchema })

export const MetricOriginSchema = z.enum(['manual', 'agent']).default('manual')
export type MetricOrigin = z.infer<typeof MetricOriginSchema>

export const DeleteMetricQuerySchema = z.object({
  origin: MetricOriginSchema,
})

export const DeleteRatingQuerySchema = z.object({
  scope: RatingScopeSchema.default('overall'),
  origin: MetricOriginSchema,
})

export const MetricHistoryQuerySchema = z.object({
  /** 游标即上一页最后一条的 localDate（YYYY-MM-DD），因为每日指标按 (userId, localDate) 唯一 */
  cursor: LocalDateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
})
export type MetricHistoryQuery = z.infer<typeof MetricHistoryQuerySchema>

export const MetricHistoryItemSchema = z
  .object({
    kind: MetricKindSchema,
    localDate: LocalDateSchema,
    /** weight = 克，mood = 1..5，steps = 步数 */
    value: z.number().int(),
    /** weight / steps 的记录时刻；mood 无独立时刻为 null */
    measuredAt: InstantSchema.nullable(),
  })
  .meta({ id: 'MetricHistoryItem' })
export type MetricHistoryItem = z.infer<typeof MetricHistoryItemSchema>

export const MetricHistorySchema = cursorPage(MetricHistoryItemSchema).meta({
  id: 'MetricHistory',
})
export type MetricHistory = z.infer<typeof MetricHistorySchema>

export const MetricCalendarQuerySchema = z.object({ month: MonthSchema })

export const MetricCalendarDaySchema = z
  .object({
    localDate: LocalDateSchema,
    value: z.number().int(),
  })
  .meta({ id: 'MetricCalendarDay' })
export type MetricCalendarDay = z.infer<typeof MetricCalendarDaySchema>

export const MetricCalendarSchema = z
  .object({
    kind: MetricKindSchema,
    month: MonthSchema,
    days: z.array(MetricCalendarDaySchema),
  })
  .meta({ id: 'MetricCalendar' })
export type MetricCalendar = z.infer<typeof MetricCalendarSchema>
