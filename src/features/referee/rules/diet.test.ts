import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES } from '../defaults'
import type { DietDishFact } from '../schemas'
import { calcDietDayScore, dietScore, judgeDiet } from './diet'

/** Playbook diet-flow 的菜品库（与整页稿判例一致） */
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

const rice = dish('糙米杂粮饭', {
  kcal: 150,
  proteinG: 3.2,
  carbG: 31,
  fatG: 1.2,
  fiberG: 2.4,
  sodiumMg: 3,
  gi: 55,
})
const fish = dish('清蒸鲈鱼', { kcal: 140, proteinG: 27, fatG: 3, sodiumMg: 180 })
const broccoli = dish('蒜蓉西兰花', {
  kcal: 95,
  proteinG: 5,
  carbG: 10,
  fatG: 4,
  fiberG: 4.5,
  sodiumMg: 220,
  gi: 15,
})
const egg = dish('番茄炒蛋', {
  kcal: 160,
  proteinG: 10,
  carbG: 6,
  fatG: 11,
  fiberG: 1,
  sodiumMg: 380,
  gi: 30,
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
  kcal: 640,
  proteinG: 26,
  carbG: 92,
  fatG: 20,
  fiberG: 3,
  sodiumMg: 2100,
  gi: 80,
})
const gizzard = dish('藤椒鸡胗', {
  kcal: 220,
  proteinG: 8,
  carbG: 28,
  fatG: 8,
  fiberG: 2,
  sodiumMg: 400,
  gi: 50,
})
const chicken = dish('炸鸡腿', {
  kcal: 330,
  proteinG: 20,
  carbG: 15,
  fatG: 21,
  sodiumMg: 620,
  gi: 70,
  junk: true,
})
const cola = dish('冰镇含糖可乐', { kcal: 140, carbG: 35, sodiumMg: 10, gi: 63, junk: true })

const ctx = (dishes: DietDishFact[]) => ({
  rules: DEFAULT_RULES.diet,
  tier: 'balanced-glycemic' as const,
  facts: { module: 'diet' as const, dishes },
})
const subject = (mealType: 'lunch' | 'dinner', dishes: DietDishFact[]) => ({
  mealType,
  items: dishes.map((d) => ({ name: d.name, portion: d.portion, kcal: d.kcal })),
})

