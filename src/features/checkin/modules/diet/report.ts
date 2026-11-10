import { dietTotals, giBand } from '@/features/referee/rules/diet'
import type { DietDishFact, Verdict } from '@/features/referee/schemas'
import type { CreateCheckinInput } from '../../schemas'
import type { FolderSpec, ReportSpec } from '../../flow/types'
import { MEAL_LABEL } from './form'

/*
 * 饮食分析页：
 * - 三餐集齐已结算（settled）：首张卡片展示「今日三餐汇总 · 总分 X.X 分」，下方展示当前餐次明细；
 * - 分餐待汇总（pending）：展示本餐营养解析与今日正餐进度（1/3、2/3），不显示误导性的单餐及格/不及格。
 */

const GI_TEXT = { low: '低 GI', mid: '中 GI', high: '高 GI' } as const
const GI_TONE = { low: 'success', mid: 'warning', high: 'danger' } as const

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

function kcalSlotText(v: unknown): string {
  if (typeof v !== 'number') return '待打卡'
  return v === 0 ? '0 kcal（空腹）' : `${v} kcal`
}

function mealEnergyCopy(
  kcal: number,
  kcalMax: number,
  tier: string,
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

export function buildDietReport(verdict: Verdict, input: CreateCheckinInput): ReportSpec {
  const meal = input.module === 'diet' ? MEAL_LABEL[input.mealType] : '本餐'
  const pending = verdict.settlement === 'pending'
  const mealsLogged = num(verdict.metrics.mealsLogged, pending ? 1 : 3)
  const mealsRequired = num(verdict.metrics.mealsRequired, 3)
  const tier = typeof verdict.metrics.tier === 'string' ? verdict.metrics.tier : 'balanced-glycemic'

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

  const dailyFolder: FolderSpec | null = !pending
    ? {
        id: 'daily-summary',
        defaultOpen: true,
        title: '今日三餐总分与热量汇总',
        icon: 'sparkles',
        tone: verdict.isValid ? 'success' : 'warning',
        headline:
          verdict.score !== null
            ? `全天总分 ${verdict.score.toFixed(1)} / 5.0 分 · 共 ${num(verdict.metrics.dailyKcal)} kcal`
            : `三餐已齐备 · 共 ${num(verdict.metrics.dailyKcal)} kcal`,
        badge: verdict.isValid
          ? { text: '有效盖章', tone: 'success' }
          : { text: '仅存档', tone: 'warning' },
        rows: [
          { label: '早餐', value: kcalSlotText(verdict.metrics.breakfastKcal), tone: 'diet' },
          { label: '午餐', value: kcalSlotText(verdict.metrics.lunchKcal), tone: 'diet' },
          { label: '晚餐', value: kcalSlotText(verdict.metrics.dinnerKcal), tone: 'diet' },
          ...(typeof verdict.metrics.snackKcal === 'number'
            ? [
                {
                  label: '加餐',
                  value: `${verdict.metrics.snackKcal} kcal`,
                  tone: 'warning' as const,
                },
              ]
            : []),
          {
            label: '全天合计',
            value: `${num(verdict.metrics.dailyKcal)} kcal`,
            sub: `蛋白 ${num(verdict.metrics.dailyProtein)}g · 膳食纤维 ${num(verdict.metrics.dailyFiber)}g · 钠 ${num(verdict.metrics.dailySodium)}mg`,
            tone: 'primary',
          },
        ],
      }
    : null

  const facts = verdict.facts?.module === 'diet' ? verdict.facts : null
  if (!facts) {
    return {
      title,
      folders: dailyFolder ? [dailyFolder, checks] : [checks],
    }
  }

  const t = dietTotals(facts.dishes)
  const kcalMax = num(verdict.metrics.kcalMax, 800)
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
    defaultOpen: pending,
    title: `${meal}逐菜分析`,
    icon: 'diet',
    tone: 'study',
    headline: `${facts.dishes.length} 道菜 · 综合 GI ${t.gi}`,
    badge: { text: GI_TEXT[band], tone: GI_TONE[band] },
    children: facts.dishes.map((d, i) => {
      const q = dishQuality(d)
      const b = giBand(d.gi)
      return {
        id: `dish-${i}`,
        title: d.name,
        icon: 'diet' as const,
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
            tone: 'exercise' as const,
          },
          { label: '蛋白质', value: `${d.proteinG} g` },
          { label: '碳水', value: `${d.carbG} g` },
          { label: '脂肪', value: `${d.fatG} g` },
          { label: '膳食纤维', value: `${d.fiberG} g` },
          { label: '钠', value: `${d.sodiumMg} mg` },
        ],
        note: `${SOURCE_TEXT[d.source]}；${q.note}`,
      }
    }),
    note: '综合 GI 按各菜碳水克数加权。',
  }
  return {
    title,
    folders: dailyFolder
      ? [dailyFolder, nutrition, energy, dishes, checks]
      : [nutrition, energy, dishes, checks],
  }
}
