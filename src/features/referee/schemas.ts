import * as z from 'zod'
import { LocalTimeSchema, type Module } from '@/features/shared/schemas'

/*
 * Agent 裁判的契约（checkin-modules.md 第 3 节、ADR-0027）。前后端共用。
 * - RefereeRules：目标级阈值（goals.referee_rules），按板块判别；为空时用 DEFAULT_RULES。
 * - Facts：裁判需要、表单里没有的数，由 Agent 通过 submitVerdict 提交，离线时为空。
 * - Verdict：裁判结论，入库前由服务端用 rules/ 里的纯函数重算。
 * 本文件不 import features/checkin：方向只能是 checkin → referee。
 */

// ---------------------------------------------------------------------------
// 个人体质档位（profiles.referee_tier）
// ---------------------------------------------------------------------------

export const REFEREE_TIERS = ['strict-fat-loss', 'balanced-glycemic', 'gentle-gain'] as const
export const RefereeTierSchema = z.enum(REFEREE_TIERS).meta({ id: 'RefereeTier' })
export type RefereeTier = z.infer<typeof RefereeTierSchema>
export const DEFAULT_REFEREE_TIER: RefereeTier = 'balanced-glycemic'

// ---------------------------------------------------------------------------
// 目标规则（goals.referee_rules）
// ---------------------------------------------------------------------------

export const DietRulesSchema = z.object({
  module: z.literal('diet'),
  /** 高于这个分数才算有效（5 分制） */
  passScore: z.number().min(1).max(4.5).default(3),
})

export const ExerciseRulesSchema = z.object({
  module: z.literal('exercise'),
  /** 按时间 + 距离计量（跑、走、骑、游）：时长或距离任一达标 */
  distanceMinMinutes: z.number().int().min(1).max(300).default(20),
  distanceMinKm: z.number().min(0.1).max(100).default(2),
  /** 按时间 + 组数计量（力量、核心）：时长或组数任一达标 */
  countMinMinutes: z.number().int().min(1).max(300).default(15),
  countMinSets: z.number().int().min(1).max(50).default(4),
})

export const SleepRulesSchema = z
  .object({
    module: z.literal('sleep'),
    /** 最晚入睡时刻（HH:mm，中午前的时刻视为过了午夜） */
    bedtimeBy: LocalTimeSchema.default('23:30'),
    minHours: z.number().min(3).max(12).default(6.5),
    maxHours: z.number().min(4).max(14).default(9.5),
  })
  .refine((r) => r.minHours < r.maxHours, {
    error: '最短时长要小于最长时长',
    path: ['maxHours'],
  })

export const StudyRulesSchema = z.object({
  module: z.literal('study'),
  minFocusMinutes: z.number().int().min(1).max(240).default(25),
  /** 要点总字数下限：拦住只写「看了」的空内容 */
  minNoteChars: z.number().int().min(0).max(200).default(10),
})

export const CUSTOM_OPS = ['gte', 'lte', 'eq', 'filled'] as const
export const CustomOpSchema = z.enum(CUSTOM_OPS)
export type CustomOp = z.infer<typeof CustomOpSchema>

export const CustomConditionSchema = z.object({
  /** 对应自定义字段的 key */
  key: z.string().min(1).max(32),
  op: CustomOpSchema,
  /** 数字字段比较数值（时长按分钟），时间点字段比较 HH:mm；filled 不需要 */
  value: z.union([z.number(), LocalTimeSchema]).optional(),
})
export type CustomCondition = z.infer<typeof CustomConditionSchema>

export const CustomRulesSchema = z.object({
  module: z.literal('custom'),
  conditions: z.array(CustomConditionSchema).max(10).default([]),
  /** 交给 Agent 判卷的一句话标准，如「要写清练了哪首曲子的哪几个小节」 */
  aiCriteria: z.string().trim().max(120).optional(),
})

export const RefereeRulesSchema = z
  .discriminatedUnion('module', [
    DietRulesSchema,
    ExerciseRulesSchema,
    SleepRulesSchema,
    StudyRulesSchema,
    CustomRulesSchema,
  ])
  .meta({ id: 'RefereeRules' })
export type RefereeRules = z.infer<typeof RefereeRulesSchema>
export type RefereeRulesInput = z.input<typeof RefereeRulesSchema>
export type RulesOf<M extends Module> = Extract<RefereeRules, { module: M }>

// ---------------------------------------------------------------------------
// 事实（Agent 通过 submitVerdict 提交）
// ---------------------------------------------------------------------------

export const COOKING_METHODS = [
  'steamed',
  'boiled',
  'stir-fried',
  'braised',
  'fried',
  'grilled',
  'raw',
  'other',
] as const

