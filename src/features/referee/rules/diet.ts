import type { Check, DietDishFact, FactsOf, RefereeTier, RulesOf, Verdict } from '../schemas'
import {
  buildVerdict,
  round1,
  type JudgeContext,
  type MealType,
  type PriorDietMeal,
} from './common'

/*
 * 好好吃饭：全天三餐统一评分体系（5 分制，三餐集齐结算 + 加餐硬覆盖）。
 *
 * 核心原则：
 * 1. 两阶段生命周期：
 *    - 未集齐早、午、晚三顿正餐时（1/3、2/3）：处于 pending 阶段态，只解析记录当餐营养，不打单餐分（score = null），不判单餐及格/不及格。
 *    - 集齐早、午、晚三餐后（3/3，及后续加餐/修改）：合并全天所有餐次统一计算今日总分（0.0–5.0），决定当日 isValid。
 * 2. 干净饮食基础分 3.8 分（天然高于默认 3.0 有效线），彻底杜绝「底分 2.0 导致少拿加分项变相不及格」的陷阱。
 * 3. 热量走廊严格按人群体质区分方向：
 *    - 肥胖/减脂严管（strict-fat-loss）：不设热量下限死线！单餐吃 100 kcal 或「空腹」均属控卡制造热量缺口，给予正向加分（+0.3 ~ +0.5），绝不扣分、绝不标未通过；仅超上限扣分。
 *    - 标准/控糖均衡（balanced-glycemic）：单餐少吃或空腹绝不扣分；全天热量适中给加分，过量轻扣。
 *    - 偏瘦/增肌温和（gentle-gain）：全天热量过低（< 1600 kcal）或蛋白不足（< 45g）属于能量亏空，按增肌需求扣分提醒。
 * 4. 膳食纤维纯奖励制：全天累计纤维达标给予额外加分（>=10g +0.2，>=18g +0.4），缺纤维 0 扣分、绝不在校验清单标红叉。
 * 5. 备注（note）第一核心优先级：备注含「空腹」按空腹判定；含「没吃米饭/只吃菜」剔除精制主食碳水与 GI。
 */

export interface DietSubject {
  mealType: MealType
  items: { name: string; portion: string; kcal: number | null }[]
  /** 备注：第一核心优先级上下文 */
  note?: string | null
}

const MEAL_NAME: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
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
  dishes?: readonly DietDishFact[] | null,
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

export interface DietTierConfig {
  /** 单餐参考热量下限（减脂档为 0：吃少/空腹不设下限死线） */
  mealKcalMin: number
  /** 单餐参考热量上限 */
  mealKcalMax: number
  /** 全天参考热量下限（减脂档为 0） */
  dailyKcalMin: number
  /** 全天参考热量上限 */
  dailyKcalMax: number
  /** 晚餐综合 GI 触发线 */
  dinnerGiFrom: number
  dinnerGiPenalty: number
  /** 日间（早/午）与晚间（晚/加餐）甜点扣分 */
  daySweetPenalty: number
  nightSweetPenalty: number
  /** 全天脂肪上限与超标扣分 */
  fatCapDaily: number
  fatOverPenalty: number
  /** 全天蛋白不足 45g 扣分（仅增肌温和档扣分，减脂/控糖档为 0） */
  lowProteinPenalty: number
  /** 晚间精制碳水扣分（仅减脂严管档重点扣分） */
  nightRefinedCarbPenalty: number
}

