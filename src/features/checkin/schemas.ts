import * as z from 'zod'
import { FieldValueSchema, TargetSchema } from '@/features/goal/schemas'
import {
  cursorPage,
  IdSchema,
  InstantSchema,
  LocalDateSchema,
  ModuleSchema,
  MonthSchema,
  RatingValueSchema,
} from '@/features/shared/schemas'

/*
 * 打卡契约（PRD 2.4、3、7.2）。D3 实现；D2（详情页）、D4（主页）、D6（饮食确认）读取。
 * 非睡眠打卡的请求体不收 occurredAt：服务端取 now，补卡取昨天打卡日 12:00（PRD 7.2）。
 */

export const NOTE_MAX = 200

// ---------------------------------------------------------------------------
// 各板块的取值
// ---------------------------------------------------------------------------

export const EXERCISE_CATEGORIES = [
  '跑步',
  '快走',
  '骑行',
  '游泳',
  '跳绳',
  '球类',
  '力量',
  '瑜伽',
  '舞蹈',
  '其他',
] as const

export const IntensitySchema = z
  .enum(['easy', 'moderate', 'hard'], { error: '请选择强度' })
  .meta({ id: 'Intensity' })
export type Intensity = z.infer<typeof IntensitySchema>

export const MealTypeSchema = z
  .enum(['breakfast', 'lunch', 'dinner', 'snack'], { error: '请选择餐次' })
  .meta({ id: 'MealType' })
export type MealType = z.infer<typeof MealTypeSchema>

export const DietMethodSchema = z.enum(['photo', 'manual']).meta({ id: 'DietMethod' })
export type DietMethod = z.infer<typeof DietMethodSchema>

export const CheckinSourceSchema = z.enum(['manual', 'ai']).meta({ id: 'CheckinSource' })
export type CheckinSource = z.infer<typeof CheckinSourceSchema>

/** 运动时长 1–600 分钟 */
const ExerciseDurationSchema = z
  .number()
  .int()
  .min(60, { error: '时长至少 1 分钟' })
  .max(36_000, { error: '时长最多 600 分钟' })

export const DietItemSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: '请填写食物名称' })
      .max(30, { error: '名称最多 30 个字' }),
    portion: z.string().trim().max(30, { error: '份量最多 30 个字' }).default(''),
    /** 手动填写时可空 */
    kcal: z
      .number()
      .int({ error: '热量取整数千卡' })
      .min(0, { error: '热量不能是负数' })
      .max(5000, { error: '单条热量最多 5000 千卡' })
      .nullable(),
  })
  .meta({ id: 'DietItem' })
export type DietItem = z.infer<typeof DietItemSchema>

export const DietItemsSchema = z
  .array(DietItemSchema)
  .min(1, { error: '至少记一样食物' })
  .max(20, { error: '最多 20 条' })

// ---------------------------------------------------------------------------
// payload：存进 checkins.payload 的板块数据（jsonb）
// ---------------------------------------------------------------------------

export const ExercisePayloadSchema = z.object({
  module: z.literal('exercise'),
  /** 预设品类或用户新建的品类 */
  category: z
    .string()
    .trim()
    .min(1, { error: '请选择品类' })
    .max(10, { error: '品类最多 10 个字' }),
  intensity: IntensitySchema,
})

export const DietPayloadSchema = z.object({
  module: z.literal('diet'),
  method: DietMethodSchema,
  mealType: MealTypeSchema,
  items: DietItemsSchema,
})

export const SleepPayloadSchema = z.object({
  module: z.literal('sleep'),
  bedAt: InstantSchema,
  wakeAt: InstantSchema,
  quality: RatingValueSchema,
})

export const StudyPayloadSchema = z.object({
  module: z.literal('study'),
  what: z.string().trim().min(1, { error: '写一下学了什么' }).max(60, { error: '最多 60 个字' }),
})

export const CustomPayloadSchema = z.object({
  module: z.literal('custom'),
  /** 按 goal_field_versions 当时版本的 buildSchema(fields) 校验 */
  values: z.record(z.string(), FieldValueSchema),
})

export const CheckinPayloadSchema = z
  .discriminatedUnion('module', [
    ExercisePayloadSchema,
    DietPayloadSchema,
    SleepPayloadSchema,
    StudyPayloadSchema,
    CustomPayloadSchema,
  ])
  .meta({ id: 'CheckinPayload' })
