import type { DietDishFact, FactsOf, RefereeTier, RulesOf, Verdict } from '../schemas'
import {
  buildVerdict,
  round1,
  type JudgeContext,
  type MealType,
  type RefereeExtras,
} from './common'

/*
 * 好好吃饭：5 分制（checkin-modules.md 第 3 节，Playbook diet-flow 的 score()）。
 * 一票否决 → 0 分；否则基础 2.0 + 蛋白 + 纤维 + 低 GI + 热量走廊 − 钠 − 晚餐高 GI − 甜点，按体质档位调整。
 * 分数 > passScore（默认 3.0）才算有效。离线（没有营养事实）时只按名称识别一票否决食物。
 */

export interface DietSubject {
  mealType: MealType
  items: { name: string; portion: string; kcal: number | null }[]
}

/** 名称里出现这些词就按一票否决处理（离线兜底，也给 Agent 做提示） */
export const JUNK_FOOD_RE =
  /炸鸡|汉堡|薯条|薯片|可乐|雪碧|芬达|奶茶|含糖饮料|碳酸饮料|炸串|鸡米花|辣条|方便面|泡面/

export function isJunkName(name: string): boolean {
  return JUNK_FOOD_RE.test(name)
}

interface TierWeights {
  kcalMin: number
  kcalMax: number
  /** 晚餐综合 GI 达到这个值扣分 */
  dinnerGiFrom: number
  dinnerGiPenalty: number
  /** 晚餐 / 加餐吃甜点的扣分；正餐时段的一半 */
  sweetPenalty: number
  /** 脂肪超过这个克数扣 0.5；Infinity 表示不扣 */
  fatCap: number
  /** 蛋白不足 15g 额外扣分 */
  lowProteinPenalty: number
}

const TIER_WEIGHTS: Record<RefereeTier, TierWeights> = {
  'strict-fat-loss': {
    kcalMin: 300,
    kcalMax: 700,
    dinnerGiFrom: 70,
    dinnerGiPenalty: 1,
    sweetPenalty: 2,
    fatCap: 25,
    lowProteinPenalty: 0,
  },
  'balanced-glycemic': {
    kcalMin: 350,
    kcalMax: 800,
    dinnerGiFrom: 70,
    dinnerGiPenalty: 0.6,
    sweetPenalty: 1,
    fatCap: Infinity,
    lowProteinPenalty: 0,
  },
  'gentle-gain': {
    kcalMin: 450,
    kcalMax: 1000,
    dinnerGiFrom: 80,
    dinnerGiPenalty: 0.4,
    sweetPenalty: 0.8,
    fatCap: Infinity,
    lowProteinPenalty: 0.5,
  },
}

export function dietTotals(dishes: readonly DietDishFact[]) {
  const sum = (k: 'kcal' | 'proteinG' | 'carbG' | 'fatG' | 'fiberG' | 'sodiumMg') =>
    dishes.reduce((a, d) => a + d[k], 0)
  const carb = sum('carbG')
  const gi = carb > 0 ? Math.round(dishes.reduce((a, d) => a + d.gi * d.carbG, 0) / carb) : 0
  return {
    kcal: Math.round(sum('kcal')),
    protein: round1(sum('proteinG')),
    carb: round1(carb),
    fat: round1(sum('fatG')),
    fiber: round1(sum('fiberG')),
    sodium: Math.round(sum('sodiumMg')),
    gi,
  }
}

export function giBand(gi: number): 'low' | 'mid' | 'high' {
  if (gi <= 55) return 'low'
  if (gi < 70) return 'mid'
  return 'high'
}

/** 5 分制评分（已含体质档位），保留一位小数 */
export function dietScore(
  dishes: readonly DietDishFact[],
  mealType: MealType,
  tier: RefereeTier,
): number {
  if (dishes.length === 0 || dishes.some((d) => d.junk)) return 0
  const w = TIER_WEIGHTS[tier]
  const t = dietTotals(dishes)
  const lateMeal = mealType === 'dinner' || mealType === 'snack'
  let s = 2
  if (t.protein >= 15) s += 0.5
  if (t.protein >= 25) s += 0.5
  if (t.protein < 15) s -= w.lowProteinPenalty
  if (t.fiber >= 5) s += 0.8
  if (t.gi <= 55) s += 0.6
  if (t.kcal >= w.kcalMin && t.kcal <= w.kcalMax) s += 0.4
  if (t.sodium > 1500) s -= 0.8
  if (t.fat > w.fatCap) s -= 0.5
  if (mealType === 'dinner' && t.gi >= w.dinnerGiFrom) s -= w.dinnerGiPenalty
  if (dishes.some((d) => d.sweet)) s -= lateMeal ? w.sweetPenalty : w.sweetPenalty / 5
  return Math.max(0, Math.min(5, round1(s)))
}

