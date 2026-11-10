import { describe, expect, it } from 'vitest'
import { dietDocs } from '@/features/checkin/modules/diet/docs'
import { DEFAULT_RULES } from '../defaults'
import type { DietDishFact } from '../schemas'
import type { MealType, PriorDietMeal } from './common'
import { evaluateDietDay, judgeDiet } from './diet'

function dish(name: string, p: Partial<DietDishFact>): DietDishFact {
  return {
    name,
    portion: '',
    kcal: 0,
    proteinG: 0,
    carbG: 0,
    fatG: 0,
    fiberG: 0,
    sodiumMg: 0,
    gi: 0,
    junk: false,
    sweet: false,
    isFasting: false,
    carbQuality: 'none',
    fatQuality: 'normal',
    cooking: 'other',
    source: 'table',
    ...p,
  }
}

function meal(
  mealType: MealType,
  dishes: DietDishFact[],
  note: string | null = null,
): PriorDietMeal {
  return {
    mealType,
    items: dishes.map((d) => ({ name: d.name, portion: d.portion, kcal: d.kcal })),
    note,
    dishes,
  }
}

const milk = dish('纯牛奶', { kcal: 135, proteinG: 8.2, carbG: 12, fatG: 8, gi: 28 })
const boiledEgg = dish('水煮蛋', { kcal: 85, proteinG: 7, fatG: 5.5 })
const smallCucumber = dish('拍黄瓜', { kcal: 40, proteinG: 1.5, carbG: 5, fiberG: 1.2, gi: 15 })
const rice = dish('糙米杂粮饭', {
  kcal: 150,
  proteinG: 3.2,
  carbG: 31,
  fatG: 1.2,
  fiberG: 2.4,
  sodiumMg: 3,
  gi: 55,
  carbQuality: 'complex',
})
const whiteRice = dish('白米饭', {
  kcal: 220,
  proteinG: 4.5,
  carbG: 48,
  fatG: 0.5,
  fiberG: 0,
  gi: 83,
  carbQuality: 'refined',
})
const fish = dish('清蒸鲈鱼', {
  kcal: 160,
  proteinG: 28,
  fatG: 3.5,
  sodiumMg: 180,
  fatQuality: 'healthy',
})
const chickenBreast = dish('香煎鸡胸肉', {
  kcal: 210,
  proteinG: 32,
  carbG: 1,
  fatG: 6,
  sodiumMg: 320,
})
const broccoli = dish('蒜蓉西兰花', {
  kcal: 95,
  proteinG: 5,
  carbG: 10,
  fatG: 4,
  fiberG: 6.5,
  sodiumMg: 220,
  gi: 15,
})
const tomatoEgg = dish('番茄炒蛋', {
  kcal: 160,
  proteinG: 10,
  carbG: 6,
  fatG: 11,
  fiberG: 1,
  sodiumMg: 380,
  gi: 30,
})
const corn = dish('甜玉米', {
  kcal: 190,
  proteinG: 5,
  carbG: 38,
  fatG: 2,
  fiberG: 4,
  gi: 55,
  carbQuality: 'complex',
})
const iceCream = dish('小冰淇淋', {
  kcal: 160,
  proteinG: 3,
  carbG: 20,
  fatG: 8,
  sodiumMg: 50,
  gi: 62,
  sweet: true,
})
const noodle = dish('红油牛肉面', {
  kcal: 680,
  proteinG: 24,
  carbG: 95,
  fatG: 24,
  fiberG: 2,
  sodiumMg: 2300,
  gi: 82,
  carbQuality: 'refined',
})
const friedChicken = dish('炸鸡腿', {
  kcal: 330,
  proteinG: 20,
  carbG: 15,
  fatG: 21,
  sodiumMg: 620,
  gi: 70,
  junk: true,
})
const cola = dish('冰镇含糖可乐', {
  kcal: 140,
  carbG: 35,
  sodiumMg: 10,
  gi: 63,
  junk: true,
  sweet: true,
})

