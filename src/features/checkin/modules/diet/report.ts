import {
  applyNoteToDishes,
  dietTotals,
  giBand,
  isFastingSubject,
  TIER_CONFIG,
} from '@/features/referee/rules/diet'
import type { DietDishFact, RefereeTier, Verdict } from '@/features/referee/schemas'
import type { Checkin, CreateCheckinInput, MealType } from '../../schemas'
import type { FolderSpec, ReportSpec } from '../../flow/types'
import type { CheckinGoal } from '../../components/form-types'
import type { ReportBuildContext } from '../types'
import { MEAL_LABEL } from './form'

/*
 * 饮食分析页：
 * - 三餐集齐已结算（settled）：全部卡片统一按「今日全天」口径展示：
 *   1) 今日三餐总分与热量汇总（早/午/晚/加餐分餐热量 + 全天总热量进度与走廊评价）
 *   2) 今日营养素总计（全天蛋白/碳水/脂肪/膳食纤维/钠）
 *   3) 今日逐菜分析（按 早餐 → 午餐 → 晚餐 → 加餐 顺序平铺全天所有菜品，每道菜带餐次前缀）
 *   4) 全天裁判清单
 * - 分餐待汇总（pending）：只展示当前这一餐的营养素、热量、逐菜分析与本餐核验。
 */

const GI_TEXT = { low: '低 GI', mid: '中 GI', high: '高 GI' } as const
const GI_TONE = { low: 'success', mid: 'warning', high: 'danger' } as const
const MEAL_ORDER: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export interface DietReportMealItem {
  name: string
  portion: string
  kcal: number | null
}

export interface DietReportMeal {
  mealType: MealType
  label: string
  isFasting: boolean
  dishes: DietDishFact[]
  fallbackItems: DietReportMealItem[]
  kcal: number
}

function dishQuality(d: DietDishFact) {
  if (d.junk)
    return { text: '不推荐', tone: 'danger' as const, note: '一票否决项：会让全天总分直接归 0。' }
  if (d.sodiumMg > 1500)
    return {
      text: '偏咸',
      tone: 'warning' as const,
      note: `钠偏高（约 ${d.sodiumMg} mg），少喝汤汁、多喝温水即可。`,
    }
  if (d.gi >= 70)
    return { text: '升糖快', tone: 'warning' as const, note: '升糖较快，晚间尽量用粗粮替代。' }
  if (d.sweet)
    return { text: '解馋', tone: 'warning' as const, note: '甜点按时段扣减全天分，晚间扣分更重。' }
  if (d.proteinG >= 20)
    return { text: '优质', tone: 'success' as const, note: '优质蛋白来源，有利于饱腹。' }
  if (d.fiberG >= 4)
    return { text: '优质', tone: 'success' as const, note: '膳食纤维丰富，全天累计加分。' }
  return { text: '良好', tone: 'success' as const, note: '干净日常食材，放心享用。' }
}

const SOURCE_TEXT = { table: '内置营养表', web: '联网检索', estimate: '估算' } as const

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function resolveTier(v: unknown): RefereeTier {
  if (v === 'strict-fat-loss' || v === 'balanced-glycemic' || v === 'gentle-gain') return v
  return 'balanced-glycemic'
}

function kcalSlotText(v: unknown): string {
  if (typeof v !== 'number') return '待打卡'
  return v === 0 ? '0 kcal（空腹）' : `${v} kcal`
}

