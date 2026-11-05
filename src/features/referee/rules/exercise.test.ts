import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES } from '../defaults'
import {
  detectCalc,
  estimateKcal,
  judgeExercise,
  metOf,
  type ExerciseSubjectItem,
} from './exercise'

const item = (p: Partial<ExerciseSubjectItem> & { name: string }): ExerciseSubjectItem => ({
  calc: detectCalc(p.name) ?? 'distance',
  minutes: 0,
  km: null,
  sets: null,
  kcal: null,
  ...p,
})
const ctx = { rules: DEFAULT_RULES.exercise, tier: 'balanced-glycemic' as const, facts: null }

describe('运动有效阈值', () => {
  it('A 户外慢跑 25 分钟 4.2 公里：达标，用手表消耗', () => {
    const v = judgeExercise(
      { items: [item({ name: '户外慢跑', minutes: 25, km: 4.2, kcal: 196 })] },
      ctx,
    )
    expect(v.isValid).toBe(true)
    expect(v.metrics.kcal).toBe(196)
  })

  it('B 饭后散步 10 分钟 0.6 公里：记为日常活动', () => {
    const v = judgeExercise({ items: [item({ name: '饭后散步', minutes: 10, km: 0.6 })] }, ctx)
    expect(v.isValid).toBe(false)
    expect(v.detail).toContain('日常活动')
  })

  it('C 深蹲 5 组 + 热身慢跑 8 分钟：任一项达标就有效', () => {
    const v = judgeExercise(
      {
        items: [
          item({ name: '深蹲', minutes: 12, sets: 5 }),
          item({ name: '热身慢跑', minutes: 8, km: 1.1 }),
        ],
      },
      ctx,
    )
    expect(v.isValid).toBe(true)
    expect(v.checks.map((c) => c.ok)).toEqual([true, false])
  })

  it('D 平板支撑 6 分钟 2 组：时长和组数都没到线', () => {
    const v = judgeExercise({ items: [item({ name: '平板支撑', minutes: 6, sets: 2 })] }, ctx)
    expect(v.isValid).toBe(false)
  })

  it('用户调高门槛后以用户规则为准', () => {
    const strict = {
      ...ctx,
      rules: { ...DEFAULT_RULES.exercise, distanceMinMinutes: 40, distanceMinKm: 5 },
    }
    const v = judgeExercise({ items: [item({ name: '慢跑', minutes: 25, km: 4.2 })] }, strict)
    expect(v.isValid).toBe(false)
  })

  it('计量方式识别与 MET 估算', () => {
    expect(detectCalc('深蹲')).toBe('count')
    expect(detectCalc('夜跑')).toBe('distance')
    expect(detectCalc('打太极')).toBeNull()
    expect(metOf('慢跑', 'distance').met).toBe(8)
    expect(estimateKcal(8, 30, 60)).toBe(240)
    expect(estimateKcal(8, 30, null)).toBe(240)
  })
})