describe('饮食两阶段生命周期（1/3 → 2/3 待汇总 → 3/3 全天总分结算）', () => {
  it('第 1 餐与第 2 餐返回 pending 态：不打单餐分、不判单餐死刑；第 3 餐集齐才产出全天总分', () => {
    // 1/3：仅记录早餐（哪怕只吃一颗 85 kcal 水煮蛋）
    const v1 = judgeDiet(
      { mealType: 'breakfast', items: [{ name: '水煮蛋', portion: '1颗', kcal: 85 }] },
      {
        rules: DEFAULT_RULES.diet,
        tier: 'strict-fat-loss',
        facts: { module: 'diet', dishes: [boiledEgg] },
        priorDietMeals: [],
      },
    )
    expect(v1.settlement).toBe('pending')
    expect(v1.score).toBeNull()
    expect(v1.isValid).toBe(false)
    expect(v1.metrics.mealsLogged).toBe(1)
    expect(v1.checks.every((c) => c.ok)).toBe(true)

    // 2/3：再记录午餐
    const v2 = judgeDiet(
      {
        mealType: 'lunch',
        items: [rice, fish, broccoli].map((d) => ({ name: d.name, portion: '', kcal: d.kcal })),
      },
      {
        rules: DEFAULT_RULES.diet,
        tier: 'strict-fat-loss',
        facts: { module: 'diet', dishes: [rice, fish, broccoli] },
        priorDietMeals: [meal('breakfast', [boiledEgg])],
      },
    )
    expect(v2.settlement).toBe('pending')
    expect(v2.score).toBeNull()
    expect(v2.isValid).toBe(false)
    expect(v2.metrics.mealsLogged).toBe(2)

    // 3/3：记录晚餐，集齐早+午+晚，立即结算全天总分
    const v3 = judgeDiet(
      {
        mealType: 'dinner',
        items: [corn, chickenBreast].map((d) => ({ name: d.name, portion: '', kcal: d.kcal })),
      },
      {
        rules: DEFAULT_RULES.diet,
        tier: 'strict-fat-loss',
        facts: { module: 'diet', dishes: [corn, chickenBreast] },
        priorDietMeals: [meal('breakfast', [boiledEgg]), meal('lunch', [rice, fish, broccoli])],
      },
    )
    expect(v3.settlement).toBe('settled')
    expect(v3.isValid).toBe(true)
    expect(v3.score).not.toBeNull()
    expect(v3.score!).toBeGreaterThanOrEqual(4.5)
    expect(v3.metrics.mealsLogged).toBe(3)
    expect(v3.metrics.breakfastKcal).toBe(85)
    expect(v3.metrics.lunchKcal).toBe(405)
    expect(v3.metrics.dinnerKcal).toBe(400)
    expect(v3.metrics.dailyKcal).toBe(890)
  })
})

