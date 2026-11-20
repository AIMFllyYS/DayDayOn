import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES } from '@/features/referee/defaults'
import { judgeDiet } from '@/features/referee/rules/diet'
import type { DietDishFact } from '@/features/referee/schemas'
import type { Checkin, CreateCheckinInput } from '../../schemas'
import { buildDietReport } from './report'

function dish(name: string, overrides: Partial<DietDishFact> = {}): DietDishFact {
  return {
    name,
    portion: '1 份',
    kcal: 320,
    proteinG: 20,
    carbG: 35,
    fatG: 10,
    fiberG: 4,
    sodiumMg: 500,
    gi: 50,
    junk: false,
    sweet: false,
    cooking: 'boiled',
    source: 'table',
    ...overrides,
  }
}

function dietCheckin(
  id: string,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
  dishes: DietDishFact[],
): Checkin {
  return {
    id,
    goalId: 'goal-diet',
    module: 'diet',
    localDate: '2026-11-19',
    occurredAt: '2026-11-19T04:00:00.000Z',
    source: 'ai',
    isMakeup: false,
    durationSeconds: null,
    count: 1,
    intakeKcal: dishes.reduce((s, d) => s + d.kcal, 0),
    burnKcal: null,
    note: null,
    parsedText: null,
    aiRunId: null,
    fieldVersion: null,
    score: 4.4,
    isValid: true,
    payload: {
      module: 'diet',
      method: 'photo',
      mealType,
      items: dishes.map((d) => ({ name: d.name, portion: d.portion, kcal: d.kcal })),
    },
    verdict: {
      version: 1,
      isValid: true,
      settlement: 'settled',
      score: 4.4,
      scoreMax: 5,
      detail: '今日三餐打卡完成',
      checks: [],
      metrics: {},
      facts: { module: 'diet', dishes },
      citations: [],
      advice: [],
      refereeRunId: null,
      offline: false,
    },
    createdAt: '2026-11-19T04:00:00.000Z',
  }
}

describe('buildDietReport 三餐总评聚合', () => {
  it('settled 状态汇总早/午/晚/加餐全部菜品与全天营养总计，不局限在当前午餐槽', () => {
    const breakfastDishes = [
      dish('燕麦粥', { kcal: 240, proteinG: 8, carbG: 42, fatG: 4, fiberG: 5 }),
    ]
    const lunchDishes = [
      dish('清蒸鲈鱼', { kcal: 280, proteinG: 32, carbG: 2, fatG: 12, fiberG: 0 }),
      dish('蒜蓉西兰花', { kcal: 90, proteinG: 4, carbG: 8, fatG: 4, fiberG: 4 }),
    ]
    const dinnerDishes = [
      dish('玉米杂粮饭', { kcal: 260, proteinG: 7, carbG: 52, fatG: 2, fiberG: 6 }),
    ]
    const snackDishes = [
      dish('原味核桃', { kcal: 120, proteinG: 3, carbG: 4, fatG: 11, fiberG: 2 }),
    ]

    const verdict = judgeDiet(
      {
        mealType: 'lunch',
        items: lunchDishes.map((d) => ({ name: d.name, portion: d.portion, kcal: d.kcal })),
      },
      {
        rules: DEFAULT_RULES.diet,
        tier: 'balanced-glycemic',
        facts: { module: 'diet', dishes: lunchDishes },
        priorDietMeals: [
          {
            mealType: 'breakfast',
            items: breakfastDishes.map((d) => ({ name: d.name, portion: d.portion, kcal: d.kcal })),
            dishes: breakfastDishes,
          },
          {
            mealType: 'dinner',
            items: dinnerDishes.map((d) => ({ name: d.name, portion: d.portion, kcal: d.kcal })),
            dishes: dinnerDishes,
          },
          {
            mealType: 'snack',
            items: snackDishes.map((d) => ({ name: d.name, portion: d.portion, kcal: d.kcal })),
            dishes: snackDishes,
          },
        ],
      },
    )

    const currentLunchInput: CreateCheckinInput = {
      module: 'diet',
      method: 'photo',
      mealType: 'lunch',
      items: lunchDishes.map((d) => ({ name: d.name, portion: d.portion, kcal: d.kcal })),
    }

    const report = buildDietReport(verdict, currentLunchInput, undefined, {
      todayCheckins: [
        dietCheckin('c-breakfast', 'breakfast', breakfastDishes),
        dietCheckin('c-lunch', 'lunch', lunchDishes),
        dietCheckin('c-dinner', 'dinner', dinnerDishes),
        dietCheckin('c-snack', 'snack', snackDishes),
      ],
    })

    expect(report.title).toContain('今日三餐总评')
    // 不再出现单餐「午餐热量」卡片
    expect(report.folders.find((f) => f.id === 'energy')).toBeUndefined()

    const summary = report.folders.find((f) => f.id === 'daily-summary')
    expect(summary?.headline).toContain('990 kcal')
    expect(summary?.rows?.find((r) => r.label === '全天总热量')?.value).toBe('990 kcal')

    const nutrition = report.folders.find((f) => f.id === 'nutrition')
    expect(nutrition?.title).toBe('今日营养素总计')
    expect(nutrition?.rows?.find((r) => r.label === '全天蛋白质')?.value).toBe('54 g')

    const dishes = report.folders.find((f) => f.id === 'dishes')
    expect(dishes?.title).toBe('今日逐菜分析')
    expect(dishes?.headline).toContain('共 5 道菜')
    expect(dishes?.children?.map((c) => c.title)).toEqual([
      '早餐 · 燕麦粥',
      '午餐 · 清蒸鲈鱼',
      '午餐 · 蒜蓉西兰花',
      '晚餐 · 玉米杂粮饭',
      '加餐 · 原味核桃',
    ])
  })

  it('pending 状态仍按当前单餐口径展示本餐解析', () => {
    const lunchDishes = [dish('番茄炒蛋', { kcal: 260, proteinG: 14, carbG: 10, fatG: 16 })]
    const verdict = judgeDiet(
      {
        mealType: 'lunch',
        items: [{ name: '番茄炒蛋', portion: '1 份', kcal: 260 }],
      },
      {
        rules: DEFAULT_RULES.diet,
        tier: 'balanced-glycemic',
        facts: { module: 'diet', dishes: lunchDishes },
        priorDietMeals: [],
      },
    )
    const report = buildDietReport(verdict, {
      module: 'diet',
      method: 'manual',
      mealType: 'lunch',
      items: [{ name: '番茄炒蛋', portion: '1 份', kcal: 260 }],
    })
    expect(report.folders.map((f) => f.title)).toEqual([
      '午餐营养素',
      '午餐热量',
      '午餐逐菜分析',
      '本餐营养核验',
    ])
  })
})
