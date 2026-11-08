import * as z from 'zod'
import { FieldValueSchema } from '@/features/goal/schemas'
import {
  IdSchema,
  LocalTimeSchema,
  ModuleSchema,
  RatingValueSchema,
} from '@/features/shared/schemas'
import { DietItemsSchema, IntensitySchema, MealTypeSchema, NOTE_MAX } from './schemas'

/*
 * 全板块智能识别契约（智能拍照 + 智能上传图片/TXT/HTML）：
 *   POST /api/v1/ai/smart-recognitions（multipart：image? + textContent? + hintModule? + goalId? + note?）
 *   → 201 { draft, aiRunId }。
 *
 * 设计要点：
 * 1. 全局入口（/checkin/smart）不传 hintModule，由 Agent 自动判别属于哪个打卡方向（detectedModule）并填充对应子组件草稿；
 * 2. 单板块入口（/goals/[goalId]/checkin 内的「智能拍照 / 智能上传」Tab）传入 hintModule 与 goalId，
 *    跳过方向判别器，直接提取并预填当前板块的表单数据；
 * 3. 草稿只存在于前端状态中，用户确认或微调后调普通创建接口 POST /goals/{goalId}/checkins（带 source: 'ai' 与 aiRunId）。
 */

export const SMART_TEXT_MAX_CHARS = 4000

export const SmartExerciseDraftSchema = z
  .object({
    category: z.string().trim().min(1).max(10),
    durationMinutes: z.number().int().min(1).max(600),
    intensity: IntensitySchema,
    estimatedKcal: z.number().int().min(0).max(5000).nullable(),
    km: z.number().min(0).max(200).nullable().optional(),
    sets: z.number().int().min(1).max(100).nullable().optional(),
    note: z.string().max(NOTE_MAX).nullable(),
  })
  .meta({ id: 'SmartExerciseDraft' })
export type SmartExerciseDraft = z.infer<typeof SmartExerciseDraftSchema>

export const SmartDietDraftSchema = z
  .object({
    mealType: MealTypeSchema,
    items: DietItemsSchema,
    note: z.string().max(NOTE_MAX).nullable(),
  })
  .meta({ id: 'SmartDietDraft' })
export type SmartDietDraft = z.infer<typeof SmartDietDraftSchema>

export const SmartSleepDraftSchema = z
  .object({
    bedTime: LocalTimeSchema,
    wakeTime: LocalTimeSchema,
    quality: RatingValueSchema,
    note: z.string().max(NOTE_MAX).nullable(),
  })
  .meta({ id: 'SmartSleepDraft' })
export type SmartSleepDraft = z.infer<typeof SmartSleepDraftSchema>

export const SmartStudyDraftSchema = z
  .object({
    what: z.string().trim().min(1).max(60),
    durationMinutes: z.number().int().min(1).max(1440).nullable(),
    note: z.string().max(NOTE_MAX).nullable(),
  })
  .meta({ id: 'SmartStudyDraft' })
export type SmartStudyDraft = z.infer<typeof SmartStudyDraftSchema>

export const SmartCustomDraftSchema = z
  .object({
    values: z.record(z.string(), FieldValueSchema),
    note: z.string().max(NOTE_MAX).nullable(),
  })
  .meta({ id: 'SmartCustomDraft' })
export type SmartCustomDraft = z.infer<typeof SmartCustomDraftSchema>

/** 模型输出 = 接口草稿 */
export const SmartRecognitionDraftSchema = z
  .object({
    /** Agent 判别出的打卡方向（5 选 1） */
    detectedModule: ModuleSchema,
    /** 若匹配到用户进行中的目标则返回 goalId，否则为 null */
    matchedGoalId: z.string().nullable(),
    /** 识别把握度 0–1 */
    confidence: z.number().min(0).max(1),
    /** 一句话中文总结，确认打卡时入库为 parsedText */
    summary: z.string().max(500),
    /** 扫描镜下方的 3 步实时分析轨迹文案 */
    scanSteps: z.tuple([z.string().max(80), z.string().max(80), z.string().max(80)]),
    /** 运动板块填充数据 */
    exercise: SmartExerciseDraftSchema.nullable(),
    /** 饮食板块填充数据 */
    diet: SmartDietDraftSchema.nullable(),
    /** 睡眠板块填充数据 */
    sleep: SmartSleepDraftSchema.nullable(),
    /** 学习板块填充数据 */
    study: SmartStudyDraftSchema.nullable(),
    /** 自定义板块填充数据 */
    custom: SmartCustomDraftSchema.nullable(),
  })
  .meta({ id: 'SmartRecognitionDraft' })
export type SmartRecognitionDraft = z.infer<typeof SmartRecognitionDraftSchema>

/** multipart 除 image 外的文本字段 */
export const SmartRecognitionFieldsSchema = z.object({
  /** 已知板块时传入（单板块打卡页内切换 Tab 时使用） */
  hintModule: ModuleSchema.optional(),
  /** 已知目标 ID 时传入（用于读取自定义目标的字段定义） */
  goalId: IdSchema.optional(),
  /** 智能上传纯文本/HTML 附件提纯后的文本内容 */
  textContent: z.string().trim().max(SMART_TEXT_MAX_CHARS).optional(),
  /** 用户补充说明 */
  note: z.string().trim().max(100).optional(),
})
export type SmartRecognitionFields = z.infer<typeof SmartRecognitionFieldsSchema>

/** 201 响应 */
export const SmartRecognitionResultSchema = z
  .object({
    draft: SmartRecognitionDraftSchema,
    aiRunId: IdSchema,
  })
  .meta({ id: 'SmartRecognitionResult' })
export type SmartRecognitionResult = z.infer<typeof SmartRecognitionResultSchema>