export const DietDishFactSchema = z.object({
  name: z.string().trim().min(1).max(30),
  portion: z.string().trim().max(30).default(''),
  kcal: z.number().int().min(0).max(5000),
  proteinG: z.number().min(0).max(500),
  carbG: z.number().min(0).max(1000),
  fatG: z.number().min(0).max(500),
  fiberG: z.number().min(0).max(200),
  sodiumMg: z.number().int().min(0).max(20_000),
  /** 升糖指数，无碳水的菜填 0 */
  gi: z.number().int().min(0).max(120),
  /** 一票否决：油炸快餐、含糖饮料等超加工食物 */
  junk: z.boolean(),
  /** 甜点、冰淇淋这类解馋食物：按餐次轻扣或重扣 */
  sweet: z.boolean().default(false),
  /** 空腹 / 断食（不扣分且适当加分） */
  isFasting: z.boolean().optional(),
  /** 碳水质量：精米白面 refined / 土豆玉米粗粮 complex / 无主食碳水 none */
  carbQuality: z.enum(['refined', 'complex', 'none']).optional(),
  /** 油脂质量：坚果深海鱼牛油果等优质脂肪 healthy / 劣质反式油炸 unhealthy / 普通 normal */
  fatQuality: z.enum(['healthy', 'unhealthy', 'normal']).optional(),
  cooking: z.enum(COOKING_METHODS).default('other'),
  /** 数据来源：内置营养表 / 联网检索 / 模型估算 */
  source: z.enum(['table', 'web', 'estimate']).default('estimate'),
})
export type DietDishFact = z.infer<typeof DietDishFactSchema>

const SkipFactFields = {
  /** 用户在手动填写页填写「跳过本次打卡」理由时，Agent 核验理由是否合理充分 */
  skipApproved: z.boolean().optional(),
  /** Agent 对跳过理由的核验说明 */
  skipComment: z.string().trim().max(120).nullable().optional(),
}

export const DietFactsSchema = z.object({
  module: z.literal('diet'),
  dishes: z.array(DietDishFactSchema).min(1).max(20),
  ...SkipFactFields,
})

export const ExerciseItemFactSchema = z.object({
  name: z.string().trim().min(1).max(20),
  calc: z.enum(['distance', 'count']),
  minutes: z.number().min(0).max(600),
  km: z.number().min(0).max(300).nullable(),
  sets: z.number().int().min(0).max(200).nullable(),
  /** 代谢当量 */
  met: z.number().min(1).max(20),
  kcal: z.number().int().min(0).max(5000),
  /** 消耗来自手表 / App 截图，而不是估算 */
  fromDevice: z.boolean().default(false),
})
export type ExerciseItemFact = z.infer<typeof ExerciseItemFactSchema>

export const ExerciseFactsSchema = z.object({
  module: z.literal('exercise'),
  items: z.array(ExerciseItemFactSchema).min(1).max(10),
  /** 估算消耗用的体重；没有体重记录时按 60kg */
  weightKg: z.number().min(20).max(300).nullable(),
  ...SkipFactFields,
})

export const SleepFactsSchema = z.object({
  module: z.literal('sleep'),
  /** 最近几晚入睡时刻的平均偏差（分钟），越小越规律；没有历史为 null */
  regularityMinutes: z.number().min(0).max(720).nullable(),
  recentNights: z.number().int().min(0).max(14),
  ...SkipFactFields,
})

export const StudyFactsSchema = z.object({
  module: z.literal('study'),
  /** 要点是否有实质内容（不是乱码、重复字符或一句空话） */
  substantive: z.boolean(),
  subject: z.string().trim().max(30),
  summary: z.string().trim().max(120),
  keyPoints: z.array(z.string().trim().min(1).max(60)).max(5).default([]),
  /** 今天这个目标之前已经记过的学习分钟数（碎片累加） */
  todayMinutesBefore: z.number().int().min(0).max(1440).default(0),
  ...SkipFactFields,
})

export const CustomFactsSchema = z.object({
  module: z.literal('custom'),
  /** 按 aiCriteria 判卷的结果；没有 aiCriteria 时为 null */
  aiPass: z.boolean().nullable(),
  aiComment: z.string().trim().max(120).nullable(),
  ...SkipFactFields,
})

export const FactsSchema = z
  .discriminatedUnion('module', [
    DietFactsSchema,
    ExerciseFactsSchema,
    SleepFactsSchema,
    StudyFactsSchema,
    CustomFactsSchema,
  ])
  .meta({ id: 'RefereeFacts' })
export type Facts = z.infer<typeof FactsSchema>
export type FactsOf<M extends Module> = Extract<Facts, { module: M }>

// ---------------------------------------------------------------------------
// 裁判结论（checkins.verdict）
// ---------------------------------------------------------------------------

export const CheckSchema = z.object({
  id: z.string(),
  text: z.string(),
  ok: z.boolean(),
  /** 依据来源，例如「《中国居民膳食指南（2022）》」 */
  source: z.string().optional(),
})
export type Check = z.infer<typeof CheckSchema>

export const CitationSchema = z.object({
  title: z.string().max(120),
  url: z.string().max(2048),
})
export type Citation = z.infer<typeof CitationSchema>

export const VerdictSchema = z
  .object({
    version: z.literal(1),
    isValid: z.boolean(),
    /** 只有评分制板块（饮食）有 */
    score: z.number().min(0).max(5).nullable(),
    scoreMax: z.number().nullable(),
    detail: z.string(),
    checks: z.array(CheckSchema),
    /** 报告用的数，键由板块自己定 */
    metrics: z.record(z.string(), z.union([z.number(), z.string(), z.null()])),
    facts: FactsSchema.nullable(),
    citations: z.array(CitationSchema).max(10),
    advice: z.array(z.string()).max(3),
    /** 裁判那次 ai_runs.id；离线判定为 null */
    refereeRunId: z.string().nullable(),
    /** 没经过 Agent，只按规则判定 */
    offline: z.boolean(),
  })
  .meta({ id: 'Verdict' })
export type Verdict = z.infer<typeof VerdictSchema>
