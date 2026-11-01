import * as z from 'zod'
import {
  ALL_WEEKDAYS,
  IdSchema,
  InstantSchema,
  LocalDateSchema,
  LocalTimeSchema,
  ModuleSchema,
  WeekdaysSchema,
  type Module,
} from '../shared/schemas'

/*
 * 目标契约（PRD 2.3、7.2）。前后端共用；D2 实现接口，D1 引导、D3 打卡读取。
 */

export const GOAL_TITLE_MAX = 20
export const GOAL_DESCRIPTION_MAX = 100
export const GOAL_ACTIVE_LIMIT = 20
export const GOAL_FIELDS_MAX = 10

// ---------------------------------------------------------------------------
// 每日目标量
// ---------------------------------------------------------------------------

export const TargetKindSchema = z.enum(['duration', 'count']).meta({ id: 'TargetKind' })
export type TargetKind = z.infer<typeof TargetKindSchema>

/** duration：秒；count：次 */
export const TargetSchema = z
  .object({
    kind: TargetKindSchema,
    value: z
      .number()
      .int()
      .min(1, { error: '目标量至少为 1' })
      .max(86_400, { error: '目标量太大了' }),
  })
  .meta({ id: 'Target' })
export type Target = z.infer<typeof TargetSchema>

/**
 * 各板块可选的目标量类型。按时长只给打卡带时长的板块（运动、学习、睡眠）：
 * 饮食和自定义的打卡不记时长，按时长的目标永远是 0（stats.goalDayProgress）。
 */
export const TARGET_KINDS_BY_MODULE: Record<Module, readonly TargetKind[]> = {
  exercise: ['duration', 'count'],
  study: ['duration', 'count'],
  sleep: ['duration'],
  diet: ['count'],
  custom: ['count'],
}

/** 该板块是否允许这种目标量类型 */
export function isTargetKindAllowed(module: Module, kind: TargetKind): boolean {
  return TARGET_KINDS_BY_MODULE[module].includes(kind)
}

/** 目标量类型不被允许时的提示 */
export function targetKindError(module: Module): string {
  return module === 'sleep' ? '睡眠目标按时长计' : '这个板块的目标按次数计'
}

/** 某天生效的目标量与计划星期（goal_targets 一行，统计用） */
export const TargetOnDaySchema = z.object({
  kind: TargetKindSchema,
  value: z.number().int().min(1),
  weekdays: WeekdaysSchema,
})
export type TargetOnDay = z.infer<typeof TargetOnDaySchema>

// ---------------------------------------------------------------------------
// 自定义目标的字段定义（7 种类型，最多 10 个）
// ---------------------------------------------------------------------------

export const FIELD_TYPES = [
  'number',
  'text',
  'single-select',
  'multi-select',
  'boolean',
  'duration',
  'rating',
] as const
export const FieldTypeSchema = z.enum(FIELD_TYPES).meta({ id: 'FieldType' })
export type FieldType = z.infer<typeof FieldTypeSchema>

/** 字段 key：表单值对象的键，同一目标内唯一 */
const FieldKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,31}$/, { error: '字段标识只能用小写字母、数字和下划线，并以字母开头' })

const FieldBase = {
  key: FieldKeySchema,
  label: z
    .string()
    .trim()
    .min(1, { error: '请填写字段名' })
    .max(20, { error: '字段名最多 20 个字' }),
  required: z.boolean().default(false),
}

const OptionsSchema = z
  .array(z.string().trim().min(1, { error: '选项不能为空' }).max(20, { error: '选项最多 20 个字' }))
  .min(2, { error: '至少两个选项' })
  .max(20, { error: '最多 20 个选项' })
  .refine((o) => new Set(o).size === o.length, { error: '选项不能重复' })

export const NumberFieldDefSchema = z
  .object({
    ...FieldBase,
    type: z.literal('number'),
    unit: z.string().trim().max(8, { error: '单位最多 8 个字' }).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    /** 是否只允许整数 */
    integer: z.boolean().default(false),
  })
  .refine((f) => f.min === undefined || f.max === undefined || f.min <= f.max, {
    error: '最小值不能大于最大值',
    path: ['max'],
  })

export const TextFieldDefSchema = z.object({
  ...FieldBase,
  type: z.literal('text'),
  maxLength: z.number().int().min(1).max(500).default(100),
})

export const SingleSelectFieldDefSchema = z.object({
  ...FieldBase,
  type: z.literal('single-select'),
  options: OptionsSchema,
})

export const MultiSelectFieldDefSchema = z.object({
  ...FieldBase,
  type: z.literal('multi-select'),
  options: OptionsSchema,
})

export const BooleanFieldDefSchema = z.object({
  ...FieldBase,
  type: z.literal('boolean'),
})

/** 值为秒；界面按分钟输入 */
export const DurationFieldDefSchema = z.object({
  ...FieldBase,
  type: z.literal('duration'),
  maxSeconds: z.number().int().min(60).max(86_400).default(86_400),
})

/** 值为 1–5 */
export const RatingFieldDefSchema = z.object({
  ...FieldBase,
  type: z.literal('rating'),
})

export const FieldDefSchema = z
  .discriminatedUnion('type', [
    NumberFieldDefSchema,
    TextFieldDefSchema,
    SingleSelectFieldDefSchema,
    MultiSelectFieldDefSchema,
    BooleanFieldDefSchema,
    DurationFieldDefSchema,
    RatingFieldDefSchema,
  ])
  .meta({ id: 'FieldDef' })
