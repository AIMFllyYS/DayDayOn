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
 * 核心原则：
 * 1. 备注（note）为第一核心优先级：备注含「空腹」则整餐按空腹判定；备注含「没吃米饭 / 只吃菜」则剔除精制主食碳水。
 * 2. 空腹（isFasting / 标签「空腹」/ 备注「空腹」）：绝不扣分（豁免膳食纤维与蛋白门槛），并适当加分（减脂档 4.5 分，其余 4.2 分）。
 * 3. 钠（高钠饮食）：中国食堂普遍高钠，超过 1500mg 仅极轻微扣分（-0.2），不因盐多判不及格。
 * 4. 膳食纤维：充足摄入给予更高加分（>=5g +0.8，>=8g +1.0）。
 * 5. 脂肪类（如坚果）：适量优质油脂（fatQuality = 'healthy' 或坚果/牛油果/深海鱼且总脂肪 <=30g）加 +0.3 分；过量则扣分。
 * 6. 夜间碳水：仅针对肥胖/减脂人群（strict-fat-loss），晚餐/加餐摄入大米饭、精米白面等低质量碳水扣分；土豆、玉米等复合碳水不扣分。
 * 7. 全天周期结算与加餐硬覆盖（calcDietDayScore）：早+午+晚三餐打完算全天总分；加餐后重算并直接硬覆盖当日状态。
 */

export interface DietSubject {
  mealType: MealType
  items: { name: string; portion: string; kcal: number | null }[]
  /** 备注：第一核心优先级上下文 */
  note?: string | null
}

/** 名称里出现这些词就按一票否决处理（离线兜底，也给 Agent 做提示） */
export const JUNK_FOOD_RE =
  /炸鸡|汉堡|薯条|薯片|可乐|雪碧|芬达|奶茶|含糖饮料|碳酸饮料|炸串|鸡米花|辣条|方便面|泡面/

/** 空腹关键词（标签首位「空腹」或备注填写「空腹」） */
export const FASTING_RE = /空腹|轻断食|断食|未进食/

/** 备注声明未吃主食/米饭 */
export const NO_STAPLE_NOTE_RE = /没吃(米|白)?饭|只吃(了)?菜|不吃主食|未吃主食|没碰米饭/

/** 精米白面（低质量精制碳水） */
export const REFINED_CARB_RE =
  /米饭|白饭|大米|白粥|稀饭|白面|面条|挂面|拉面|牛肉面|米粉|河粉|米线|馒头|包子|白面包|吐司|年糕|凉皮/

/** 优质复合碳水（土豆、玉米、粗粮等，夜间摄入不按劣质精碳扣分） */
export const COMPLEX_CARB_RE = /糙米|杂粮|全麦|玉米|土豆|马铃薯|红薯|紫薯|山药|芋头|燕麦|荞麦|藜麦/

/** 坚果与优质油脂食物 */
export const HEALTHY_FAT_RE =
  /坚果|核桃|杏仁|巴旦木|腰果|开心果|夏威夷果|碧根果|松子|花生|牛油果|三文鱼|深海鱼|奇亚籽|亚麻籽/

export function isJunkName(name: string): boolean {
  return JUNK_FOOD_RE.test(name)
}

export function isFastingText(text: string | null | undefined): boolean {
  return Boolean(text && FASTING_RE.test(text))
}

export function isFastingSubject(
  subject: Pick<DietSubject, 'items' | 'note'>,
  dishes?: readonly DietDishFact[],
): boolean {
  if (isFastingText(subject.note)) return true
  if (subject.items.some((i) => isFastingText(i.name))) return true
  if (dishes && dishes.some((d) => d.isFasting || isFastingText(d.name))) return true
  return false
}

function isRefinedCarbDish(d: DietDishFact): boolean {
  if (d.carbG <= 10) return false
  if (d.carbQuality === 'complex' || COMPLEX_CARB_RE.test(d.name)) return false
  return d.carbQuality === 'refined' || REFINED_CARB_RE.test(d.name)
}

function isPureStapleCarbName(name: string): boolean {
  return /^(大|白)?米饭$|^白饭$|^白粥$|^馒头$|^白面条$/.test(name.trim())
}

/** 按备注第一优先级修正菜品事实（例如备注「我晚上没吃饭」时剔除照片里的米饭碳水与 GI） */
export function applyNoteToDishes(
  dishes: readonly DietDishFact[],
  note?: string | null,
): DietDishFact[] {
  if (!note || !NO_STAPLE_NOTE_RE.test(note)) return [...dishes]
  return dishes.map((d) =>
    isPureStapleCarbName(d.name) || (d.carbQuality === 'refined' && /米饭|白饭/.test(d.name))
      ? { ...d, kcal: 0, carbG: 0, gi: 0, carbQuality: 'none' as const }
      : d,
  )
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
  /** 晚间摄入低质量精制碳水扣分（肥胖/减脂人群重点扣分） */
  nightRefinedCarbPenalty: number
}

