import type { DraftItem, DraftItemErrors } from '@/features/agent/draft'
import { draftItemId } from '@/features/agent/draft'
import {
  CreateDietCheckinSchema,
  DietItemsSchema,
  type CreateCheckinInput,
  type MealType,
} from '@/features/checkin/schemas'
import { midKcal, type DietDraft } from './schemas'

/*
 * 饮食草稿 ⇄ 可编辑条目 ⇄ 创建打卡请求体（PRD 2.6、7.3）。纯函数，带单测。
 * 入库时每项热量取区间中值，用户改过的以用户为准：编辑条目的初始 kcal 就是中值，用户改动直接覆盖。
 */

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
}

export function draftToItems(draft: DietDraft): DraftItem[] {
  return draft.items.map((i) => ({
    id: draftItemId(),
    name: i.name,
    portion: i.portion,
    kcal: midKcal(i),
    hint:
      i.lowKcal === i.highKcal
        ? `AI 估 ${i.lowKcal} kcal`
        : `AI 估 ${i.lowKcal}–${i.highKcal} kcal`,
  }))
}

export type DietCheckinBody = Extract<CreateCheckinInput, { module: 'diet' }>

export type BuildResult =
  | { ok: true; body: DietCheckinBody }
  | { ok: false; errors: Record<string, DraftItemErrors>; formError?: string }

/**
 * 用接口同一份 schema（DietItemsSchema、CreateDietCheckinSchema）校验并组装请求体。
 * 条目级错误按条目 id 返回，交给 AiDraftCard 显示。
 */
export function buildDietCheckin(input: {
  items: readonly DraftItem[]
  mealType: MealType
  aiRunId: string
  summary: string
}): BuildResult {
  const raw = input.items.map((i) => ({ name: i.name, portion: i.portion, kcal: i.kcal }))
  const parsed = DietItemsSchema.safeParse(raw)
  if (!parsed.success) {
    const errors: Record<string, DraftItemErrors> = {}
    let formError: string | undefined
    for (const issue of parsed.error.issues) {
      const [index, field] = issue.path
      const item = typeof index === 'number' ? input.items[index] : undefined
      if (item && (field === 'name' || field === 'portion' || field === 'kcal')) {
        errors[item.id] = { ...errors[item.id], [field]: errors[item.id]?.[field] ?? issue.message }
      } else formError ??= issue.message
    }
    return { ok: false, errors, formError }
  }
  const body: DietCheckinBody = {
    module: 'diet',
    source: 'ai',
    aiRunId: input.aiRunId,
    method: 'photo',
    mealType: input.mealType,
    items: parsed.data,
    parsedText: input.summary.slice(0, 500) || undefined,
  }
  // 兜底：整体再过一遍创建 schema（aiRunId、parsedText 的约束）
  const full = CreateDietCheckinSchema.safeParse(body)
  if (!full.success) {
    return { ok: false, errors: {}, formError: full.error.issues[0]?.message ?? '有几项没填对' }
  }
  return { ok: true, body }
}
