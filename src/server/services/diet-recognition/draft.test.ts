import { describe, expect, it } from 'vitest'
import type { DietDraft } from '@/features/diet/schemas'
import { normalizeDraft, recognitionUserText } from './draft'

const item = (name: string, low: number, high: number) => ({
  name,
  portion: ' 一份 ',
  lowKcal: low,
  highKcal: high,
  proteinGrams: null,
  fatGrams: null,
  carbGrams: null,
})

describe('normalizeDraft', () => {
  it('按条目重新求合计，去掉首尾空白', () => {
    const draft: DietDraft = {
      items: [item(' 面条 ', 400, 500), item('卤蛋', 70, 80)],
      totalLowKcal: 1,
      totalHighKcal: 2,
      confidence: 0.9,
      summary: '  一碗面  ',
    }
    const r = normalizeDraft(draft)
    expect(r.totalLowKcal).toBe(470)
    expect(r.totalHighKcal).toBe(580)
    expect(r.items[0]?.name).toBe('面条')
    expect(r.items[0]?.portion).toBe('一份')
    expect(r.summary).toBe('一碗面')
  })

  it('summary 为空时用条目名拼一句', () => {
    const r = normalizeDraft({
      items: [item('苹果', 50, 60)],
      totalLowKcal: 0,
      totalHighKcal: 0,
      confidence: 0.7,
      summary: ' ',
    })
    expect(r.summary).toBe('苹果，约 50–60 千卡')
  })
})

describe('recognitionUserText', () => {
  it('带上餐次和备注', () => {
    expect(recognitionUserText({ mealType: 'dinner', note: ' 只吃了一半 ' })).toBe(
      '请识别这张照片里的食物并估算热量。\n餐次：晚餐\n用户补充：只吃了一半',
    )
  })

  it('没有餐次和备注时只有一句', () => {
    expect(recognitionUserText({})).toBe('请识别这张照片里的食物并估算热量。')
  })
})
