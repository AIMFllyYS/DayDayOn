import { describe, expect, it } from 'vitest'
import { CreateCheckinSchema } from '@/features/checkin/schemas'
import { buildDietCheckin, draftToItems } from './draft'
import type { DietDraft } from './schemas'

const AI_RUN_ID = '0193f6b2-0000-7000-8000-000000000001'

const draft: DietDraft = {
  items: [
    {
      name: '番茄炒蛋',
      portion: '约 200 克',
      lowKcal: 240,
      highKcal: 281,
      proteinGrams: 12,
      fatGrams: null,
      carbGrams: null,
    },
    {
      name: '米饭',
      portion: '一碗',
      lowKcal: 170,
      highKcal: 170,
      proteinGrams: null,
      fatGrams: null,
      carbGrams: null,
    },
  ],
  totalLowKcal: 410,
  totalHighKcal: 451,
  confidence: 0.8,
  summary: '番茄炒蛋和米饭',
}

describe('draftToItems', () => {
  it('每项热量取区间中值（四舍五入），保留 AI 区间作为提示', () => {
    const items = draftToItems(draft)
    expect(items.map((i) => i.kcal)).toEqual([261, 170])
    expect(items[0]?.hint).toBe('AI 估 240–281 kcal')
    expect(items[1]?.hint).toBe('AI 估 170 kcal')
    expect(new Set(items.map((i) => i.id)).size).toBe(2)
  })
})

describe('buildDietCheckin', () => {
  it('组装 source ai + aiRunId + parsedText，用户改过的热量以用户为准', () => {
    const items = draftToItems(draft).map((i, idx) => (idx === 0 ? { ...i, kcal: 300 } : i))
    const r = buildDietCheckin({
      items,
      mealType: 'lunch',
      aiRunId: AI_RUN_ID,
      summary: draft.summary,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.body).toMatchObject({
      module: 'diet',
      source: 'ai',
      aiRunId: AI_RUN_ID,
      method: 'photo',
      mealType: 'lunch',
      parsedText: '番茄炒蛋和米饭',
      items: [
        { name: '番茄炒蛋', portion: '约 200 克', kcal: 300 },
        { name: '米饭', portion: '一碗', kcal: 170 },
      ],
    })
    expect(CreateCheckinSchema.safeParse(r.body).success).toBe(true)
  })

  it('名称为空、热量超限：按条目 id 返回错误', () => {
    const items = draftToItems(draft)
    const [a, b] = items
    if (!a || !b) throw new Error('fixture')
    const r = buildDietCheckin({
      items: [
        { ...a, name: '  ' },
        { ...b, kcal: 6000 },
      ],
      mealType: 'lunch',
      aiRunId: AI_RUN_ID,
      summary: '',
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors[a.id]?.name).toBe('请填写食物名称')
    expect(r.errors[b.id]?.kcal).toBe('单条热量最多 5000 千卡')
  })

  it('一条都没有：表单级错误', () => {
    const r = buildDietCheckin({ items: [], mealType: 'snack', aiRunId: AI_RUN_ID, summary: '' })
    expect(r).toMatchObject({ ok: false, formError: '至少记一样食物' })
  })
})
