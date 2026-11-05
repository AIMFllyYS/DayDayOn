import { dietTotals, giBand } from '@/features/referee/rules/diet'
import type { DietDishFact, Verdict } from '@/features/referee/schemas'
import type { CreateCheckinInput } from '../../schemas'
import type { FolderSpec, ReportSpec } from '../../flow/types'
import { MEAL_LABEL } from './form'

/*
 * 饮食分析页：营养物质 → 热量 → 逐菜分析 → 校验清单（Playbook diet-flow 的 buildReport，数据来自裁判结论）。
 */

const GI_TEXT = { low: '低 GI', mid: '中 GI', high: '高 GI' } as const
const GI_TONE = { low: 'success', mid: 'warning', high: 'danger' } as const

function dishQuality(d: DietDishFact) {
  if (d.junk)
    return { text: '不推荐', tone: 'danger' as const, note: '一票否决项：会让整餐直接 0 分。' }
  if (d.sodiumMg > 1500)
    return {
      text: '偏咸',
      tone: 'warning' as const,
      note: `钠很高（约 ${d.sodiumMg} mg），少喝汤、少放红油。`,
    }
  if (d.gi >= 70)
    return { text: '升糖快', tone: 'warning' as const, note: '升糖较快，晚间尤其要控制份量。' }
  if (d.sweet)
    return { text: '解馋', tone: 'warning' as const, note: '甜点按餐次扣分，晚上扣得更重。' }
  if (d.proteinG >= 20)
    return { text: '优质', tone: 'success' as const, note: '优质蛋白来源，有利于饱腹。' }
  if (d.fiberG >= 4)
    return { text: '优质', tone: 'success' as const, note: '膳食纤维丰富，有助于延缓升糖。' }
  return { text: '良好', tone: 'success' as const, note: '营养均衡，适量即可。' }
}

const SOURCE_TEXT = { table: '内置营养表', web: '联网检索', estimate: '估算' } as const

export function buildDietReport(verdict: Verdict, input: CreateCheckinInput): ReportSpec {
  const meal = input.module === 'diet' ? MEAL_LABEL[input.mealType] : '本餐'
  const scoreText = verdict.score === null ? '未评分' : `${verdict.score.toFixed(1)} 分`
  const checks: FolderSpec = {
    id: 'checks',
    title: '校验清单',
    icon: 'shield',
    tone: 'primary',
    headline: `${verdict.checks.filter((c) => c.ok).length}/${verdict.checks.length} 项通过`,
    badge: verdict.isValid
      ? { text: '达标', tone: 'success' }
      : { text: '未达标', tone: 'warning' },
    checks: verdict.checks.map((c) => ({ text: c.text, ok: c.ok, source: c.source })),
    note:
      verdict.citations.length > 0
        ? `联网核验：${verdict.citations.map((c) => c.title).join('；')}`
        : undefined,
  }
  const facts = verdict.facts?.module === 'diet' ? verdict.facts : null
  if (!facts) return { title: `${meal}分析 · ${scoreText}`, folders: [checks] }

  const t = dietTotals(facts.dishes)
  const kcalMin = Number(verdict.metrics.kcalMin ?? 350)
  const kcalMax = Number(verdict.metrics.kcalMax ?? 800)
  const band = giBand(t.gi)
  const nutrition: FolderSpec = {
    id: 'nutrition',
    title: '营养物质',
    icon: 'heart',
    tone: 'diet',
    headline: `蛋白质 ${t.protein.toFixed(0)}g · 碳水 ${t.carb.toFixed(0)}g · 脂肪 ${t.fat.toFixed(0)}g`,
    rows: [
      {
        label: '蛋白质',
        value: `${t.protein} g`,
        ratio: t.protein / 25,
        tone: 'success',
        sub: '本餐参考 25g',
      },
      {
        label: '碳水化合物',
        value: `${t.carb} g`,
        ratio: t.carb / 80,
        tone: t.carb > 100 ? 'warning' : 'primary',
      },
      {
        label: '脂肪',
        value: `${t.fat} g`,
        ratio: t.fat / 25,
        tone: t.fat > 25 ? 'warning' : 'primary',
      },
      {
        label: '膳食纤维',
        value: `${t.fiber} g`,
        ratio: t.fiber / 8,
        tone: 'success',
        sub: '本餐参考 8g',
      },
      {
        label: '钠',
        value: `${t.sodium} mg`,
        ratio: t.sodium / 800,
        tone: t.sodium > 1500 ? 'danger' : 'primary',
        sub: '本餐参考 800mg',
      },
    ],
  }
  const energy: FolderSpec = {
    id: 'energy',
    title: '热量',
    icon: 'flame',
    tone: 'exercise',
    headline: `${t.kcal} kcal · ${t.kcal < kcalMin ? '低于' : t.kcal > kcalMax ? '高于' : '在'}本餐走廊${t.kcal >= kcalMin && t.kcal <= kcalMax ? '内' : ''}`,
    rows: [
      {
        label: '本餐热量',
        value: `${t.kcal} kcal`,
        ratio: t.kcal / kcalMax,
        tone: t.kcal > kcalMax ? 'warning' : 'exercise',
        sub: `本餐走廊 ${kcalMin}–${kcalMax} kcal（按体质档位）`,
      },
    ],
  }
  const dishes: FolderSpec = {
    id: 'dishes',
    defaultOpen: true,
    title: '逐菜分析',
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
            ratio: d.kcal / 700,
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
  return { title: `${meal}分析 · ${scoreText}`, folders: [nutrition, energy, dishes, checks] }
}