describe('人群体质 × 极端真实饮食不变量矩阵', () => {
  it('肥胖/减脂严管档（strict-fat-loss）：吃 100 kcal 低卡餐或空腹绝不扣分反加分，高分通过', () => {
    // 早餐 85 kcal 水煮蛋 + 午餐 380 kcal 糙米番茄炒蛋 + 晚餐 125 kcal 水煮蛋配拍黄瓜（全天 590 kcal）
    const lowCalDay = judgeDiet(
      {
        mealType: 'dinner',
        items: [
          { name: '水煮蛋', portion: '1颗', kcal: 85 },
          { name: '拍黄瓜', portion: '1份', kcal: 40 },
        ],
      },
      {
        rules: DEFAULT_RULES.diet,
        tier: 'strict-fat-loss',
        facts: { module: 'diet', dishes: [boiledEgg, smallCucumber] },
        priorDietMeals: [meal('breakfast', [boiledEgg]), meal('lunch', [rice, tomatoEgg])],
      },
    )
    expect(lowCalDay.settlement).toBe('settled')
    expect(lowCalDay.isValid).toBe(true)
    expect(lowCalDay.score!).toBeGreaterThanOrEqual(4.3)
    expect(lowCalDay.checks.find((c) => c.id === 'kcal')?.ok).toBe(true)

    // 控制其他营养条件一致：将晚餐从 660 kcal 双主食换成 125 kcal 低卡蛋白蔬菜，减脂档制造热量缺口得分更高，绝不被反扣
    const higherCalDay = evaluateDietDay(
      [
        meal('breakfast', [milk, boiledEgg, corn, corn]),
        meal('lunch', [rice, tomatoEgg, corn, corn]),
        meal('dinner', [corn, corn, tomatoEgg]),
      ],
      DEFAULT_RULES.diet,
      'strict-fat-loss',
    )
    expect(higherCalDay.dailyTotals.kcal).toBeGreaterThan(1400)
    expect(lowCalDay.score!).toBeGreaterThanOrEqual(higherCalDay.score!)
  })

  it('偏瘦/增肌温和档（gentle-gain）：同样全天只吃 590 kcal 会因热量严重不足扣分拦截', () => {
    const leanUnderEating = evaluateDietDay(
      [
        meal('breakfast', [boiledEgg]),
        meal('lunch', [rice, tomatoEgg]),
        meal('dinner', [boiledEgg, smallCucumber]),
      ],
      DEFAULT_RULES.diet,
      'gentle-gain',
    )
    expect(leanUnderEating.ready).toBe(true)
    expect(leanUnderEating.score!).toBeLessThanOrEqual(3.0)
    expect(leanUnderEating.isValid).toBe(false)
    expect(leanUnderEating.checks.find((c) => c.id === 'kcal')?.ok).toBe(false)

    // 偏瘦增肌档吃够充足干净能量（>= 1600 kcal 且蛋白 >= 65g）则高分达标
    const leanEnough = evaluateDietDay(
      [
        meal('breakfast', [milk, boiledEgg, corn, corn]),
        meal('lunch', [whiteRice, fish, chickenBreast]),
        meal('dinner', [whiteRice, chickenBreast, corn]),
      ],
      DEFAULT_RULES.diet,
      'gentle-gain',
    )
    expect(leanEnough.isValid).toBe(true)
    expect(leanEnough.score!).toBeGreaterThanOrEqual(4.2)
  })

  it('零膳食纤维不扣分不变量：三餐纯肉蛋奶+米饭（0g 膳食纤维）照样高分通过，加蔬菜纯加分', () => {
    const zeroFiberMeals = [
      meal('breakfast', [milk, boiledEgg]),
      meal('lunch', [whiteRice, fish]),
      meal('dinner', [chickenBreast]),
    ]
    const zeroFiberEval = evaluateDietDay(zeroFiberMeals, DEFAULT_RULES.diet, 'balanced-glycemic')
    expect(zeroFiberEval.dailyTotals.fiber).toBe(0)
    expect(zeroFiberEval.isValid).toBe(true)
    expect(zeroFiberEval.score!).toBeGreaterThanOrEqual(4.2)
    expect(zeroFiberEval.checks.find((c) => c.id === 'fiber')?.ok).toBe(true)

    const withVeggies = evaluateDietDay(
      [
        meal('breakfast', [milk, boiledEgg]),
        meal('lunch', [whiteRice, fish, broccoli, broccoli]),
        meal('dinner', [chickenBreast, broccoli]),
      ],
      DEFAULT_RULES.diet,
      'balanced-glycemic',
    )
    expect(withVeggies.score!).toBeGreaterThan(zeroFiberEval.score!)
  })

  it('空腹标签与备注第一优先级：空腹计入已打餐次且不扣分；备注「没吃米饭」剔除精碳', () => {
    const fastingDinner = judgeDiet(
      {
        mealType: 'dinner',
        items: [{ name: '红油牛肉面', portion: '1碗', kcal: 680 }],
        note: '今天晚上空腹没吃',
      },
      {
        rules: DEFAULT_RULES.diet,
        tier: 'strict-fat-loss',
        facts: { module: 'diet', dishes: [noodle] },
        priorDietMeals: [meal('breakfast', [milk, boiledEgg]), meal('lunch', [rice, fish])],
      },
    )
    expect(fastingDinner.settlement).toBe('settled')
    expect(fastingDinner.isValid).toBe(true)
    expect(fastingDinner.metrics.dinnerKcal).toBe(0)
    expect(fastingDinner.score!).toBeGreaterThanOrEqual(4.5)

    // 备注「晚上没吃饭只吃了菜」剔除白米饭碳水与 GI
    const withoutNote = evaluateDietDay(
      [
        meal('breakfast', [milk, boiledEgg]),
        meal('lunch', [rice, fish]),
        meal('dinner', [whiteRice, fish, broccoli]),
      ],
      DEFAULT_RULES.diet,
      'strict-fat-loss',
    )
    const withNote = evaluateDietDay(
      [
        meal('breakfast', [milk, boiledEgg]),
        meal('lunch', [rice, fish]),
        meal('dinner', [whiteRice, fish, broccoli], '食堂打的套餐但我晚上没吃米饭只吃了菜'),
      ],
      DEFAULT_RULES.diet,
      'strict-fat-loss',
    )
    expect(withNote.score!).toBeGreaterThan(withoutNote.score!)
  })

  it('一票否决与加餐硬覆盖：三餐达标后夜宵吃炸鸡配可乐，全天总分硬覆盖为 0.0 分', () => {
    const baseThree = [
      meal('breakfast', [milk, boiledEgg]),
      meal('lunch', [rice, fish, broccoli]),
      meal('dinner', [corn, chickenBreast]),
    ]
    const beforeSnack = evaluateDietDay(baseThree, DEFAULT_RULES.diet, 'strict-fat-loss')
    expect(beforeSnack.isValid).toBe(true)
    expect(beforeSnack.score!).toBeGreaterThan(4)

    const afterJunkSnack = judgeDiet(
      {
        mealType: 'snack',
        items: [friedChicken, cola].map((d) => ({ name: d.name, portion: '', kcal: d.kcal })),
      },
      {
        rules: DEFAULT_RULES.diet,
        tier: 'strict-fat-loss',
        facts: { module: 'diet', dishes: [friedChicken, cola] },
        priorDietMeals: baseThree,
      },
    )
    expect(afterJunkSnack.settlement).toBe('settled')
    expect(afterJunkSnack.score).toBe(0)
    expect(afterJunkSnack.isValid).toBe(false)
    expect(afterJunkSnack.detail).toContain('一票否决')
  })

  it('甜点与夜间重油重盐精碳扣分：午间小冰淇淋擦线过，晚间叠加红油面 + 冰淇淋不及格', () => {
    const noonSweet = evaluateDietDay(
      [
        meal('breakfast', [milk, boiledEgg]),
        meal('lunch', [rice, tomatoEgg, iceCream]),
        meal('dinner', [corn, fish]),
      ],
      DEFAULT_RULES.diet,
      'balanced-glycemic',
    )
    expect(noonSweet.isValid).toBe(true)
    expect(noonSweet.score!).toBeGreaterThan(3)

    const badNight = evaluateDietDay(
      [
        meal('breakfast', [milk]),
        meal('lunch', [whiteRice, tomatoEgg]),
        meal('dinner', [noodle, iceCream]),
      ],
      DEFAULT_RULES.diet,
      'strict-fat-loss',
    )
    expect(badNight.score!).toBeLessThanOrEqual(3)
    expect(badNight.isValid).toBe(false)
  })

  it('离线三餐兜底：无营养事实时按名称识别一票否决，干净三餐离线记录有效', () => {
    const cleanOffline = judgeDiet(
      { mealType: 'dinner', items: [{ name: '清蒸鱼', portion: '', kcal: null }] },
      {
        rules: DEFAULT_RULES.diet,
        tier: 'balanced-glycemic',
        facts: null,
        priorDietMeals: [
          {
            mealType: 'breakfast',
            items: [{ name: '豆浆', portion: '', kcal: null }],
            dishes: null,
          },
          {
            mealType: 'lunch',
            items: [{ name: '番茄炒蛋', portion: '', kcal: null }],
            dishes: null,
          },
        ],
      },
    )
    expect(cleanOffline.settlement).toBe('settled')
    expect(cleanOffline.offline).toBe(true)
    expect(cleanOffline.isValid).toBe(true)
    expect(cleanOffline.score).toBeNull()

    const junkOffline = judgeDiet(
      { mealType: 'dinner', items: [{ name: '香辣炸鸡', portion: '', kcal: null }] },
      {
        rules: DEFAULT_RULES.diet,
        tier: 'balanced-glycemic',
        facts: null,
        priorDietMeals: [
          {
            mealType: 'breakfast',
            items: [{ name: '豆浆', portion: '', kcal: null }],
            dishes: null,
          },
          {
            mealType: 'lunch',
            items: [{ name: '番茄炒蛋', portion: '', kcal: null }],
            dishes: null,
          },
        ],
      },
    )
    expect(junkOffline.isValid).toBe(false)
    expect(junkOffline.score).toBe(0)
  })

  it('规则说明文档（dietDocs）与生产规则保持同源，不含旧版单餐走廊误导文案', () => {
    const docs = dietDocs(DEFAULT_RULES.diet)
    const fullText = JSON.stringify(docs)
    expect(fullText).toContain('三餐')
    expect(fullText).toContain('100 kcal')
    expect(fullText).toContain('绝不扣分')
    expect(fullText).not.toContain('300–700 kcal')
  })
})
