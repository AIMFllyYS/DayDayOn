import { describe, expect, it } from 'vitest'
import type { Verdict } from '@/features/referee/schemas'
import type { CheckinGoal } from '../../components/form-types'
import type { CreateCheckinInput } from '../../schemas'
import { axisLabel, buildPosterModel, buildSleepAxis, buildStatus, buildTomatoes } from './model'
import type { ReportPosterInput } from './types'

/*
 * 海报视图模型的纯函数测试：状态判定、番茄钟换算、睡眠时间轴、自定义主数字、
 * 以及饮食「离线无营养事实」与「分餐待记录」两种易错整形。
 */

function verdict(patch: Partial<Verdict> = {}): Verdict {
  return {
    version: 1,
    isValid: true,
    settlement: 'settled',
    score: null,
    scoreMax: null,
    detail: '',
    checks: [],
    metrics: {},
    facts: null,
    citations: [],
    advice: [],
    refereeRunId: null,
    offline: false,
    ...patch,
  }
}

function makeInput(patch: Partial<ReportPosterInput> = {}): ReportPosterInput {
  return {
    module: 'exercise',
    goal: {
      id: 'g-test',
      module: 'exercise',
      title: '动一动',
      target: { kind: 'count', value: 1 },
      fields: null,
      fieldVersion: null,
    },
    verdict: verdict(),
    subject: { module: 'exercise', category: '慢跑', intensity: 'easy', durationSeconds: 600 },
    today: '2026-11-19',
    period: { done: 12, total: 21 },
    pet: { character: 'tuan', name: '团团' },
    ...patch,
  }
}

function dietInput(patch: Partial<ReportPosterInput> = {}): ReportPosterInput {
  return makeInput({
    module: 'diet',
    goal: {
      id: 'g-diet',
      module: 'diet',
      title: '好好吃饭',
      target: { kind: 'count', value: 1 },
      fields: null,
      fieldVersion: null,
    },
    subject: {
      module: 'diet',
      method: 'manual',
      mealType: 'dinner',
      items: [{ name: '牛肉面', portion: '1 份', kcal: null }],
    },
    ...patch,
  })
}

describe('海报状态判定', () => {
  it('metrics.skipped=1 → 请假条', () => {
    const s = buildStatus(makeInput({ verdict: verdict({ metrics: { skipped: 1 } }) }))
    expect(s.kind).toBe('skipped')
    expect(s.stampMain).toBe('已准假')
  })

  it('settlement=pending → 分餐中', () => {
    const s = buildStatus(
      dietInput({
        verdict: verdict({
          settlement: 'pending',
          metrics: { mealsLogged: 1, mealsRequired: 3 },
        }),
      }),
    )
    expect(s.kind).toBe('pending')
    expect(s.badge).toBe('分餐进度 1/3')
    expect(s.stampMain).toBe('分餐中')
  })

  it('isValid → 已达标有效卡', () => {
    const s = buildStatus(makeInput({ verdict: verdict({ isValid: true }) }))
    expect(s.kind).toBe('valid')
    expect(s.stampSub).toBe('有效卡')
  })

  it('未达标 → 已存档 + warning 色调', () => {
    const s = buildStatus(makeInput({ verdict: verdict({ isValid: false }) }))
    expect(s.kind).toBe('archived')
    expect(s.tone).toBe('warning')
    expect(s.stampSub).toBe('继续加油')
  })
})

describe('番茄钟换算', () => {
  it('不满 25 分钟 → 一个按比例填充的番茄', () => {
    expect(buildTomatoes(10).tomatoes).toEqual([0.4])
  })

  it('95 分钟 → 3 个满番茄 + 1 个 80%', () => {
    const { tomatoes, more } = buildTomatoes(95)
    expect(tomatoes).toEqual([1, 1, 1, 0.8])
    expect(more).toBe(0)
  })

  it('超过 8 个番茄 → 折叠成 +N', () => {
    const { tomatoes, more } = buildTomatoes(25 * 9)
    expect(tomatoes).toHaveLength(8)
    expect(more).toBe(1)
  })

  it('0 分钟 → 一个空番茄', () => {
    expect(buildTomatoes(0).tomatoes).toEqual([0])
  })
})

describe('睡眠时间轴', () => {
  it('轴起点取入睡/红线较早者的前一整点', () => {
    const ax = buildSleepAxis('22:52', '23:30', 468)
    expect(axisLabel(ax.start)).toBe('21:00')
    expect(axisLabel(ax.bed)).toBe('22:52')
    expect(axisLabel(ax.wake)).toBe('06:40')
    expect(axisLabel(ax.end)).toBe('08:00')
  })

  it('凌晨入睡跨天回绕', () => {
    const ax = buildSleepAxis('01:35', '23:00', 455)
    expect(axisLabel(ax.start)).toBe('22:00')
    expect(axisLabel(ax.wake)).toBe('09:10')
    expect(axisLabel(ax.end)).toBe('11:00')
  })
})

