import type { MealType } from '@/features/checkin/schemas'
import { MEAL_LABEL } from '@/features/diet/draft'
import type { DietDraft } from '@/features/diet/schemas'

/*
 * 识别结果的纯函数规则（PRD 2.6、7.3）。不碰数据库和模型，带单测。
 */

/**
 * 模型输出已过 DietDraftSchema 校验；这里再做两件模型容易做错的事：
 * - 合计按条目重新求和（模型的加法不可靠）；
 * - 文本去掉首尾空白，summary 为空时用条目名拼一句。
 */
export function normalizeDraft(draft: DietDraft): DietDraft {
  const items = draft.items.map((i) => ({ ...i, name: i.name.trim(), portion: i.portion.trim() }))
  const totalLowKcal = items.reduce((s, i) => s + i.lowKcal, 0)
  const totalHighKcal = items.reduce((s, i) => s + i.highKcal, 0)
  const summary =
    draft.summary.trim() ||
    `${items.map((i) => i.name).join('、')}，约 ${totalLowKcal}–${totalHighKcal} 千卡`
  return { ...draft, items, totalLowKcal, totalHighKcal, summary }
}

/**
 * user message 的文字部分：餐次和备注是用户数据，只放在 user message 里，不拼进 system（ai-and-quota.md 第 7 节）。
 */
export function recognitionUserText(input: { mealType?: MealType; note?: string }): string {
  const lines = ['请识别这张照片里的食物并估算热量。']
  if (input.mealType) lines.push(`餐次：${MEAL_LABEL[input.mealType]}`)
  const note = input.note?.trim()
  if (note) lines.push(`用户补充：${note}`)
  return lines.join('\n')
}