export const TIER_CONFIG: Record<RefereeTier, DietTierConfig> = {
  'strict-fat-loss': {
    mealKcalMin: 0,
    mealKcalMax: 700,
    dailyKcalMin: 0,
    dailyKcalMax: 1800,
    dinnerGiFrom: 70,
    dinnerGiPenalty: 0.5,
    daySweetPenalty: 0.7,
    nightSweetPenalty: 1.5,
    fatCapDaily: 65,
    fatOverPenalty: 0.4,
    lowProteinPenalty: 0,
    nightRefinedCarbPenalty: 0.5,
  },
  'balanced-glycemic': {
    mealKcalMin: 0,
    mealKcalMax: 800,
    dailyKcalMin: 1100,
    dailyKcalMax: 2100,
    dinnerGiFrom: 70,
    dinnerGiPenalty: 0.4,
    daySweetPenalty: 0.6,
    nightSweetPenalty: 1.1,
    fatCapDaily: 80,
    fatOverPenalty: 0.3,
    lowProteinPenalty: 0,
    nightRefinedCarbPenalty: 0,
  },
  'gentle-gain': {
    mealKcalMin: 400,
    mealKcalMax: 1000,
    dailyKcalMin: 1600,
    dailyKcalMax: 2800,
    dinnerGiFrom: 80,
    dinnerGiPenalty: 0.3,
    daySweetPenalty: 0.4,
    nightSweetPenalty: 0.8,
    fatCapDaily: Infinity,
    fatOverPenalty: 0,
    lowProteinPenalty: 0.4,
    nightRefinedCarbPenalty: 0,
  },
}

export interface NutritionTotals {
  kcal: number
  protein: number
  carb: number
  fat: number
  fiber: number
  sodium: number
  gi: number
}

