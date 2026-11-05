import { describe, expect, it } from 'vitest'
import type { SmartRecognitionDraft } from '@/features/checkin/smart-schemas'
import { buildSmartUserText, normalizeSmartDraft, type SmartGoalBrief } from './draft'

const sampleGoals: readonly SmartGoalBrief[] = [
  { id: '0193f6b2-0000-7000-8000-000000000001', module: 'exercise', title: '动一动' },
  { id: '0193f6b2-0000-7000-8000-000000000002', module: 'diet', title: '好好吃饭' },
  {
    id: '0193f6b2-0000-7000-8000-000000000003',
    module: 'custom',
    title: '每天喝水',
    fields: [{ key: 'cups', label: '杯数', type: 'number', required: true, integer: true }],
  },
]

const rawDraft: SmartRecognitionDraft = {
  detectedModule: 'exercise',
  matchedGoalId: null,
  confidence: 0.92,
  summary: '  户外跑步 5 公里  ',
  scanSteps: ['  扫描轨迹  ', '  提取配速  ', '  填入动一动  '],
  exercise: {
    category: '跑步',
    durationMinutes: 30,
    intensity: 'moderate',
    estimatedKcal: 210,
    note: '微汗',
  },
  diet: null,
  sleep: null,
  study: null,
  custom: null,
}

describe('buildSmartUserText', () => {
  it('包含目标列表、自定义字段说明与文本内容', () => {
    const text = buildSmartUserText({
      fields: {
        hintModule: 'custom',
        textContent: '今天喝了 8 杯温水',
        note: '没有喝奶茶',
      },
      goals: sampleGoals,
      hasImage: false,
    })
    expect(text).toContain('已知所属板块（hintModule）：custom')
    expect(text).toContain('cups:杯数[number]')
    expect(text).toContain('今天喝了 8 杯温水')
    expect(text).toContain('没有喝奶茶')
  })
})

describe('normalizeSmartDraft', () => {
  it('自动匹配同板块第一个进行中目标并清理首尾空白', () => {
    const out = normalizeSmartDraft(rawDraft, { goals: sampleGoals })
    expect(out.detectedModule).toBe('exercise')
    expect(out.matchedGoalId).toBe('0193f6b2-0000-7000-8000-000000000001')
    expect(out.summary).toBe('户外跑步 5 公里')
    expect(out.scanSteps[0]).toBe('扫描轨迹')
  })

  it('若传入 hintModule 则强制覆盖 detectedModule 并补齐对应子对象兜底', () => {
    const out = normalizeSmartDraft(rawDraft, {
      hintModule: 'diet',
      goals: sampleGoals,
    })
    expect(out.detectedModule).toBe('diet')
    expect(out.matchedGoalId).toBe('0193f6b2-0000-7000-8000-000000000002')
    expect(out.diet).not.toBeNull()
    expect(out.diet?.items.length).toBeGreaterThan(0)
  })

  it('自定义目标归一化时剔除未知键、支持 label 映射并补齐必填布尔字段默认值', () => {
    const customGoals: readonly SmartGoalBrief[] = [
      {
        id: '0193f6b2-0000-7000-8000-000000000009',
        module: 'custom',
        title: '我的小目标',
        fields: [{ key: 'done', label: '完成了吗', type: 'boolean', required: true }],
      },
    ]
    const out = normalizeSmartDraft(
      {
        ...rawDraft,
        detectedModule: 'custom',
        matchedGoalId: null,
        summary: '识别到一张 Cursor AI IDE 订阅支付账单 68.34 元',
        custom: {
          values: { amount: 68.34, 完成了吗: '是' },
          note: 'Cursor AI IDE 订阅支付 68.34 元',
        },
      },
      { goals: customGoals },
    )
    expect(out.matchedGoalId).toBe('0193f6b2-0000-7000-8000-000000000009')
    expect(out.custom?.values).toEqual({ done: true })
  })
})