describe('自定义主数字', () => {
  const habitGoal: CheckinGoal = {
    id: 'g-custom',
    module: 'custom',
    title: '喝够八杯水',
    target: { kind: 'count', value: 1 },
    fields: [
      { key: 'cups', label: '今天喝了', required: true, type: 'number', unit: '杯', integer: true },
    ],
    fieldVersion: 1,
  }
  const customSubject: CreateCheckinInput = {
    module: 'custom',
    fieldVersion: 1,
    values: { cups: 8 },
  }

  it('有核验条件 → 主数字是 passed/total', () => {
    const m = buildPosterModel(
      makeInput({
        module: 'custom',
        goal: habitGoal,
        subject: customSubject,
        verdict: verdict({
          checks: [
            { id: 'a', text: '喝水 ≥ 8 杯', ok: true },
            { id: 'b', text: '字段已填写', ok: true },
            { id: 'c', text: '内容写清楚', ok: true },
          ],
        }),
      }),
    )
    expect(m.kpi.value).toBe('3/3')
    expect(m.kpi.unit).toBe('项达标')
    expect(m.kpi.sub).toBe('今天记了 1 项')
  })

  it('没有核验条件 → 第一个数值字段当主数字', () => {
    const m = buildPosterModel(
      makeInput({ module: 'custom', goal: habitGoal, subject: customSubject }),
    )
    expect(m.kpi.value).toBe('8')
    expect(m.kpi.unit).toBe('杯')
    expect(m.kpi.sub).toBe('今天喝了')
  })

  it('没有数值字段 → 退化成记录条数', () => {
    const m = buildPosterModel(
      makeInput({
        module: 'custom',
        goal: {
          ...habitGoal,
          fields: [{ key: 'mood', label: '心情', required: false, type: 'text', maxLength: 50 }],
        },
        subject: { module: 'custom', fieldVersion: 1, values: { mood: '开心' } },
      }),
    )
    expect(m.kpi.value).toBe('1')
    expect(m.kpi.unit).toBe('项记录')
  })
})

describe('饮食数据整形', () => {
  it('分餐中：未记的餐次列为占位，盘心显示本餐热量', () => {
    const m = buildPosterModel(
      dietInput({
        subject: {
          module: 'diet',
          method: 'manual',
          mealType: 'breakfast',
          items: [{ name: '燕麦牛奶粥', portion: '1 份', kcal: 220 }],
        },
        verdict: verdict({
          settlement: 'pending',
          metrics: { mealsLogged: 1, mealsRequired: 3, kcal: 405 },
        }),
      }),
    )
    if (m.scene.module !== 'diet') throw new Error('应为饮食模型')
    expect(m.status.kind).toBe('pending')
    expect(m.scene.meals).toHaveLength(1)
    expect(m.scene.missingMeals).toEqual(['午餐', '晚餐'])
    expect(m.kpi.value).toBe('405')
  })

  it('离线无营养事实：不把「没数据」显示成 0 kcal', () => {
    const m = buildPosterModel(
      dietInput({
        verdict: verdict({
          score: 3.8,
          metrics: { mealsLogged: 3, mealsRequired: 3, dailyKcal: 0, tier: 'balanced-glycemic' },
        }),
      }),
    )
    if (m.scene.module !== 'diet') throw new Error('应为饮食模型')
    expect(m.scene.meals[0]!.kcal).toBeNull()
    expect(m.scene.totalKcal).toBeNull()
    expect(m.scene.hasNutrition).toBe(false)
    expect(m.kpi.sub).toContain('三餐已记录')
    expect(m.scene.missingMeals).toEqual(['早餐', '午餐'])
  })

  it('空腹轻断食：合计 0 kcal 是真实数据', () => {
    const m = buildPosterModel(
      dietInput({
        subject: {
          module: 'diet',
          method: 'manual',
          mealType: 'dinner',
          items: [{ name: '空腹', portion: '', kcal: null }],
        },
        verdict: verdict({
          score: 4.5,
          metrics: { mealsLogged: 3, mealsRequired: 3, dailyKcal: 0 },
        }),
      }),
    )
    if (m.scene.module !== 'diet') throw new Error('应为饮食模型')
    expect(m.scene.meals[0]!.fasting).toBe(true)
    expect(m.scene.meals[0]!.kcal).toBe(0)
    expect(m.scene.totalKcal).toBe(0)
    expect(m.kpi.sub).toContain('全天 0 kcal')
  })
})
