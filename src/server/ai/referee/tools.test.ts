import { describe, expect, it } from 'vitest'
import type { Verdict } from '@/features/referee/schemas'
import type { DbOrTx } from '@/server/db/client'
import { findFood } from './food-table'
import { buildRefereeTools, type RefereeToolContext } from './tools'

const exec = { toolCallId: 't1', messages: [] } as never

function ctx(over: Partial<RefereeToolContext> = {}): RefereeToolContext {
  return {
    db: {} as DbOrTx,
    userId: 'u1',
    goalId: 'g1',
    module: 'diet',
    today: '2026-11-05',
    timeZone: 'Asia/Shanghai',
    weightKg: null,
    search: { used: 0, costMicros: 0 },
    judgeBase: {
      module: 'diet',
      subject: { mealType: 'dinner', items: [{ name: '炸鸡腿', portion: '', kcal: null }] },
      storedRules: null,
      tier: 'balanced-glycemic',
    },
    aiRunId: '0193f6b2-0000-7000-8000-000000000009',
    onVerdict: () => undefined,
    ...over,
  }
}

describe('裁判工具', () => {
  it('食物表：别名与包含关系都能命中', () => {
    expect(findFood('清蒸鲈鱼')?.names[0]).toBe('鱼')
    expect(findFood('冰镇含糖可乐')?.junk).toBe(true)
    expect(findFood('佛跳墙')).toBeNull()
  })

  it('lookupFoodNutrition 区分查到与查不到', async () => {
    const tools = buildRefereeTools(ctx())
    const out = (await tools.lookupFoodNutrition!.execute!(
      { names: ['米饭', '佛跳墙'] },
      exec,
    )) as {
      found: { name: string }[]
      missing: string[]
    }
    expect(out.found.map((f) => f.name)).toEqual(['米饭'])
    expect(out.missing).toEqual(['佛跳墙'])
  })

  it('submitVerdict 用共用规则出结论并回调：单餐待汇总为 pending，集齐三餐算出总分并带上裁判 id', async () => {
    let pendingGot: Verdict | null = null
    const pendingTools = buildRefereeTools(ctx({ onVerdict: (v) => (pendingGot = v) }))
    const dishFact = {
      name: '炸鸡腿',
      portion: '1 个',
      kcal: 330,
      proteinG: 20,
      carbG: 15,
      fatG: 21,
      fiberG: 0.5,
      sodiumMg: 620,
      gi: 70,
      junk: true,
      sweet: false,
      cooking: 'fried' as const,
      source: 'table' as const,
    }
    await pendingTools.submitVerdict!.execute!(
      {
        facts: { module: 'diet', dishes: [dishFact] },
        citations: [],
        advice: ['换成烤鸡胸'],
      },
      exec,
    )
    const pv = pendingGot as Verdict | null
    expect(pv?.settlement).toBe('pending')
    expect(pv?.score).toBeNull()
    expect(pv?.isValid).toBe(false)

    let settledGot: Verdict | null = null
    const settledTools = buildRefereeTools(
      ctx({
        judgeBase: {
          module: 'diet',
          subject: { mealType: 'dinner', items: [{ name: '炸鸡腿', portion: '', kcal: null }] },
          storedRules: null,
          tier: 'balanced-glycemic',
          priorDietMeals: [
            {
              mealType: 'breakfast',
              items: [{ name: '牛奶', portion: '', kcal: 135 }],
              dishes: null,
            },
            { mealType: 'lunch', items: [{ name: '米饭', portion: '', kcal: 220 }], dishes: null },
          ],
        },
        onVerdict: (v) => (settledGot = v),
      }),
    )
    await settledTools.submitVerdict!.execute!(
      {
        facts: { module: 'diet', dishes: [dishFact] },
        citations: [],
        advice: ['换成烤鸡胸'],
      },
      exec,
    )
    const v = settledGot as Verdict | null
    expect(v?.settlement).toBe('settled')
    expect(v?.isValid).toBe(false)
    expect(v?.score).toBe(0)
    expect(v?.refereeRunId).toBe('0193f6b2-0000-7000-8000-000000000009')
    expect(v?.advice).toContain('换成烤鸡胸')
  })

  it('运动板块只暴露运动工具', () => {
    const tools = buildRefereeTools(
      ctx({
        module: 'exercise',
        judgeBase: {
          module: 'exercise',
          subject: { items: [] },
          storedRules: null,
          tier: 'balanced-glycemic',
        },
      }),
    )
    expect(Object.keys(tools).sort()).toEqual(['calcExerciseKcal', 'lookupMet', 'submitVerdict'])
  })
})