const TIER_WEIGHTS: Record<RefereeTier, TierWeights> = {
  'strict-fat-loss': {
    kcalMin: 300,
    kcalMax: 700,
    dinnerGiFrom: 70,
    dinnerGiPenalty: 0.8,
    sweetPenalty: 2,
    fatCap: 25,
    lowProteinPenalty: 0,
    nightRefinedCarbPenalty: 0.6,
  },
  'balanced-glycemic': {
    kcalMin: 350,
    kcalMax: 800,
    dinnerGiFrom: 70,
    dinnerGiPenalty: 0.6,
    sweetPenalty: 1,
    fatCap: Infinity,
    lowProteinPenalty: 0,
    nightRefinedCarbPenalty: 0,
  },
  'gentle-gain': {
    kcalMin: 450,
    kcalMax: 1000,
    dinnerGiFrom: 80,
    dinnerGiPenalty: 0.4,
    sweetPenalty: 0.8,
    fatCap: Infinity,
    lowProteinPenalty: 0.5,
    nightRefinedCarbPenalty: 0,
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

/** 空腹得分：绝不扣分，并在及格线（3.0）基础上加 1.2 ~ 1.5 分 */
export function fastingScore(tier: RefereeTier): number {
  return tier === 'strict-fat-loss' ? 4.5 : 4.2
}

/** 5 分制评分（已含体质档位与备注优先级修正），保留一位小数 */
export function dietScore(
  dishes: readonly DietDishFact[],
  mealType: MealType,
  tier: RefereeTier,
  note?: string | null,
): number {
  if (isFastingText(note) || dishes.some((d) => d.isFasting || isFastingText(d.name))) {
    return fastingScore(tier)
  }
  const effectiveDishes = applyNoteToDishes(dishes, note)
  if (effectiveDishes.length === 0 || effectiveDishes.some((d) => d.junk)) return 0

  const w = TIER_WEIGHTS[tier]
  const t = dietTotals(effectiveDishes)
  const lateMeal = mealType === 'dinner' || mealType === 'snack'
  let s = 2
  if (t.protein >= 10) s += 0.5
  if (t.protein >= 20) s += 0.5
  if (t.protein < 10) s -= w.lowProteinPenalty

  // 膳食纤维：>= 1g（含常规蔬菜/粗粮配菜）+0.4，>= 5g 再 +0.4（共 +0.8），>= 8g 再 +0.2（共 +1.0）
  if (t.fiber >= 1) s += 0.4
  if (t.fiber >= 5) s += 0.4
  if (t.fiber >= 8) s += 0.2

  // 升糖指数：低 GI（<=55）+0.6；常规主食配菜中低 GI（<=75 且未触发晚餐高 GI 线）+0.4
  if (t.gi <= 55) {
    s += 0.6
  } else if (t.gi <= 75 && !(mealType === 'dinner' && t.gi >= w.dinnerGiFrom)) {
    s += 0.4
  }

  const minKcal = mealType === 'breakfast' ? Math.min(w.kcalMin, 200) : Math.min(w.kcalMin, 300)
  if (t.kcal >= minKcal && t.kcal <= w.kcalMax) s += 0.4

  // 钠超标轻扣：中国食堂普遍钠偏高，仅轻扣 0.2 分，不重罚
  if (t.sodium > 1500) s -= 0.2

  // 脂肪类（如坚果）：适量优质油脂加分，过量扣分
  const hasHealthyFat = effectiveDishes.some(
    (d) => d.fatQuality === 'healthy' || HEALTHY_FAT_RE.test(d.name),
  )
  if (hasHealthyFat && t.fat <= 25) s += 0.3
  if (t.fat > w.fatCap || (hasHealthyFat && t.fat > 35)) s -= 0.5

  // 晚间高 GI 与肥胖人群夜间精制碳水扣分（土豆、玉米等复合碳水豁免）
  const hasRefinedNightCarb = lateMeal && effectiveDishes.some((d) => isRefinedCarbDish(d))
  const onlyComplexNightCarb =
    lateMeal &&
    effectiveDishes.every(
      (d) => d.carbG <= 10 || d.carbQuality === 'complex' || COMPLEX_CARB_RE.test(d.name),
    )

  if (mealType === 'dinner' && t.gi >= w.dinnerGiFrom && !onlyComplexNightCarb) {
    s -= w.dinnerGiPenalty
    if (hasRefinedNightCarb && t.sodium > 1500) s -= 0.6
  }
  if (hasRefinedNightCarb && w.nightRefinedCarbPenalty > 0) {
    s -= w.nightRefinedCarbPenalty
  }

  if (effectiveDishes.some((d) => d.sweet)) {
    s -= lateMeal ? w.sweetPenalty : round1(w.sweetPenalty * 0.6)
  }
  return Math.max(0, Math.min(5, round1(s)))
}

export interface DailyDietMeals {
  breakfast?: number | null
  lunch?: number | null
  dinner?: number | null
  snacks?: number[]
}

/**
 * 饮食全天计分（以天为点位）：
 * 1. 当早、午、晚三餐均打卡完毕后，汇总算出今日总分；
 * 2. 若有加餐，加餐直接重新计算并硬覆盖当日打卡总分与有效状态（无软覆盖、无回退）。
 */
export function calcDietDayScore(
  meals: DailyDietMeals,
  passScore = 3,
): { ready: boolean; score: number | null; isValid: boolean } {
  const { breakfast, lunch, dinner, snacks = [] } = meals
  if (
    breakfast === undefined ||
    breakfast === null ||
    lunch === undefined ||
    lunch === null ||
    dinner === undefined ||
    dinner === null
  ) {
    return { ready: false, score: null, isValid: false }
  }
  const baseAvg = (breakfast + lunch + dinner) / 3
  let snackDelta = 0
  for (const s of snacks) {
    if (s <= 0) {
      snackDelta -= 1.5
    } else if (s < passScore) {
      snackDelta -= round1((passScore - s) * 0.6)
    } else {
      snackDelta += 0.2
    }
  }
  const score = Math.max(0, Math.min(5, round1(baseAvg + snackDelta)))
  return {
    ready: true,
    score,
    isValid: score > passScore,
  }
}

export function judgeDiet(
  subject: DietSubject,
  ctx: JudgeContext<RulesOf<'diet'>, FactsOf<'diet'>>,
): Verdict {
  const { rules, facts, tier, extras } = ctx
  if (isFastingSubject(subject, facts?.dishes)) {
    const score = fastingScore(tier)
    const pass = rules.passScore.toFixed(1)
    return buildVerdict({
      isValid: score > rules.passScore,
      score,
      scoreMax: 5,
      detail: `本餐空腹轻断食，保持热量缺口加分，本餐 ${score.toFixed(1)} 分（超过 ${pass} 分有效线）`,
      checks: [
        { id: 'fasting', text: '空腹 / 轻断食控制热量摄入（免扣纤维分并加分）', ok: true },
        { id: 'no-junk', text: '没有一票否决食物', ok: true },
      ],
      metrics: {
        kcal: 0,
        protein: 0,
        carb: 0,
        fat: 0,
        fiber: 0,
        sodium: 0,
        gi: 0,
        dishes: subject.items.length,
        kcalMin: TIER_WEIGHTS[tier].kcalMin,
        kcalMax: TIER_WEIGHTS[tier].kcalMax,
        passScore: rules.passScore,
      },
      facts,
      advice: ['空腹期间注意补充温水或黑咖啡，下一餐先吃蔬菜和优质蛋白'],
      extras,
    })
  }

  if (facts === null) return judgeDietOffline(subject, rules, extras)

  const effectiveDishes = applyNoteToDishes(facts.dishes, subject.note)
  const t = dietTotals(effectiveDishes)
  const w = TIER_WEIGHTS[tier]
  const junk = effectiveDishes.filter((d) => d.junk)
  const score = dietScore(facts.dishes, subject.mealType, tier, subject.note)
  const isValid = score > rules.passScore
  const pass = rules.passScore.toFixed(1)

  const advice: string[] = []
  if (junk.length > 0) advice.push(`把「${junk[0]!.name}」换成清蒸或水煮的做法，这一餐就能及格`)
  if (t.protein < 15) advice.push('加一份鸡蛋、豆腐或瘦肉，蛋白质就够了')
  if (t.fiber < 5) advice.push('多一份深色蔬菜，先吃菜再吃主食，升糖更慢')
  if (
    tier === 'strict-fat-loss' &&
    (subject.mealType === 'dinner' || subject.mealType === 'snack') &&
    effectiveDishes.some((d) => isRefinedCarbDish(d))
  ) {
    advice.push('夜间尽量用玉米、土豆替代精米白面，减少晚间胆固醇与脂肪合成')
  }
  if (t.sodium > 1500) advice.push('食堂菜钠偏高很常见，少喝汤汁、多喝水帮助代谢即可')

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
      { id: 'sodium', text: '钠 ≤ 1500mg（超标仅轻扣）', ok: t.sodium <= 1500 },
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
      dishes: effectiveDishes.length,
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