export function judgeDiet(
  subject: DietSubject,
  ctx: JudgeContext<RulesOf<'diet'>, FactsOf<'diet'>>,
): Verdict {
  const { rules, facts, tier, extras } = ctx
  if (facts === null) return judgeDietOffline(subject, rules, extras)

  const dishes = facts.dishes
  const t = dietTotals(dishes)
  const w = TIER_WEIGHTS[tier]
  const junk = dishes.filter((d) => d.junk)
  const score = dietScore(dishes, subject.mealType, tier)
  const isValid = score > rules.passScore
  const pass = rules.passScore.toFixed(1)

  const advice: string[] = []
  if (junk.length > 0) advice.push(`把「${junk[0]!.name}」换成清蒸或水煮的做法，这一餐就能及格`)
  if (t.protein < 15) advice.push('加一份鸡蛋、豆腐或瘦肉，蛋白质就够了')
  if (t.fiber < 5) advice.push('多一份深色蔬菜，先吃菜再吃主食，升糖更慢')
  if (t.sodium > 1500) advice.push('汤和红油少喝一点，钠能降一半')

  return buildVerdict({
    isValid,
    score,
    scoreMax: 5,
    detail:
      junk.length > 0
        ? `含「${junk.map((d) => d.name).join('、')}」，一票否决，本餐 0 分`
        : isValid
          ? `本餐 ${score.toFixed(1)} 分，超过 ${pass} 分有效线`
          : `本餐 ${score.toFixed(1)} 分，未达 ${pass} 分有效线`,
    checks: [
      { id: 'no-junk', text: '没有一票否决食物', ok: junk.length === 0 },
      {
        id: 'kcal',
        text: `热量在本餐走廊内（${w.kcalMin}–${w.kcalMax} kcal）`,
        ok: t.kcal >= w.kcalMin && t.kcal <= w.kcalMax,
      },
      { id: 'protein', text: '优质蛋白 ≥ 15g', ok: t.protein >= 15 },
      { id: 'fiber', text: '膳食纤维 ≥ 5g', ok: t.fiber >= 5 },
      { id: 'sodium', text: '钠 ≤ 1500mg', ok: t.sodium <= 1500 },
      {
        id: 'gi',
        text: subject.mealType === 'dinner' ? '晚餐综合 GI 不高' : '综合 GI 不高',
        ok: t.gi < 70,
        source: '《中国居民膳食指南（2022）》· 中国食物成分表',
      },
    ],
    metrics: {
      kcal: t.kcal,
      protein: t.protein,
      carb: t.carb,
      fat: t.fat,
      fiber: t.fiber,
      sodium: t.sodium,
      gi: t.gi,
      dishes: dishes.length,
      kcalMin: w.kcalMin,
      kcalMax: w.kcalMax,
      passScore: rules.passScore,
    },
    facts,
    advice,
    extras,
  })
}

function judgeDietOffline(
  subject: DietSubject,
  rules: RulesOf<'diet'>,
  extras: RefereeExtras | undefined,
): Verdict {
  const junk = subject.items.filter((i) => isJunkName(i.name))
  const kcal = subject.items.reduce((a, i) => a + (i.kcal ?? 0), 0)
  return buildVerdict({
    isValid: junk.length === 0,
    score: junk.length > 0 ? 0 : null,
    scoreMax: 5,
    detail:
      junk.length > 0
        ? `含「${junk.map((i) => i.name).join('、')}」，一票否决`
        : '这次没经过 Agent 评分，按诚实记录保存',
    checks: [{ id: 'no-junk', text: '没有一票否决食物', ok: junk.length === 0 }],
    metrics: {
      kcal: kcal > 0 ? kcal : null,
      dishes: subject.items.length,
      passScore: rules.passScore,
    },
    facts: null,
    advice: junk.length > 0 ? ['换成清蒸、水煮或少油快炒的做法再试试'] : [],
    extras,
  })
}
