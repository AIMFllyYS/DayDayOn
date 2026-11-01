import * as z from 'zod'
import { MealTypeSchema } from '@/features/checkin/schemas'
import { IdSchema } from '@/features/shared/schemas'

/*
 * 饮食拍照识别契约（PRD 2.6、7.3）。D6 实现。
 * 识别接口不流式：POST /ai/diet-recognitions（multipart：image + mealType? + note?）→ 201 { draft, aiRunId }。
 * 草稿只存在于前端状态里；确认后调 POST /goals/{goalId}/checkins（source: 'ai'、aiRunId）。
 */

export const LOW_CONFIDENCE = 0.6
export const IMAGE_MAX_BYTES = 4 * 1024 * 1024

const Kcal = z.number().int().min(0).max(5000)
const Grams = z.number().min(0).max(2000).nullable()

export const DietDraftItemSchema = z
  .object({
    name: z.string().min(1).max(30),
    portion: z.string().max(30),
    lowKcal: Kcal,
    highKcal: Kcal,
    proteinGrams: Grams,
    fatGrams: Grams,
    carbGrams: Grams,
  })
  .refine((i) => i.lowKcal <= i.highKcal, { error: '热量区间不对', path: ['highKcal'] })
  .meta({ id: 'DietDraftItem' })
export type DietDraftItem = z.infer<typeof DietDraftItemSchema>

/** 模型输出 = 接口草稿（prompts/diet-recognition.ts 的输出 schema 直接复用这一份） */
export const DietDraftSchema = z
  .object({
    items: z.array(DietDraftItemSchema).min(1).max(20),
    totalLowKcal: z.number().int().min(0),
    totalHighKcal: z.number().int().min(0),
    /** 0–1；< 0.6 不是错误，前端提示核对 */
    confidence: z.number().min(0).max(1),
    /** 一句话解析文本，入库时存进打卡的 parsedText */
    summary: z.string().max(500),
  })
  .meta({ id: 'DietDraft' })
export type DietDraft = z.infer<typeof DietDraftSchema>

/** multipart 里除 image 外的文本字段 */
export const DietRecognitionFieldsSchema = z.object({
  mealType: MealTypeSchema.optional(),
  note: z.string().trim().max(100).optional(),
})
export type DietRecognitionFields = z.infer<typeof DietRecognitionFieldsSchema>

/** 201 响应 */
export const DietRecognitionResultSchema = z
  .object({ draft: DietDraftSchema, aiRunId: IdSchema })
  .meta({ id: 'DietRecognitionResult' })
export type DietRecognitionResult = z.infer<typeof DietRecognitionResultSchema>

/** 入库时每项热量取区间中值（四舍五入），用户改过的以用户为准 */
export function midKcal(item: Pick<DietDraftItem, 'lowKcal' | 'highKcal'>): number {
  return Math.round((item.lowKcal + item.highKcal) / 2)
}