export type CheckinPayload = z.infer<typeof CheckinPayloadSchema>

// ---------------------------------------------------------------------------
// 创建：POST /goals/{goalId}/checkins（带 idempotency-key）
// module 必须与目标的板块一致，否则 400 VALIDATION_FAILED
// ---------------------------------------------------------------------------

const CreateBase = {
  /** 补昨天（PRD 3）：只能补今天打卡日的前一天 */
  isMakeup: z.boolean().default(false),
  note: z
    .string()
    .trim()
    .max(NOTE_MAX, { error: `备注最多 ${NOTE_MAX} 个字` })
    .nullable()
    .optional(),
}

export const CreateExerciseCheckinSchema = z.object({
  ...CreateBase,
  module: z.literal('exercise'),
  category: ExercisePayloadSchema.shape.category,
  intensity: IntensitySchema,
  durationSeconds: ExerciseDurationSchema,
})

export const CreateDietCheckinSchema = z
  .object({
    ...CreateBase,
    module: z.literal('diet'),
    source: CheckinSourceSchema.default('manual'),
    /** source = 'ai' 时必填：识别接口返回的 aiRunId */
    aiRunId: IdSchema.optional(),
    /** AI 草稿的 summary，入库为 parsedText */
    parsedText: z.string().max(500).optional(),
    method: DietMethodSchema,
    mealType: MealTypeSchema,
    items: DietItemsSchema,
  })
  .refine((v) => (v.source === 'ai') === (v.aiRunId !== undefined), {
    error: 'AI 记录需要 aiRunId',
    path: ['aiRunId'],
  })

export const CreateSleepCheckinSchema = z
  .object({
    ...CreateBase,
    module: z.literal('sleep'),
    /** 前端用 sleepRange() 组合；服务端要求 wakeAt ≤ now 且落在今天（补卡为昨天）的打卡日 */
    bedAt: InstantSchema,
    wakeAt: InstantSchema,
    quality: RatingValueSchema,
  })
  .refine(
    (v) => {
      const secs = (Date.parse(v.wakeAt) - Date.parse(v.bedAt)) / 1000
      return secs >= 1800 && secs <= 72_000
    },
    { error: '睡眠时长应在 30 分钟到 20 小时之间', path: ['wakeAt'] },
  )

export const CreateStudyCheckinSchema = z.object({
  ...CreateBase,
  module: z.literal('study'),
  what: StudyPayloadSchema.shape.what,
  /** 可选 */
  durationSeconds: z.number().int().min(60).max(86_400).optional(),
})

export const CreateCustomCheckinSchema = z.object({
  ...CreateBase,
  module: z.literal('custom'),
  /** 提交时的字段版本；与当前版本不一致返回 400 */
  fieldVersion: z.number().int().min(1),
  values: z.record(z.string(), FieldValueSchema),
})

export const CreateCheckinSchema = z
  .discriminatedUnion('module', [
    CreateExerciseCheckinSchema,
    CreateDietCheckinSchema,
    CreateSleepCheckinSchema,
    CreateStudyCheckinSchema,
    CreateCustomCheckinSchema,
  ])
  .meta({ id: 'CreateCheckin' })
export type CreateCheckin = z.infer<typeof CreateCheckinSchema>
export type CreateCheckinInput = z.input<typeof CreateCheckinSchema>

/** PATCH /checkins/{checkinId}：只允许改饮食条目和备注（PRD 7.2），保留 parsedText */
export const UpdateCheckinSchema = z
  .object({
    items: DietItemsSchema,
    note: CreateBase.note,
  })
  .partial()
  .refine((p) => Object.keys(p).length > 0, { error: '没有要修改的内容' })
  .meta({ id: 'UpdateCheckin' })
export type UpdateCheckin = z.infer<typeof UpdateCheckinSchema>

// ---------------------------------------------------------------------------
// 读取
// ---------------------------------------------------------------------------