export type FieldDef = z.infer<typeof FieldDefSchema>
/** 写字段定义时的输入形状（default 字段可省略） */
export type FieldDefInput = z.input<typeof FieldDefSchema>

export const FieldDefsSchema = z
  .array(FieldDefSchema)
  .min(1, { error: '至少一个字段' })
  .max(GOAL_FIELDS_MAX, { error: `最多 ${GOAL_FIELDS_MAX} 个字段` })
  .refine((fs) => new Set(fs.map((f) => f.key)).size === fs.length, { error: '字段标识不能重复' })
  .meta({ id: 'FieldDefs' })

/** 动态表单的值：key → 值（number / string / string[] / boolean） */
export const FieldValueSchema = z.union([z.number(), z.string(), z.array(z.string()), z.boolean()])
export type FieldValue = z.infer<typeof FieldValueSchema>
export type FieldValues = Record<string, FieldValue | undefined>

// ---------------------------------------------------------------------------
// 目标 DTO 与写入
// ---------------------------------------------------------------------------

export const GoalStatusSchema = z.enum(['active', 'archived']).meta({ id: 'GoalStatus' })
export type GoalStatus = z.infer<typeof GoalStatusSchema>

const TitleSchema = z
  .string()
  .trim()
  .min(1, { error: '给目标起个名字吧' })
  .max(GOAL_TITLE_MAX, { error: `标题最多 ${GOAL_TITLE_MAX} 个字` })
const DescriptionSchema = z
  .string()
  .trim()
  .max(GOAL_DESCRIPTION_MAX, { error: `说明最多 ${GOAL_DESCRIPTION_MAX} 个字` })

export const GoalSchema = z
  .object({
    id: IdSchema,
    module: ModuleSchema,
    title: z.string(),
    description: z.string().nullable(),
    target: TargetSchema,
    weekdays: WeekdaysSchema,
    plannedTime: LocalTimeSchema.nullable(),
    status: GoalStatusSchema,
    sortOrder: z.number().int(),
    /** 只有自定义目标有；当前字段定义版本 */
    fieldVersion: z.number().int().nullable(),
    /** 只有自定义目标有；当前版本的字段定义 */
    fields: z.array(FieldDefSchema).nullable(),
    createdAt: InstantSchema,
    updatedAt: InstantSchema,
  })
  .meta({ id: 'Goal' })
export type Goal = z.infer<typeof GoalSchema>

export const CreateGoalSchema = z
  .object({
    module: ModuleSchema,
    title: TitleSchema,
    description: DescriptionSchema.nullable().optional(),
    target: TargetSchema,
    weekdays: WeekdaysSchema.default([...ALL_WEEKDAYS]),
    plannedTime: LocalTimeSchema.nullable().optional(),
    /** 自定义目标必填，其余板块不能填 */
    fields: FieldDefsSchema.optional(),
  })
  .refine((g) => (g.module === 'custom') === (g.fields !== undefined), {
    error: '只有自定义目标需要字段定义',
    path: ['fields'],
  })
  .superRefine((g, ctx) => {
    if (!isTargetKindAllowed(g.module, g.target.kind)) {
      ctx.addIssue({ code: 'custom', message: targetKindError(g.module), path: ['target'] })
    }
  })
  .meta({ id: 'CreateGoal' })
export type CreateGoal = z.infer<typeof CreateGoalSchema>
export type CreateGoalInput = z.input<typeof CreateGoalSchema>

/** 修改：归档 / 恢复用 status；改 target 写 goal_targets；改 fields 生成新版本（PRD 2.3、7.2） */
export const UpdateGoalSchema = z
  .object({
    title: TitleSchema,
    description: DescriptionSchema.nullable(),
    target: TargetSchema,
    weekdays: WeekdaysSchema,
    plannedTime: LocalTimeSchema.nullable(),
    status: GoalStatusSchema,
    sortOrder: z.number().int().min(0),
    fields: FieldDefsSchema,
  })
  .partial()
  .refine((p) => Object.keys(p).length > 0, { error: '没有要修改的内容' })
  .meta({ id: 'UpdateGoal' })
export type UpdateGoal = z.infer<typeof UpdateGoalSchema>

export const GoalListQuerySchema = z.object({
  status: GoalStatusSchema.default('active'),
})

/** GET /goals 不分页（上限 100，PRD 7.5） */
export const GoalListSchema = z.object({ items: z.array(GoalSchema) }).meta({ id: 'GoalList' })
export type GoalList = z.infer<typeof GoalListSchema>

/** 自定义目标的历史字段版本，用来按当时版本展示打卡（PRD 2.3） */
export const GoalFieldVersionSchema = z
  .object({ version: z.number().int(), fields: z.array(FieldDefSchema), createdAt: InstantSchema })
  .meta({ id: 'GoalFieldVersion' })
export type GoalFieldVersion = z.infer<typeof GoalFieldVersionSchema>

/** GET /goals/{goalId}：目标 + 自定义字段的全部版本 + 目标量历史 */
export const GoalDetailSchema = GoalSchema.extend({
  fieldVersions: z.array(GoalFieldVersionSchema),
  targetHistory: z.array(TargetOnDaySchema.extend({ effectiveFrom: LocalDateSchema })),
}).meta({ id: 'GoalDetail' })
export type GoalDetail = z.infer<typeof GoalDetailSchema>

export const GoalIdParamSchema = z.object({ goalId: IdSchema })