export function dietTotals(dishes: readonly DietDishFact[]): NutritionTotals {
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

interface NormalizedMeal {
  mealType: MealType
  isFasting: boolean
  offline: boolean
  dishes: DietDishFact[]
  totals: NutritionTotals
  junkNames: string[]
  hasSweet: boolean
  hasHealthyFat: boolean
  hasRefinedCarb: boolean
  onlyComplexCarb: boolean
}

function normalizeMeal(m: PriorDietMeal): NormalizedMeal {
  if (isFastingSubject(m, m.dishes)) {
    return {
      mealType: m.mealType,
      isFasting: true,
      offline: false,
      dishes: [],
      totals: { kcal: 0, protein: 0, carb: 0, fat: 0, fiber: 0, sodium: 0, gi: 0 },
      junkNames: [],
      hasSweet: false,
      hasHealthyFat: false,
      hasRefinedCarb: false,
      onlyComplexCarb: true,
    }
  }
  if (m.dishes === null) {
    const junkNames = m.items.filter((i) => isJunkName(i.name)).map((i) => i.name)
    const kcal = m.items.reduce((s, i) => s + (i.kcal ?? 0), 0)
    return {
      mealType: m.mealType,
      isFasting: false,
      offline: true,
      dishes: [],
      totals: { kcal, protein: 0, carb: 0, fat: 0, fiber: 0, sodium: 0, gi: 0 },
      junkNames,
      hasSweet: false,
      hasHealthyFat: m.items.some((i) => HEALTHY_FAT_RE.test(i.name)),
      hasRefinedCarb: false,
      onlyComplexCarb: false,
    }
  }
  const effective = applyNoteToDishes(m.dishes, m.note)
  const totals = dietTotals(effective)
  const junkNames = effective.filter((d) => d.junk || isJunkName(d.name)).map((d) => d.name)
  return {
    mealType: m.mealType,
    isFasting: false,
    offline: false,
    dishes: effective,
    totals,
    junkNames,
    hasSweet: effective.some((d) => d.sweet),
    hasHealthyFat: effective.some((d) => d.fatQuality === 'healthy' || HEALTHY_FAT_RE.test(d.name)),
    hasRefinedCarb: effective.some((d) => isRefinedCarbDish(d)),
    onlyComplexCarb: effective.every(
      (d) => d.carbG <= 10 || d.carbQuality === 'complex' || COMPLEX_CARB_RE.test(d.name),
    ),
  }
}

/** 合并当日已有餐次与本次提交餐次（同餐次覆盖更新） */
export function mergeDietMeals(
  priorMeals: readonly PriorDietMeal[],
  current: PriorDietMeal,
): PriorDietMeal[] {
  return [...priorMeals.filter((m) => m.mealType !== current.mealType), current]
}

export interface DietDaySummary {
  ready: boolean
  mealsLogged: number
  missingMeals: MealType[]
  offlineAll: boolean
  score: number | null
  isValid: boolean
  detail: string
  checks: Check[]
  advice: string[]
  dailyTotals: NutritionTotals
  mealKcals: {
    breakfast: number | null
    lunch: number | null
    dinner: number | null
    snack: number | null
  }
  snackCount: number
}

/**
 * 全天饮食统一结算纯函数：
 * - 早、午、晚三顿正餐未齐时：ready = false, score = null, isValid = false；
 * - 三顿正餐齐备后（含后续加餐）：合并全天菜品与各时段节律算出唯一全天总分（0.0–5.0）。
 */
export function evaluateDietDay(
  meals: readonly PriorDietMeal[],
  rules: RulesOf<'diet'>,
  tier: RefereeTier,
): DietDaySummary {
  const normalized = meals.map(normalizeMeal)
  const byType = (t: MealType) => normalized.filter((m) => m.mealType === t)
  const breakfast = byType('breakfast')[0] ?? null
  const lunch = byType('lunch')[0] ?? null
  const dinner = byType('dinner')[0] ?? null
  const snacks = byType('snack')

  const missingMeals: MealType[] = []
  if (!breakfast) missingMeals.push('breakfast')
  if (!lunch) missingMeals.push('lunch')
  if (!dinner) missingMeals.push('dinner')
  const mealsLogged = 3 - missingMeals.length

  const allDishes = normalized.flatMap((m) => m.dishes)
  const combinedTotals = dietTotals(allDishes)
  const totalKcal = normalized.reduce((s, m) => s + m.totals.kcal, 0)
  const dailyTotals: NutritionTotals = {
    ...combinedTotals,
    kcal: totalKcal,
  }
  const mealKcals = {
    breakfast: breakfast ? breakfast.totals.kcal : null,
    lunch: lunch ? lunch.totals.kcal : null,
    dinner: dinner ? dinner.totals.kcal : null,
    snack: snacks.length > 0 ? snacks.reduce((s, m) => s + m.totals.kcal, 0) : null,
  }

  if (missingMeals.length > 0) {
    return {
      ready: false,
      mealsLogged,
      missingMeals,
      offlineAll: false,
      score: null,
      isValid: false,
      detail: `今日已记 ${mealsLogged}/3 正餐，待记录${missingMeals.map((m) => MEAL_NAME[m]).join('、')}后统一结算总分`,
      checks: [],
      advice: [],
      dailyTotals,
      mealKcals,
      snackCount: snacks.length,
    }
  }

  const w = TIER_CONFIG[tier]
  const pass = rules.passScore.toFixed(1)
  const allJunk = [...new Set(normalized.flatMap((m) => m.junkNames))]

  if (allJunk.length > 0) {
    return {
      ready: true,
      mealsLogged: 3,
      missingMeals: [],
      offlineAll: false,
      score: 0,
      isValid: false,
      detail: `今日饮食含「${allJunk.join('、')}」，触发一票否决，全天总分 0.0 分`,
      checks: [{ id: 'no-junk', text: `含一票否决食物（${allJunk.join('、')}）`, ok: false }],
      advice: [`把「${allJunk[0]}」换成清蒸、水煮或无糖饮品，明天就能稳稳达标`],
      dailyTotals,
      mealKcals,
      snackCount: snacks.length,
    }
  }

  // 三餐全部为离线无营养事实记录（如 AI 暂停且非空腹、无垃圾食品）
  const hasAnyAnalyzedOrFasting = normalized.some((m) => !m.offline || m.isFasting)
  if (!hasAnyAnalyzedOrFasting) {
    return {
      ready: true,
      mealsLogged: 3,
      missingMeals: [],
      offlineAll: true,
      score: null,
      isValid: true,
      detail: '今日三餐已完整记录（离线模式未估算营养分，无一票否决食物，计入有效打卡）',
      checks: [{ id: 'no-junk', text: '全天没有一票否决食物', ok: true }],
      advice: [],
      dailyTotals,
      mealKcals,
      snackCount: snacks.length,
    }
  }

  // 干净饮食基础分：3.8 分（天然高于默认 3.0 有效线，不因缺加分项而莫名挂科）
  let s = 3.8
  const advice: string[] = []
  const checks: Check[] = [{ id: 'no-junk', text: '全天无一票否决超加工食物', ok: true }]

  // 1. 全天热量走廊与人群差异化判定
  const mainMeals = [breakfast!, lunch!, dinner!]
  const hasLightOrFastingMeal = mainMeals.some((m) => m.isFasting || m.totals.kcal <= 220)
  const anyMealBinge = normalized.some((m) => m.totals.kcal > w.mealKcalMax + 50)

  if (tier === 'strict-fat-loss') {
    if (dailyTotals.kcal <= w.dailyKcalMax) {
      if (dailyTotals.kcal <= 1350 || hasLightOrFastingMeal) {
        s += 0.5
        checks.push({
          id: 'kcal',
          text: `全天控卡保持热量缺口（${dailyTotals.kcal} kcal ≤ ${w.dailyKcalMax} kcal，减脂加分）`,
          ok: true,
        })
      } else {
        s += 0.2
        checks.push({
          id: 'kcal',
          text: `全天热量控制在减脂上限内（${dailyTotals.kcal} / ${w.dailyKcalMax} kcal）`,
          ok: true,
        })
      }
    } else {
      s -= 0.6
      checks.push({
        id: 'kcal',
        text: `全天热量超出减脂上限（${dailyTotals.kcal} > ${w.dailyKcalMax} kcal）`,
        ok: false,
      })
      advice.push('减脂期注意控制全天总热量，晚餐可适当减少主食或油水')
    }
    if (anyMealBinge) s -= 0.3
  } else if (tier === 'balanced-glycemic') {
    if (dailyTotals.kcal <= w.dailyKcalMax) {
      if (dailyTotals.kcal >= w.dailyKcalMin) s += 0.25
      checks.push({
        id: 'kcal',
        text: `全天热量未超标（${dailyTotals.kcal} kcal，参考上限 ${w.dailyKcalMax} kcal）`,
        ok: true,
      })
    } else {
      s -= 0.4
      checks.push({
        id: 'kcal',
        text: `全天热量偏高（${dailyTotals.kcal} > ${w.dailyKcalMax} kcal）`,
        ok: false,
      })
    }
  } else {
    // gentle-gain（偏瘦 / 增肌温和）：热量吃太少会扣分！
    if (dailyTotals.kcal < 1200) {
      s -= 0.8
      checks.push({
        id: 'kcal',
        text: `增肌期全天热量严重不足（${dailyTotals.kcal} < ${w.dailyKcalMin} kcal）`,
        ok: false,
      })
      advice.push('偏瘦/增肌期热量亏空会影响恢复，建议增加复合碳水与优质蛋白份量')
    } else if (dailyTotals.kcal < w.dailyKcalMin) {
      s -= 0.4
      checks.push({
        id: 'kcal',
        text: `增肌期全天热量略偏低（${dailyTotals.kcal} < ${w.dailyKcalMin} kcal）`,
        ok: false,
      })
      advice.push('可以适当加一份燕麦、红薯或牛奶，补足增肌所需能量')
    } else if (dailyTotals.kcal <= w.dailyKcalMax) {
      s += 0.3
      checks.push({
        id: 'kcal',
        text: `全天热量满足增肌需求（${dailyTotals.kcal} kcal，走廊 ${w.dailyKcalMin}–${w.dailyKcalMax} kcal）`,
        ok: true,
      })
    } else {
      s -= 0.3
      checks.push({
        id: 'kcal',
        text: `全天热量超出上限（${dailyTotals.kcal} > ${w.dailyKcalMax} kcal）`,
        ok: false,
      })
    }
  }

  // 2. 优质蛋白质（全天累计；仅增肌档对低蛋白扣分，减脂/控糖档不扣分）
  if (dailyTotals.protein >= 65) {
    s += 0.4
    checks.push({ id: 'protein', text: `全天优质蛋白充沛（${dailyTotals.protein}g）`, ok: true })
  } else if (dailyTotals.protein >= 45) {
    s += 0.2
    checks.push({ id: 'protein', text: `全天蛋白质达标（${dailyTotals.protein}g）`, ok: true })
  } else if (w.lowProteinPenalty > 0) {
    s -= w.lowProteinPenalty
    checks.push({
      id: 'protein',
      text: `增肌期全天蛋白偏少（${dailyTotals.protein}g < 45g）`,
      ok: false,
    })
    advice.push('每天多加鸡蛋、牛奶、鱼虾或豆制品，帮助肌肉合成')
  } else {
    checks.push({
      id: 'protein',
      text: `全天蛋白质 ${dailyTotals.protein}g`,
      ok: true,
    })
  }

  // 3. 膳食纤维：纯奖励制，缺纤维绝不扣分、绝不标失败！
  if (dailyTotals.fiber >= 18) {
    s += 0.4
    checks.push({
      id: 'fiber',
      text: `全天膳食纤维充足奖励（${dailyTotals.fiber}g，+0.4 分）`,
      ok: true,
    })
  } else if (dailyTotals.fiber >= 10) {
    s += 0.2
    checks.push({
      id: 'fiber',
      text: `全天含蔬果粗粮纤维奖励（${dailyTotals.fiber}g，+0.2 分）`,
      ok: true,
    })
  } else {
    checks.push({
      id: 'fiber',
      text: `全天膳食纤维 ${dailyTotals.fiber}g（纯加分项，不扣分）`,
      ok: true,
    })
  }

  // 4. 升糖节律与晚间精制碳水控制
  if (dailyTotals.gi > 0 && dailyTotals.gi <= 55) {
    s += 0.2
  }
  const lateMeals = [dinner!, ...snacks]
  const hasLateRefinedCarb = lateMeals.some((m) => m.hasRefinedCarb)
  const dinnerHighGi =
    !dinner!.isFasting && dinner!.totals.gi >= w.dinnerGiFrom && !dinner!.onlyComplexCarb

  if (dinnerHighGi) {
    s -= w.dinnerGiPenalty
    if (dinner!.hasRefinedCarb && dinner!.totals.sodium > 1800) {
      s -= 0.4
    }
  }
  if (hasLateRefinedCarb && w.nightRefinedCarbPenalty > 0) {
    s -= w.nightRefinedCarbPenalty
    advice.push('晚间尽量用玉米、土豆、红薯替代精米白面，减少夜间脂肪合成')
  }
  const giOk = !dinnerHighGi && !(hasLateRefinedCarb && w.nightRefinedCarbPenalty > 0)
  checks.push({
    id: 'gi',
    text: giOk ? '全天升糖节律与晚间碳水控制良好' : '晚间高 GI 或精制碳水偏多',
    ok: giOk,
    source: '《中国居民膳食指南（2022）》· 中国食物成分表',
  })

  // 5. 优质油脂奖励 vs 过量脂肪扣分
  const hasHealthyFat = normalized.some((m) => m.hasHealthyFat)
  if (hasHealthyFat && dailyTotals.fat <= w.fatCapDaily) {
    s += 0.2
  }
  if (dailyTotals.fat > w.fatCapDaily) {
    s -= w.fatOverPenalty
    advice.push('今天油脂摄入偏高，明天可多选清蒸、白灼做法')
  }

  // 6. 钠含量（兼顾中国食堂实际：全天突破 4500mg 或单顿重盐汤面 > 2000mg 才微扣）
  const sodiumLimit = tier === 'gentle-gain' ? 5000 : 4500
  const heavySaltDinner = dinner!.totals.sodium > 2000 && dinner!.hasRefinedCarb
  if (dailyTotals.sodium > sodiumLimit || heavySaltDinner) {
    s -= 0.2
    checks.push({
      id: 'sodium',
      text: `钠含量偏高（全天 ${dailyTotals.sodium}mg，轻扣 0.2 分）`,
      ok: false,
    })
    advice.push('餐饮钠偏高时少喝浓汤红油、多喝温水帮助代谢即可')
  } else {
    checks.push({
      id: 'sodium',
      text: `全天钠摄入可控（${dailyTotals.sodium}mg）`,
      ok: true,
    })
  }

  // 7. 甜点解馋扣分（晚间及加餐扣得比日间更重）
  for (const m of normalized) {
    if (!m.hasSweet) continue
    const late = m.mealType === 'dinner' || m.mealType === 'snack'
    s -= late ? w.nightSweetPenalty : w.daySweetPenalty
  }

  const score = Math.max(0, Math.min(5, round1(s)))
  const isValid = score > rules.passScore
  return {
    ready: true,
    mealsLogged: 3,
    missingMeals: [],
    offlineAll: false,
    score,
    isValid,
    detail: isValid
      ? `今日三餐打卡完成！全天总分 ${score.toFixed(1)} 分（超过 ${pass} 分有效线）`
      : `今日三餐已汇总，全天总分 ${score.toFixed(1)} 分（未达 ${pass} 分有效线）`,
    checks,
    advice,
    dailyTotals,
    mealKcals,
    snackCount: snacks.length,
  }
}

/** 构造单餐待汇总态（1/3 或 2/3）的校验清单：只展示本餐营养事实，绝不因低卡（减脂）或少纤维标红叉 */
function buildPendingMealChecks(
  current: NormalizedMeal,
  tier: RefereeTier,
): { checks: Check[]; advice: string[] } {
  const w = TIER_CONFIG[tier]
  const advice: string[] = []
  if (current.junkNames.length > 0) {
    return {
      checks: [
        {
          id: 'no-junk',
          text: `含一票否决食物（${current.junkNames.join('、')}），三餐汇总时将触发 0 分`,
          ok: false,
        },
      ],
      advice: [`「${current.junkNames[0]}」属于超加工高糖高脂食物，下次换成清蒸或无糖款吧`],
    }
  }
  if (current.isFasting) {
    return {
      checks: [
        {
          id: 'fasting',
          text:
            tier === 'gentle-gain'
              ? '本餐空腹未进食（偏瘦/增肌期请在其余餐次补足能量）'
              : '本餐空腹轻断食（保持热量缺口，全天汇总时加分且不扣分）',
          ok: tier !== 'gentle-gain',
        },
        { id: 'no-junk', text: '无一票否决超加工食物', ok: true },
      ],
      advice:
        tier === 'gentle-gain'
          ? ['增肌期尽量规律三餐，避免全天总热量不足']
          : ['空腹期间多喝温水，下一餐先吃蛋白质和蔬菜更稳血糖'],
    }
  }
  if (current.offline) {
    return {
      checks: [{ id: 'no-junk', text: '没有一票否决食物', ok: true }],
      advice: [],
    }
  }

  const t = current.totals
  const checks: Check[] = [{ id: 'no-junk', text: '本餐无一票否决食物', ok: true }]
  if (tier === 'strict-fat-loss') {
    checks.push({
      id: 'kcal',
      text:
        t.kcal <= 220
          ? `本餐低热量控卡（${t.kcal} kcal，减脂热量缺口加分项）`
          : t.kcal <= w.mealKcalMax
            ? `本餐热量可控（${t.kcal} kcal ≤ ${w.mealKcalMax} kcal）`
            : `本餐热量偏高（${t.kcal} > ${w.mealKcalMax} kcal）`,
      ok: t.kcal <= w.mealKcalMax,
    })
  } else if (tier === 'gentle-gain' && current.mealType !== 'snack') {
    checks.push({
      id: 'kcal',
      text:
        t.kcal >= 350
          ? `本餐能量充足（${t.kcal} kcal）`
          : `本餐热量偏少（${t.kcal} kcal，其余餐次注意补足能量）`,
      ok: t.kcal >= 250,
    })
  } else {
    checks.push({
      id: 'kcal',
      text: `本餐热量 ${t.kcal} kcal（上限参考 ${w.mealKcalMax} kcal）`,
      ok: t.kcal <= w.mealKcalMax,
    })
  }

  checks.push({
    id: 'macro',
    text: `蛋白质 ${t.protein}g · 膳食纤维 ${t.fiber}g（全天累计加分，缺纤维不扣分）`,
    ok: true,
  })

  const late = current.mealType === 'dinner' || current.mealType === 'snack'
  const badLateCarb = late && tier === 'strict-fat-loss' && current.hasRefinedCarb
  checks.push({
    id: 'gi',
    text: badLateCarb ? '晚间含精制主食碳水（建议换粗粮）' : `综合 GI ${t.gi}（升糖平稳）`,
    ok:
      !badLateCarb &&
      !(current.mealType === 'dinner' && t.gi >= w.dinnerGiFrom && !current.onlyComplexCarb),
  })
  return { checks, advice }
}

export function judgeDiet(
  subject: DietSubject,
  ctx: JudgeContext<RulesOf<'diet'>, FactsOf<'diet'>>,
): Verdict {
  const { rules, facts, tier, extras, priorDietMeals = [] } = ctx
  const w = TIER_CONFIG[tier]
  const currentEntry: PriorDietMeal = {
    mealType: subject.mealType,
    items: subject.items,
    note: subject.note ?? null,
    dishes: facts ? facts.dishes : null,
  }
  const currentNorm = normalizeMeal(currentEntry)
  const merged = mergeDietMeals(priorDietMeals, currentEntry)
  const day = evaluateDietDay(merged, rules, tier)

  const baseMetrics: Verdict['metrics'] = {
    kcal: currentNorm.offline && currentNorm.totals.kcal === 0 ? null : currentNorm.totals.kcal,
    protein: currentNorm.totals.protein,
    carb: currentNorm.totals.carb,
    fat: currentNorm.totals.fat,
    fiber: currentNorm.totals.fiber,
    sodium: currentNorm.totals.sodium,
    gi: currentNorm.totals.gi,
    dishes: currentNorm.isFasting
      ? 0
      : currentNorm.offline
        ? subject.items.length
        : currentNorm.dishes.length,
    kcalMin: w.mealKcalMin,
    kcalMax: w.mealKcalMax,
    dailyKcalMin: w.dailyKcalMin,
    dailyKcalMax: w.dailyKcalMax,
    passScore: rules.passScore,
    tier,
    mealsLogged: day.mealsLogged,
    mealsRequired: 3,
    breakfastKcal: day.mealKcals.breakfast,
    lunchKcal: day.mealKcals.lunch,
    dinnerKcal: day.mealKcals.dinner,
    snackKcal: day.mealKcals.snack,
    snackCount: day.snackCount,
    dailyKcal: day.dailyTotals.kcal,
    dailyProtein: day.dailyTotals.protein,
    dailyCarb: day.dailyTotals.carb,
    dailyFat: day.dailyTotals.fat,
    dailyFiber: day.dailyTotals.fiber,
    dailySodium: day.dailyTotals.sodium,
    dailyGi: day.dailyTotals.gi,
  }

  // 阶段 1：早、午、晚三顿正餐尚未集齐 → 返回 pending 态，不打单餐分、不判单餐死刑
  if (!day.ready) {
    const mealName = MEAL_NAME[subject.mealType]
    const missingText = day.missingMeals.map((m) => MEAL_NAME[m]).join('、')
    const pendingInfo = buildPendingMealChecks(currentNorm, tier)
    const detail =
      currentNorm.junkNames.length > 0
        ? `已记录${mealName}（含「${currentNorm.junkNames.join('、')}」，三餐结算时将触发一票否决）· 今日已记 ${day.mealsLogged}/3 正餐`
        : currentNorm.isFasting
          ? `已记录${mealName}（空腹轻断食）· 今日已记 ${day.mealsLogged}/3 正餐，记齐${missingText}后统一结算总分`
          : currentNorm.offline
            ? `已记录${mealName} · 今日已记 ${day.mealsLogged}/3 正餐，记齐${missingText}后统一结算总分`
            : `已解析${mealName}营养（约 ${currentNorm.totals.kcal} kcal · 蛋白 ${currentNorm.totals.protein}g）· 今日已记 ${day.mealsLogged}/3 正餐，记齐${missingText}后统一结算总分`

    return buildVerdict({
      isValid: false,
      settlement: 'pending',
      score: null,
      scoreMax: 5,
      detail,
      checks: pendingInfo.checks,
      metrics: { ...baseMetrics, settled: 0 },
      facts,
      advice: pendingInfo.advice,
      extras,
      offline: currentNorm.offline,
    })
  }

  // 阶段 2：早、午、晚三餐已集齐（含加餐重算）→ 输出全天统一总分与有效结论
  return buildVerdict({
    isValid: day.isValid,
    settlement: 'settled',
    score: day.score,
    scoreMax: 5,
    detail: day.detail,
    checks: day.checks,
    metrics: {
      ...baseMetrics,
      settled: 1,
      dailyScore: day.score,
    },
    facts,
    advice: day.advice,
    extras,
    offline: day.offlineAll,
  })
}