/** 一条打卡（历史列表项、创建响应） */
export const CheckinSchema = z
  .object({
    id: IdSchema,
    goalId: IdSchema,
    module: ModuleSchema,
    localDate: LocalDateSchema,
    occurredAt: InstantSchema,
    source: CheckinSourceSchema,
    isMakeup: z.boolean(),
    durationSeconds: z.number().int().nullable(),
    count: z.number().int(),
    intakeKcal: z.number().int().nullable(),
    /** 估算结果，非医疗建议 */
    burnKcal: z.number().int().nullable(),
    note: z.string().nullable(),
    parsedText: z.string().nullable(),
    payload: CheckinPayloadSchema,
    fieldVersion: z.number().int().nullable(),
    aiRunId: IdSchema.nullable(),
    createdAt: InstantSchema,
  })
  .meta({ id: 'Checkin' })
export type Checkin = z.infer<typeof CheckinSchema>

/** 某个目标某天的进度（stats.goalDayProgress 的返回） */
export const GoalProgressSchema = z
  .object({
    /** duration 为秒，count 为次 */
    value: z.number().int(),
    target: z.number().int(),
    done: z.boolean(),
  })
  .meta({ id: 'GoalProgress' })
export type GoalProgress = z.infer<typeof GoalProgressSchema>

/** 创建响应：记录 + 该目标今天（补卡时为昨天）的进度，用来显示盖章和进度 */
export const CreateCheckinResultSchema = z
  .object({ checkin: CheckinSchema, progress: GoalProgressSchema })
  .meta({ id: 'CreateCheckinResult' })
export type CreateCheckinResult = z.infer<typeof CreateCheckinResultSchema>

/** GET /goals/{goalId}/checkins：游标分页，可按打卡日范围筛选 */
export const CheckinHistoryQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  from: LocalDateSchema.optional(),
  to: LocalDateSchema.optional(),
})
export type CheckinHistoryQuery = z.infer<typeof CheckinHistoryQuerySchema>

export const CheckinHistorySchema = cursorPage(CheckinSchema).meta({ id: 'CheckinHistory' })
export type CheckinHistory = z.infer<typeof CheckinHistorySchema>

/** GET /goals/{goalId}/calendar?month=YYYY-MM */
export const CalendarQuerySchema = z.object({ month: MonthSchema })

export const CalendarDaySchema = z
  .object({
    localDate: LocalDateSchema,
    /** 当天打卡条数 */
    count: z.number().int().min(1),
    /** 当天是否达成目标量 */
    done: z.boolean(),
    /** 当天是否全部是补卡（日历用描边样式） */
    makeupOnly: z.boolean(),
  })
  .meta({ id: 'CalendarDay' })
export type CalendarDay = z.infer<typeof CalendarDaySchema>

export const CheckinCalendarSchema = z
  .object({
    month: MonthSchema,
    /** 只列出有打卡的日子 */
    days: z.array(CalendarDaySchema),
  })
  .meta({ id: 'CheckinCalendar' })
export type CheckinCalendar = z.infer<typeof CheckinCalendarSchema>

/** 打卡弹层的一行（也用于主页"今日进度"） */
export const TodayGoalSchema = z
  .object({
    goalId: IdSchema,
    module: ModuleSchema,
    title: z.string(),
    target: TargetSchema,
    /** 今天是否在计划星期里 */
    planned: z.boolean(),
    progress: GoalProgressSchema,
    sortOrder: z.number().int(),
  })
  .meta({ id: 'TodayGoal' })
export type TodayGoal = z.infer<typeof TodayGoalSchema>

/** GET /checkins/today：打卡弹层（PRD 2.4、7.2） */
export const CheckinTodaySchema = z
  .object({
    localDate: LocalDateSchema,
    /** 今天计划内的进行中目标，按 sortOrder */
    goals: z.array(TodayGoalSchema),
    /** "今天完成了 X / Y 个目标" */
    completion: z.object({ done: z.number().int(), planned: z.number().int() }),
    /** 今天的体重（克），没记为 null */
    weightGrams: z.number().int().nullable(),
    /** 今天的心情 1–5，没记为 null */
    mood: RatingValueSchema.nullable(),
    /** "拍照记一餐"直达的饮食目标（sortOrder 最小的进行中饮食目标），没有就 null */
    dietPhotoGoalId: IdSchema.nullable(),
  })
  .meta({ id: 'CheckinToday' })
export type CheckinToday = z.infer<typeof CheckinTodaySchema>

export const CheckinIdParamSchema = z.object({ checkinId: IdSchema })