function mealEnergyCopy(
  kcal: number,
  kcalMax: number,
  tier: RefereeTier,
): { headline: string; sub: string; tone: 'success' | 'exercise' | 'warning' } {
  if (tier === 'strict-fat-loss') {
    if (kcal <= 220) {
      return {
        headline: `${kcal} kcal · 低卡控餐保持热量缺口（减脂加分）`,
        sub: `减脂严管档不设下限死线，单餐上限参考 ${kcalMax} kcal`,
        tone: 'success',
      }
    }
    if (kcal <= kcalMax) {
      return {
        headline: `${kcal} kcal · 控制在减脂单餐上限内`,
        sub: `减脂严管档单餐上限参考 ${kcalMax} kcal`,
        tone: 'exercise',
      }
    }
    return {
      headline: `${kcal} kcal · 超出减脂单餐参考上限`,
      sub: `减脂严管档单餐上限参考 ${kcalMax} kcal`,
      tone: 'warning',
    }
  }
  if (tier === 'gentle-gain') {
    if (kcal < 300) {
      return {
        headline: `${kcal} kcal · 偏瘦/增肌期本餐热量偏少`,
        sub: '注意在其余餐次补足能量，全天建议 ≥ 1600 kcal',
        tone: 'warning',
      }
    }
    return {
      headline: `${kcal} kcal · 增肌能量补给良好`,
      sub: `增肌温和档单餐上限参考 ${kcalMax} kcal`,
      tone: 'exercise',
    }
  }
  return {
    headline: kcal <= kcalMax ? `${kcal} kcal · 热量适中` : `${kcal} kcal · 高于单餐参考上限`,
    sub: `控糖均衡档单餐上限参考 ${kcalMax} kcal（吃少不扣分）`,
    tone: kcal > kcalMax ? 'warning' : 'exercise',
  }
}

function dailyEnergyCopy(
  kcal: number,
  kcalMin: number,
  kcalMax: number,
  tier: RefereeTier,
): { sub: string; tone: 'success' | 'exercise' | 'warning' } {
  if (tier === 'strict-fat-loss') {
    if (kcal <= 1350) {
      return {
        sub: `全天保持减脂热量缺口（上限参考 ${kcalMax} kcal，不设下限死线）`,
        tone: 'success',
      }
    }
    if (kcal <= kcalMax) {
      return {
        sub: `全天热量控制在减脂上限 ${kcalMax} kcal 内`,
        tone: 'exercise',
      }
    }
    return {
      sub: `超出减脂全天参考上限 ${kcalMax} kcal`,
      tone: 'warning',
    }
  }
  if (tier === 'gentle-gain') {
    if (kcal < kcalMin) {
      return {
        sub: `偏瘦/增肌期全天建议 ${kcalMin}–${kcalMax} kcal，今日能量略偏少`,
        tone: 'warning',
      }
    }
    if (kcal <= kcalMax) {
      return {
        sub: `全天热量落在增肌目标区间（${kcalMin}–${kcalMax} kcal）`,
        tone: 'success',
      }
    }
    return {
      sub: `高于增肌全天参考上限 ${kcalMax} kcal`,
      tone: 'warning',
    }
  }
  return {
    sub:
      kcal <= kcalMax
        ? `控糖均衡档全天上限参考 ${kcalMax} kcal（吃少不扣分）`
        : `超出控糖均衡档全天上限 ${kcalMax} kcal`,
    tone: kcal > kcalMax ? 'warning' : 'exercise',
  }
}

function normalizeReportMeal(
  mealType: MealType,
  items: readonly DietReportMealItem[],
  note: string | null | undefined,
  rawDishes: readonly DietDishFact[] | null,
): DietReportMeal {
  const fasting = isFastingSubject({ items: [...items], note }, rawDishes)
  if (fasting) {
    return {
      mealType,
      label: MEAL_LABEL[mealType],
      isFasting: true,
      dishes: [],
      fallbackItems: [],
      kcal: 0,
    }
  }
  if (rawDishes && rawDishes.length > 0) {
    const dishes = applyNoteToDishes(rawDishes, note)
    const totals = dietTotals(dishes)
    return {
      mealType,
      label: MEAL_LABEL[mealType],
      isFasting: false,
      dishes,
      fallbackItems: [],
      kcal: totals.kcal,
    }
  }
  const fallbackItems = items.map((i) => ({
    name: i.name,
    portion: i.portion,
    kcal: i.kcal,
  }))
  return {
    mealType,
    label: MEAL_LABEL[mealType],
    isFasting: false,
    dishes: [],
    fallbackItems,
    kcal: fallbackItems.reduce((sum, i) => sum + (i.kcal ?? 0), 0),
  }
}

