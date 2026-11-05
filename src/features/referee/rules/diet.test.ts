import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES } from '../defaults'
import type { DietDishFact } from '../schemas'
import { dietScore, judgeDiet } from './diet'

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
})