describe('饮食 5 分制', () => {
  it('A 清洁午餐：高分通过', () => {
    const v = judgeDiet(subject('lunch', [rice, fish, broccoli]), ctx([rice, fish, broccoli]))
    expect(v.score).toBe(4.8)
    expect(v.isValid).toBe(true)
    expect(v.offline).toBe(false)
  })

  it('B 炸鸡配可乐：一票否决 0 分', () => {
    const v = judgeDiet(subject('dinner', [chicken, cola]), ctx([chicken, cola]))
    expect(v.score).toBe(0)
    expect(v.isValid).toBe(false)
    expect(v.detail).toContain('一票否决')
  })

  it('C 午餐后小冰淇淋：擦线及格', () => {
    const v = judgeDiet(subject('lunch', [rice, egg, iceCream]), ctx([rice, egg, iceCream]))
    expect(v.score).toBe(3.3)
    expect(v.isValid).toBe(true)
  })

  it('同样的冰淇淋放到晚餐扣得更重', () => {
    expect(dietScore([rice, egg, iceCream], 'dinner', 'balanced-glycemic')).toBeLessThan(3)
  })

  it('D 红油牛肉面晚餐：钠高 + 晚间高 GI，不及格', () => {
    const v = judgeDiet(subject('dinner', [noodle, gizzard]), ctx([noodle, gizzard]))
    expect(v.score).toBe(2.4)
    expect(v.isValid).toBe(false)
    expect(v.checks.find((c) => c.id === 'sodium')?.ok).toBe(false)
  })

  it('体质档位：减脂严管比增肌温和更严', () => {
    const meal = [noodle]
    expect(dietScore(meal, 'dinner', 'strict-fat-loss')).toBeLessThan(
      dietScore(meal, 'dinner', 'gentle-gain'),
    )
  })

  it('分数线可调：3.5 分线下 C 不再通过', () => {
    const v = judgeDiet(subject('lunch', [rice, egg, iceCream]), {
      ...ctx([rice, egg, iceCream]),
      rules: { module: 'diet', passScore: 3.5 },
    })
    expect(v.isValid).toBe(false)
  })

  it('离线：没有营养事实时按名称识别一票否决', () => {
    const offline = { rules: DEFAULT_RULES.diet, tier: 'balanced-glycemic' as const, facts: null }
    const junk = judgeDiet(
      { mealType: 'dinner', items: [{ name: '香辣炸鸡', portion: '', kcal: null }] },
      offline,
    )
    expect(junk.isValid).toBe(false)
    expect(junk.offline).toBe(true)
    const clean = judgeDiet(
      { mealType: 'lunch', items: [{ name: '清蒸鱼', portion: '', kcal: null }] },
      offline,
    )
    expect(clean.isValid).toBe(true)
    expect(clean.score).toBeNull()
  })

  it('空腹：不扣纤维分且适当加分，减脂严管档加分更高；备注写空腹具有第一优先级', () => {
    const fasting = judgeDiet(
      { mealType: 'breakfast', items: [{ name: '空腹', portion: '', kcal: 0 }] },
      { rules: DEFAULT_RULES.diet, tier: 'strict-fat-loss', facts: null },
    )
    expect(fasting.isValid).toBe(true)
    expect(fasting.score).toBe(4.5)

    // 即使前面有菜品，只要备注写了「空腹」，以备注为第一核心优先级按空腹加分
    const noteOverride = judgeDiet(
      {
        mealType: 'dinner',
        items: [{ name: '红油牛肉面', portion: '1碗', kcal: 640 }],
        note: '今天晚上空腹没吃',
      },
      ctx([noodle]),
    )
    expect(noteOverride.isValid).toBe(true)
    expect(noteOverride.score).toBe(4.2)
  })

  it('食堂高钠轻扣：正常食堂饭菜钠超标仅微扣 0.2 分，仍顺利达标', () => {
    const canteenFish = dish('食堂红烧鱼', { kcal: 240, proteinG: 28, fatG: 10, sodiumMg: 1650 })
    const v = judgeDiet(
      subject('lunch', [rice, canteenFish, broccoli]),
      ctx([rice, canteenFish, broccoli]),
    )
    expect(v.score).toBeGreaterThanOrEqual(4.5)
    expect(v.isValid).toBe(true)
  })

  it('适量坚果加分 + 肥胖人群夜间精米白面扣分（土豆玉米不扣分）', () => {
    const nuts = dish('每日坚果', {
      kcal: 130,
      proteinG: 4,
      carbG: 5,
      fatG: 11,
      fiberG: 2,
      gi: 25,
      fatQuality: 'healthy',
    })
    expect(dietScore([rice, fish, nuts], 'lunch', 'balanced-glycemic')).toBeGreaterThan(
      dietScore([rice, fish], 'lunch', 'balanced-glycemic'),
    )

    const whiteRice = dish('大米饭', {
      kcal: 230,
      proteinG: 5,
      carbG: 50,
      gi: 83,
      carbQuality: 'refined',
    })
    const corn = dish('甜玉米', {
      kcal: 200,
      proteinG: 5,
      carbG: 42,
      fiberG: 4,
      gi: 55,
      carbQuality: 'complex',
    })
    expect(dietScore([whiteRice, fish, broccoli], 'dinner', 'strict-fat-loss')).toBeLessThan(
      dietScore([corn, fish, broccoli], 'dinner', 'strict-fat-loss'),
    )
  })

  it('备注「晚上没吃饭」优先修正照片里的米饭碳水与 GI', () => {
    const whiteRice = dish('大米饭', {
      kcal: 260,
      proteinG: 5,
      carbG: 56,
      gi: 85,
      carbQuality: 'refined',
    })
    const withoutNote = dietScore([whiteRice, fish, broccoli], 'dinner', 'strict-fat-loss')
    const withNote = dietScore(
      [whiteRice, fish, broccoli],
      'dinner',
      'strict-fat-loss',
      '食堂必须点饭，但我晚上没吃饭只吃了菜',
    )
    expect(withNote).toBeGreaterThan(withoutNote)
  })

  it('全天计分与加餐硬覆盖（calcDietDayScore）：三餐达标后劣质加餐直接硬覆盖为未达标', () => {
    // 仅打两餐时未满全天周期
    expect(calcDietDayScore({ breakfast: 4.2, lunch: 4.0 })).toEqual({
      ready: false,
      score: null,
      isValid: false,
    })
    // 三餐打完汇总达标
    const threeMeals = calcDietDayScore({ breakfast: 3.4, lunch: 3.2, dinner: 3.3 }, 3.0)
    expect(threeMeals.ready).toBe(true)
    expect(threeMeals.isValid).toBe(true)
    expect(threeMeals.score).toBe(3.3)

    // 加餐吃了炸鸡（0 分），重算后直接硬覆盖为失败打卡（无回退）
    const afterBadSnack = calcDietDayScore(
      { breakfast: 3.4, lunch: 3.2, dinner: 3.3, snacks: [0] },
      3.0,
    )
    expect(afterBadSnack.ready).toBe(true)
    expect(afterBadSnack.isValid).toBe(false)
    expect(afterBadSnack.score).toBe(1.8)
  })
})