/**
 * 汇总当日全部餐次（早 → 午 → 晚 → 加餐），并用当前正在查看/分析的餐次覆盖同槽旧值。
 * 供三餐总评报告与原生分享海报共用同一份真实全天数据。
 */
export function collectDayDietMeals(
  verdict: Verdict,
  input: CreateCheckinInput,
  todayCheckins?: readonly Checkin[],
): DietReportMeal[] {
  const byMeal = new Map<MealType, DietReportMeal>()

  for (const c of todayCheckins ?? []) {
    if (c.payload.module !== 'diet') continue
    const items: DietReportMealItem[] = c.payload.items.map((i) => ({
      name: i.name,
      portion: i.portion ?? '',
      kcal: i.kcal,
    }))
    const storedDishes = c.verdict?.facts?.module === 'diet' ? c.verdict.facts.dishes : null
    byMeal.set(
      c.payload.mealType,
      normalizeReportMeal(c.payload.mealType, items, c.note, storedDishes),
    )
  }

  if (input.module === 'diet') {
    const currentItems: DietReportMealItem[] = input.items.map((i) => ({
      name: i.name,
      portion: i.portion ?? '',
      kcal: i.kcal,
    }))
    const currentDishes = verdict.facts?.module === 'diet' ? verdict.facts.dishes : null
    byMeal.set(
      input.mealType,
      normalizeReportMeal(input.mealType, currentItems, input.note, currentDishes),
    )
  }

  return MEAL_ORDER.flatMap((m) => {
    const entry = byMeal.get(m)
    return entry ? [entry] : []
  })
}

function buildDishFolder(d: DietDishFact, id: string, titlePrefix?: string): FolderSpec {
  const q = dishQuality(d)
  const b = giBand(d.gi)
  return {
    id,
    title: titlePrefix ? `${titlePrefix} · ${d.name}` : d.name,
    icon: 'diet',
    headline: `${d.portion || '1 份'} · GI ${d.gi} · ${d.kcal} kcal`,
    badge: { text: q.text, tone: q.tone },
    rows: [
      {
        label: '升糖指数',
        value: `GI ${d.gi} · ${GI_TEXT[b]}`,
        ratio: d.gi / 100,
        tone: GI_TONE[b],
      },
      {
        label: '热量',
        value: `${d.kcal} kcal`,
        ratio: Math.min(1, d.kcal / 700),
        tone: 'exercise',
      },
      { label: '蛋白质', value: `${d.proteinG} g` },
      { label: '碳水', value: `${d.carbG} g` },
      { label: '脂肪', value: `${d.fatG} g` },
      { label: '膳食纤维', value: `${d.fiberG} g` },
      { label: '钠', value: `${d.sodiumMg} mg` },
    ],
    note: `${SOURCE_TEXT[d.source]}；${q.note}`,
  }
}

export function buildDietReport(
  verdict: Verdict,
  input: CreateCheckinInput,
  _goal?: CheckinGoal,
  ctx?: ReportBuildContext,
): ReportSpec {
  const meal = input.module === 'diet' ? MEAL_LABEL[input.mealType] : '本餐'
  const pending = verdict.settlement === 'pending'
  const mealsLogged = num(verdict.metrics.mealsLogged, pending ? 1 : 3)
  const mealsRequired = num(verdict.metrics.mealsRequired, 3)
  const tier = resolveTier(verdict.metrics.tier)
  const tierCfg = TIER_CONFIG[tier]

  const title = pending
    ? `${meal}营养解析 · 今日已记 ${mealsLogged}/${mealsRequired} 正餐`
    : verdict.score === null
      ? `今日三餐汇总 · 已记录`
      : `今日三餐总评 · ${verdict.score.toFixed(1)} 分`

  const checks: FolderSpec = {
    id: 'checks',
    title: pending ? '本餐营养核验' : '全天裁判清单',
    icon: 'shield',
    tone: 'primary',
    headline: `${verdict.checks.filter((c) => c.ok).length}/${verdict.checks.length} 项正常`,
    badge: pending
      ? { text: `待汇总 ${mealsLogged}/${mealsRequired}`, tone: 'diet' }
      : verdict.isValid
        ? { text: '今日达标', tone: 'success' }
        : { text: '未达标', tone: 'warning' },
    checks: verdict.checks.map((c) => ({ text: c.text, ok: c.ok, source: c.source })),
    note:
      verdict.citations.length > 0
        ? `联网核验：${verdict.citations.map((c) => c.title).join('；')}`
        : undefined,
  }

  // -------------------------------------------------------------------------
  // 阶段 1：pending（1/3、2/3 分餐待汇总）→ 展示单餐解析
  // -------------------------------------------------------------------------
  if (pending) {
    const facts = verdict.facts?.module === 'diet' ? verdict.facts : null
    if (!facts) {
      return { title, folders: [checks] }
    }
    const effectiveDishes = applyNoteToDishes(
      facts.dishes,
      input.module === 'diet' ? input.note : null,
    )
    const t = dietTotals(effectiveDishes)
    const kcalMax = num(verdict.metrics.kcalMax, tierCfg.mealKcalMax)
    const energyCopy = mealEnergyCopy(t.kcal, kcalMax, tier)
    const band = giBand(t.gi)

    const nutrition: FolderSpec = {
      id: 'nutrition',
      title: `${meal}营养素`,
      icon: 'heart',
      tone: 'diet',
      headline: `蛋白质 ${t.protein.toFixed(0)}g · 碳水 ${t.carb.toFixed(0)}g · 脂肪 ${t.fat.toFixed(0)}g`,
      rows: [
        {
          label: '蛋白质',
          value: `${t.protein} g`,
          ratio: Math.min(1, t.protein / 25),
          tone: 'success',
        },
        {
          label: '碳水化合物',
          value: `${t.carb} g`,
          ratio: Math.min(1, t.carb / 80),
          tone: t.carb > 100 ? 'warning' : 'primary',
        },
        {
          label: '脂肪',
          value: `${t.fat} g`,
          ratio: Math.min(1, t.fat / 25),
          tone: t.fat > 25 ? 'warning' : 'primary',
        },
        {
          label: '膳食纤维',
          value: `${t.fiber} g`,
          ratio: Math.min(1, t.fiber / 8),
          tone: 'success',
          sub: '全天累计加分项，本餐为 0 也不扣分',
        },
        {
          label: '钠',
          value: `${t.sodium} mg`,
          ratio: Math.min(1, t.sodium / 1500),
          tone: t.sodium > 1800 ? 'warning' : 'primary',
        },
      ],
    }
    const energy: FolderSpec = {
      id: 'energy',
      title: `${meal}热量`,
      icon: 'flame',
      tone: 'exercise',
      headline: energyCopy.headline,
      rows: [
        {
          label: `${meal}摄入`,
          value: `${t.kcal} kcal`,
          ratio: Math.min(1, t.kcal / Math.max(1, kcalMax)),
          tone: energyCopy.tone,
          sub: energyCopy.sub,
        },
      ],
    }
    const dishes: FolderSpec = {
      id: 'dishes',
      defaultOpen: true,
      title: `${meal}逐菜分析`,
      icon: 'diet',
      tone: 'study',
      headline: `${effectiveDishes.length} 道菜 · 综合 GI ${t.gi}`,
      badge: { text: GI_TEXT[band], tone: GI_TONE[band] },
      children: effectiveDishes.map((d, i) => buildDishFolder(d, `dish-${i}`)),
      note: '综合 GI 按各菜碳水克数加权。',
    }
    return { title, folders: [nutrition, energy, dishes, checks] }
  }

  // -------------------------------------------------------------------------
  // 阶段 2：settled（今日三餐总评）→ 全部卡片按一日三餐全天合计展示
  // -------------------------------------------------------------------------
  const dayMeals = collectDayDietMeals(verdict, input, ctx?.todayCheckins)
  const allDayDishes = dayMeals.flatMap((m) => m.dishes)
  const computedTotals = dietTotals(allDayDishes)

  const dailyKcal = num(
    verdict.metrics.dailyKcal,
    dayMeals.reduce((s, m) => s + m.kcal, 0),
  )
  const dailyProtein = num(verdict.metrics.dailyProtein, computedTotals.protein)
  const dailyCarb = num(verdict.metrics.dailyCarb, computedTotals.carb)
  const dailyFat = num(verdict.metrics.dailyFat, computedTotals.fat)
  const dailyFiber = num(verdict.metrics.dailyFiber, computedTotals.fiber)
  const dailySodium = num(verdict.metrics.dailySodium, computedTotals.sodium)
  const dailyGi = num(verdict.metrics.dailyGi, computedTotals.gi)
  const dailyKcalMin = num(verdict.metrics.dailyKcalMin, tierCfg.dailyKcalMin)
  const dailyKcalMax = num(verdict.metrics.dailyKcalMax, tierCfg.dailyKcalMax)
  const fatCap = Number.isFinite(tierCfg.fatCapDaily) ? tierCfg.fatCapDaily : 90
  const sodiumCap = tier === 'gentle-gain' ? 5000 : 4500

  const dayEnergy = dailyEnergyCopy(dailyKcal, dailyKcalMin, dailyKcalMax, tier)
  const dayBand = giBand(dailyGi)

  const breakfastKcal =
    typeof verdict.metrics.breakfastKcal === 'number'
      ? verdict.metrics.breakfastKcal
      : (dayMeals.find((m) => m.mealType === 'breakfast')?.kcal ?? null)
  const lunchKcal =
    typeof verdict.metrics.lunchKcal === 'number'
      ? verdict.metrics.lunchKcal
      : (dayMeals.find((m) => m.mealType === 'lunch')?.kcal ?? null)
  const dinnerKcal =
    typeof verdict.metrics.dinnerKcal === 'number'
      ? verdict.metrics.dinnerKcal
      : (dayMeals.find((m) => m.mealType === 'dinner')?.kcal ?? null)
  const snackKcal =
    typeof verdict.metrics.snackKcal === 'number'
      ? verdict.metrics.snackKcal
      : (dayMeals.find((m) => m.mealType === 'snack')?.kcal ?? null)

  const dailyFolder: FolderSpec = {
    id: 'daily-summary',
    defaultOpen: true,
    title: '今日三餐总分与热量汇总',
    icon: 'sparkles',
    tone: verdict.isValid ? 'success' : 'warning',
    headline:
      verdict.score !== null
        ? `全天总分 ${verdict.score.toFixed(1)} / 5.0 分 · 共 ${dailyKcal} kcal`
        : `三餐已齐备 · 共 ${dailyKcal} kcal`,
    badge: verdict.isValid
      ? { text: '有效盖章', tone: 'success' }
      : { text: '仅存档', tone: 'warning' },
    rows: [
      { label: '早餐', value: kcalSlotText(breakfastKcal), tone: 'diet' },
      { label: '午餐', value: kcalSlotText(lunchKcal), tone: 'diet' },
      { label: '晚餐', value: kcalSlotText(dinnerKcal), tone: 'diet' },
      ...(typeof snackKcal === 'number'
        ? [
            {
              label: '加餐',
              value: `${snackKcal} kcal`,
              tone: 'warning' as const,
            },
          ]
        : []),
      {
        label: '全天总热量',
        value: `${dailyKcal} kcal`,
        ratio: Math.min(1, dailyKcal / Math.max(1, dailyKcalMax)),
        tone: dayEnergy.tone,
        sub: dayEnergy.sub,
      },
    ],
  }

  const hasNutritionData =
    allDayDishes.length > 0 ||
    dailyProtein > 0 ||
    dailyCarb > 0 ||
    dailyFat > 0 ||
    dailyFiber > 0 ||
    dailySodium > 0

  const nutrition: FolderSpec | null = hasNutritionData
    ? {
        id: 'nutrition',
        title: '今日营养素总计',
        icon: 'heart',
        tone: 'diet',
        headline: `蛋白质 ${dailyProtein.toFixed(0)}g · 碳水 ${dailyCarb.toFixed(0)}g · 脂肪 ${dailyFat.toFixed(0)}g`,
        rows: [
          {
            label: '全天蛋白质',
            value: `${dailyProtein} g`,
            ratio: Math.min(1, dailyProtein / 65),
            tone: 'success',
          },
          {
            label: '全天碳水化合物',
            value: `${dailyCarb} g`,
            ratio: Math.min(1, dailyCarb / 220),
            tone: dailyCarb > 280 ? 'warning' : 'primary',
          },
          {
            label: '全天脂肪',
            value: `${dailyFat} g`,
            ratio: Math.min(1, dailyFat / fatCap),
            tone: dailyFat > fatCap ? 'warning' : 'primary',
          },
          {
            label: '全天膳食纤维',
            value: `${dailyFiber} g`,
            ratio: Math.min(1, dailyFiber / 18),
            tone: 'success',
            sub: '全天累计纯加分项（≥ 10g / ≥ 18g 额外加分），不扣分',
          },
          {
            label: '全天钠',
            value: `${dailySodium} mg`,
            ratio: Math.min(1, dailySodium / sodiumCap),
            tone: dailySodium > sodiumCap ? 'warning' : 'primary',
          },
        ],
      }
    : null

  // 方案 A：按 早餐 → 午餐 → 晚餐 → 加餐 顺序平铺全天所有菜品，每道菜带餐次前缀
  const dishChildren: FolderSpec[] = []
  let analyzedDishCount = 0
  let fallbackItemCount = 0
  for (const m of dayMeals) {
    if (m.isFasting) {
      dishChildren.push({
        id: `${m.mealType}-fasting`,
        title: `${m.label} · 空腹轻断食`,
        icon: 'diet',
        headline: '0 kcal · 未进食',
        badge: { text: '空腹', tone: 'success' },
        note: '本餐按空腹轻断食计入全天汇总。',
      })
      continue
    }
    if (m.dishes.length > 0) {
      m.dishes.forEach((d, idx) => {
        analyzedDishCount += 1
        dishChildren.push(buildDishFolder(d, `${m.mealType}-dish-${idx}`, m.label))
      })
      continue
    }
    m.fallbackItems.forEach((it, idx) => {
      fallbackItemCount += 1
      dishChildren.push({
        id: `${m.mealType}-item-${idx}`,
        title: `${m.label} · ${it.name}`,
        icon: 'diet',
        headline:
          it.kcal !== null
            ? `${it.portion || '1 份'} · ${it.kcal} kcal`
            : `${it.portion || '1 份'} · 离线记录`,
        badge: { text: '已记录', tone: 'diet' },
      })
    })
  }

  const totalItemsListed = analyzedDishCount + fallbackItemCount
  const mealSummaryText = dayMeals.map((m) => m.label).join('、')
  const dishes: FolderSpec | null =
    dishChildren.length > 0
      ? {
          id: 'dishes',
          title: '今日逐菜分析',
          icon: 'diet',
          tone: 'study',
          headline:
            totalItemsListed > 0
              ? `共 ${totalItemsListed} 道菜（${mealSummaryText}）· 全天综合 GI ${dailyGi}`
              : `${mealSummaryText} · 全天轻断食`,
          badge:
            totalItemsListed > 0 ? { text: GI_TEXT[dayBand], tone: GI_TONE[dayBand] } : undefined,
          children: dishChildren,
          note: '按早餐、午餐、晚餐、加餐顺序汇总全天菜品；全天综合 GI 按碳水克数加权。',
        }
      : null

  return {
    title,
    folders: [dailyFolder, ...(nutrition ? [nutrition] : []), ...(dishes ? [dishes] : []), checks],
  }
}
