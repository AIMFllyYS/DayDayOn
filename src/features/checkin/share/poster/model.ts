import type { ModuleTone, Tone } from '@/components/ui/tone'
import { moduleMeta } from '@/components/ui/tone'
import { bedtimeAxis } from '@/features/referee/rules/sleep'
import type { Check } from '@/features/referee/schemas'
import { formatWeekday } from '@/lib/time'
import type { MealType } from '../../schemas'
import { MEAL_LABEL } from '../../modules/diet/form'
import { collectDayDietMeals } from '../../modules/diet/report'
import type { ReportPosterInput } from './types'

/*
 * 海报视图模型：把 Verdict + 打卡请求体整理成「画什么」，不碰 Canvas，可单测。
 * 画法在 scenes/<module>.ts；这里按板块分支只做数据整形，不产生任何达标结论。
 */

export type PosterStatusKind = 'valid' | 'pending' | 'archived' | 'skipped'

export interface PosterStatus {
  kind: PosterStatusKind
  badge: string
  stampMain: string
  stampSub: string
  tone: Tone
}

export interface PosterKpi {
  value: string
  unit: string
  sub: string
}

export interface DietPosterMeal {
  label: string
  slot: MealType
  /** 本餐热量；null = 只记了菜名、没有营养解析（离线记录），不显示成 0 */
  kcal: number | null
  fasting: boolean
  lines: { name: string; kcal: number | null }[]
}

export interface DietPosterModel {
  module: 'diet'
  pending: boolean
  mealsLogged: number
  mealsRequired: number
  meals: DietPosterMeal[]
  /** 应记但还没记的餐次标签（如 ['午餐','晚餐']），小票上画成占位行 */
  missingMeals: string[]
  /** 小票合计：当日已记录餐次的总热量；null = 全天没有任何热量数据 */
  totalKcal: number | null
  macros: { protein: number; carb: number; fat: number }
  /** 三大营养素供能占比（0–1）；没有营养事实时全为 0 */
  share: { protein: number; carb: number; fat: number }
  extras: { label: string; value: string }[]
  /** 有没有可展示的营养事实；false 时营养素图例与 GI 行不画 */
  hasNutrition: boolean
}

export interface ExercisePosterItem {
  name: string
  minutes: number
  /** 距离 / 组数的补充说明，可为空 */
  detail: string
  kcal: number | null
  ok: boolean
}

export interface ExercisePosterModel {
  module: 'exercise'
  kcal: number
  minutes: number
  /** 相对训练负荷百分比（可超过 100） */
  loadPct: number
  items: ExercisePosterItem[]
}

export interface SleepPosterModel {
  module: 'sleep'
  hours: number
  bed: string
  wake: string
  redline: string
  lateBy: number | null
  regularity: number | null
  quality: number | null
  /** 「中午 12:00 起算」的分钟轴：整点对齐的起止与三个关键时刻 */
  axis: { start: number; end: number; bed: number; wake: number; red: number }
  stages: { label: string; value: string }[]
}

export interface StudyPosterModel {
  module: 'study'
  topic: string
  subjectLabel: string
  summary: string
  points: string[]
  thisMin: number
  beforeMin: number
  totalMin: number
  /** 每个番茄（25 分钟）的填充比例，最多 8 个 */
  tomatoes: number[]
  /** 被折叠掉的番茄数 */
  moreTomatoes: number
}

export interface CustomPosterModel {
  module: 'custom'
  entries: { label: string; value: string }[]
  passed: number
  total: number
  comment: string | null
}

export type ScenePosterModel =
  DietPosterModel | ExercisePosterModel | SleepPosterModel | StudyPosterModel | CustomPosterModel

export interface PosterModel {
  module: ModuleTone
  moduleBadge: string
  title: string
  dateText: string
  dayText: string
  status: PosterStatus
  kpi: PosterKpi
  detail: string
  advice: string | null
  checks: Check[]
  /** 跳过本次打卡的理由；非跳过为 null */
  skipReason: string | null
  scene: ScenePosterModel
}

const TIER_LABEL: Record<string, string> = {
  'strict-fat-loss': '减脂严管',
  'balanced-glycemic': '控糖均衡',
  'gentle-gain': '增肌温和',
}
const MODULE_BADGE: Record<ModuleTone, string> = {
  diet: '今日食单',
  exercise: '运动战报',
  sleep: '昨夜星图',
  study: '学习笔记',
  custom: '小目标票根',
}
const POMODORO_MINUTES = 25
const MAX_TOMATOES = 8
const MEAL_ORDER: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/** 去掉无意义的小数：7.0 → 7，7.25 → 7.3 */
export function trimNumber(v: number): string {
  return String(Math.round(v * 10) / 10)
}

/** '2026-11-19' → '2026.11.19 周四' */
export function formatPosterDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!m) return isoDate
  return `${m[1]}.${m[2]}.${m[3]} ${formatWeekday(isoDate)}`
}

export function buildStatus(input: ReportPosterInput): PosterStatus {
  const { verdict, module: mod } = input
  const m = verdict.metrics
  if (num(m.skipped) === 1) {
    return {
      kind: 'skipped',
      badge: '今日请假 · 已获批准',
      stampMain: '已准假',
      stampSub: '好好休息',
      tone: mod,
    }
  }
  if (verdict.settlement === 'pending') {
    return {
      kind: 'pending',
      badge: `分餐进度 ${num(m.mealsLogged, 1)}/${num(m.mealsRequired, 3)}`,
      stampMain: '分餐中',
      stampSub: '待三餐汇总',
      tone: 'diet',
    }
  }
  if (verdict.isValid) {
    return {
      kind: 'valid',
      badge: '已达标 · 计入连击',
      stampMain: '已达标',
      stampSub: '有效卡',
      tone: mod,
    }
  }
  return {
    kind: 'archived',
    badge: '诚实存档 · 复盘参考',
    stampMain: '已存档',
    stampSub: '继续加油',
    tone: 'warning',
  }
}

/** 每 25 分钟一个番茄，最后一个按比例填充；超过 8 个折叠 */
export function buildTomatoes(totalMinutes: number): { tomatoes: number[]; more: number } {
  const total = Math.max(0, totalMinutes)
  const count = Math.max(1, Math.ceil(total / POMODORO_MINUTES))
  const all = Array.from({ length: count }, (_, i) =>
    Math.max(0, Math.min(1, (total - i * POMODORO_MINUTES) / POMODORO_MINUTES)),
  )
  return { tomatoes: all.slice(0, MAX_TOMATOES), more: Math.max(0, count - MAX_TOMATOES) }
}

/** 睡眠时间轴：起点取入睡 / 红线较早者前一小时的整点，终点取起床后一小时的整点，至少 8 小时 */
export function buildSleepAxis(
  bed: string,
  redline: string,
  minutes: number,
): SleepPosterModel['axis'] {
  const bedPos = bedtimeAxis(bed) ?? 23 * 60
  const redPos = bedtimeAxis(redline) ?? bedPos
  const wakePos = bedPos + Math.max(30, minutes)
  const start = Math.floor((Math.min(bedPos, redPos) - 60) / 60) * 60
  const end = Math.max(start + 8 * 60, Math.ceil((wakePos + 60) / 60) * 60)
  return { start, end, bed: bedPos, wake: wakePos, red: redPos }
}

/** 轴上的分钟数 → HH:mm（跨天自动回绕） */
export function axisLabel(axisMinutes: number): string {
  const m = ((Math.round(axisMinutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

interface Built<S extends ScenePosterModel> {
  scene: S
  kpi: PosterKpi
}

function buildDiet(input: ReportPosterInput): Built<DietPosterModel> {
  const { verdict } = input
  const m = verdict.metrics
  const pending = verdict.settlement === 'pending'
  const meals: DietPosterMeal[] = collectDayDietMeals(
    verdict,
    input.subject,
    input.todayCheckins,
  ).map((meal) => {
    const lines =
      meal.dishes.length > 0
        ? meal.dishes.map((d) => ({ name: d.name, kcal: d.kcal }))
        : meal.fallbackItems.map((i) => ({ name: i.name, kcal: i.kcal }))
    // 没有任何一行带热量时，meal.kcal 是兜底求和出来的 0，不能把「没数据」显示成「0 kcal」
    const kcal = meal.isFasting || lines.some((l) => l.kcal !== null) ? meal.kcal : null
    return { label: meal.label, slot: meal.mealType, kcal, fasting: meal.isFasting, lines }
  })
  const pick = (meal: string, daily: string) =>
    pending ? num(m[meal]) : num(m[daily], num(m[meal]))
  const macros = {
    protein: pick('protein', 'dailyProtein'),
    carb: pick('carb', 'dailyCarb'),
    fat: pick('fat', 'dailyFat'),
  }
  const energy = macros.protein * 4 + macros.carb * 4 + macros.fat * 9
  const share =
    energy > 0
      ? {
          protein: (macros.protein * 4) / energy,
          carb: (macros.carb * 4) / energy,
          fat: (macros.fat * 9) / energy,
        }
      : { protein: 0, carb: 0, fat: 0 }
  const gi = pick('gi', 'dailyGi')
  const fiber = pick('fiber', 'dailyFiber')
  const sodium = pick('sodium', 'dailySodium')
  const loggedKcal = meals.reduce((s, meal) => s + (meal.kcal ?? 0), 0)
  const settledKcal = pending ? loggedKcal : num(m.dailyKcal, loggedKcal)
  const anyKcal = meals.some((meal) => !meal.fasting && meal.kcal !== null) || settledKcal > 0
  const allFasting = meals.length > 0 && meals.every((meal) => meal.fasting)
  const totalKcal = anyKcal ? settledKcal : allFasting ? 0 : null
  const loggedSlots = new Set(meals.map((meal) => meal.slot))
  const mealsRequired = num(m.mealsRequired, 3)
  const missingMeals = MEAL_ORDER.slice(0, Math.max(0, Math.round(mealsRequired)))
    .filter((t) => !loggedSlots.has(t))
    .map((t) => MEAL_LABEL[t])
  const tier = TIER_LABEL[String(m.tier)]
  const scene: DietPosterModel = {
    module: 'diet',
    pending,
    mealsLogged: num(m.mealsLogged, meals.length),
    mealsRequired,
    meals,
    missingMeals,
    totalKcal,
    macros,
    share,
    extras: [
      { label: '综合 GI', value: `${trimNumber(gi)}` },
      { label: '膳食纤维', value: `${trimNumber(fiber)} g` },
      { label: '钠', value: `${Math.round(sodium)} mg` },
    ],
    hasNutrition: energy > 0 || gi > 0 || fiber > 0 || sodium > 0,
  }
  if (pending) {
    const mealKcal = typeof m.kcal === 'number' ? m.kcal : null
    return {
      scene,
      kpi: {
        value: mealKcal === null ? '已记' : `${mealKcal}`,
        unit: mealKcal === null ? '本餐' : 'kcal',
        sub: `今日已记 ${scene.mealsLogged} / ${scene.mealsRequired} 正餐`,
      },
    }
  }
  const kcalSub = `${totalKcal === null ? '三餐已记录' : `全天 ${totalKcal} kcal`}${tier ? ` · ${tier}档` : ''}`
  return {
    scene,
    kpi:
      verdict.score !== null
        ? { value: verdict.score.toFixed(1), unit: '/ 5 分', sub: kcalSub }
        : totalKcal === null
          ? { value: `${scene.mealsLogged}`, unit: '餐已记', sub: '今日餐食已完整记录' }
          : { value: `${totalKcal}`, unit: 'kcal', sub: '今日三餐已完整记录' },
  }
}

function buildExercise(input: ReportPosterInput): Built<ExercisePosterModel> {
  const { verdict, subject } = input
  const m = verdict.metrics
  const facts = verdict.facts?.module === 'exercise' ? verdict.facts : null
  const raw = subject.module === 'exercise' ? (subject.items ?? []) : []
  const minutes = num(m.minutes)
  const items: ExercisePosterItem[] =
    raw.length > 0
      ? raw.map((it, i) => ({
          name: it.name,
          minutes: it.minutes,
          detail:
            it.calc === 'count' ? (it.sets ? `${it.sets} 组` : '') : it.km ? `${it.km} 公里` : '',
          kcal: it.kcal ?? facts?.items[i]?.kcal ?? null,
          ok: verdict.checks[i]?.ok ?? verdict.isValid,
        }))
      : [
          {
            name: subject.module === 'exercise' ? subject.category : '运动',
            minutes,
            detail: '',
            kcal: null,
            ok: verdict.isValid,
          },
        ]
  const kcal = num(m.kcal)
  return {
    scene: {
      module: 'exercise',
      kcal,
      minutes,
      loadPct: Math.round(num(m.load) * 100),
      items,
    },
    kpi: {
      value: `${kcal}`,
      unit: 'kcal',
      sub: `${items.length} 项运动 · 共 ${trimNumber(minutes)} 分钟`,
    },
  }
}

function buildSleep(input: ReportPosterInput): Built<SleepPosterModel> {
  const { verdict, subject } = input
  const m = verdict.metrics
  const bed = typeof m.bedLocal === 'string' ? m.bedLocal : '23:00'
  const wake = typeof m.wakeLocal === 'string' ? m.wakeLocal : '07:00'
  const redline = typeof m.bedtimeBy === 'string' ? m.bedtimeBy : '23:30'
  const minutes = num(m.minutes, 480)
  const hours = num(m.hours, Math.round(minutes / 6) / 10)
  const adv = subject.module === 'sleep' ? subject.advanced : undefined
  return {
    scene: {
      module: 'sleep',
      hours,
      bed,
      wake,
      redline,
      lateBy: typeof m.lateByMinutes === 'number' ? m.lateByMinutes : null,
      regularity: typeof m.regularityMinutes === 'number' ? m.regularityMinutes : null,
      quality: subject.module === 'sleep' ? subject.quality : null,
      axis: buildSleepAxis(bed, redline, minutes),
      stages: [
        ...(adv?.deepMin != null ? [{ label: '深睡', value: `${adv.deepMin} 分钟` }] : []),
        ...(adv?.lightMin != null ? [{ label: '浅睡', value: `${adv.lightMin} 分钟` }] : []),
        ...(adv?.remPct != null ? [{ label: 'REM', value: `${trimNumber(adv.remPct)}%` }] : []),
        ...(adv?.hrvMs != null ? [{ label: 'HRV', value: `${trimNumber(adv.hrvMs)} ms` }] : []),
      ],
    },
    kpi: { value: trimNumber(hours), unit: '小时', sub: `${bed} 入睡 → ${wake} 起床` },
  }
}

function buildStudy(input: ReportPosterInput): Built<StudyPosterModel> {
  const { verdict, subject } = input
  const m = verdict.metrics
  const facts = verdict.facts?.module === 'study' ? verdict.facts : null
  const thisMin = num(m.minutes)
  const beforeMin = num(m.todayMinutesBefore)
  const totalMin = num(m.totalMinutes, thisMin + beforeMin)
  const inputPoints = subject.module === 'study' ? (subject.points ?? []) : []
  const { tomatoes, more } = buildTomatoes(totalMin)
  return {
    scene: {
      module: 'study',
      topic: subject.module === 'study' ? subject.what : input.goal.title,
      subjectLabel: facts?.subject || '专注学习',
      summary: facts?.summary ?? '',
      points: (facts?.keyPoints.length ? facts.keyPoints : inputPoints).slice(0, 5),
      thisMin,
      beforeMin,
      totalMin,
      tomatoes,
      moreTomatoes: more,
    },
    kpi: {
      value: trimNumber(totalMin),
      unit: '分钟',
      sub: beforeMin > 0 ? `本次 ${trimNumber(thisMin)} 分钟 · 今日累计` : '今日专注时长',
    },
  }
}

type GoalField = NonNullable<ReportPosterInput['goal']['fields']>[number]

/** 数值类字段拆成「数 + 单位」，没有达标条件时拿第一项当海报主数字 */
function customBigNumber(
  val: unknown,
  field: GoalField | undefined,
): { value: string; unit: string } | null {
  if (typeof val !== 'number' || !field) return null
  if (field.type === 'duration') return { value: `${Math.round(val / 60)}`, unit: '分钟' }
  if (field.type === 'rating') return { value: `${val}`, unit: '星' }
  if (field.type === 'number') return { value: trimNumber(val), unit: field.unit ?? '' }
  return null
}

function customValueText(val: unknown, field: GoalField | undefined): string {
  if (Array.isArray(val)) return val.join('、')
  if (typeof val === 'boolean') return val ? '是' : '否'
  if (field?.type === 'duration' && typeof val === 'number') return `${Math.round(val / 60)} 分钟`
  if (field?.type === 'rating') return `${String(val)} 星`
  return `${String(val)}${field?.type === 'number' && field.unit ? ` ${field.unit}` : ''}`
}

function buildCustom(input: ReportPosterInput): Built<CustomPosterModel> {
  const { verdict, subject } = input
  const facts = verdict.facts?.module === 'custom' ? verdict.facts : null
  const values = subject.module === 'custom' ? subject.values : {}
  const fieldMap = new Map((input.goal.fields ?? []).map((f) => [f.key, f]))
  const filled = Object.entries(values).filter(
    ([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0),
  )
  const entries = filled.map(([k, v]) => ({
    label: fieldMap.get(k)?.label ?? k,
    value: customValueText(v, fieldMap.get(k)),
  }))
  const big = filled
    .map(([k, v]) => ({
      label: fieldMap.get(k)?.label ?? k,
      num: customBigNumber(v, fieldMap.get(k)),
    }))
    .find((e) => e.num !== null)
  const passed = verdict.checks.filter((c) => c.ok).length
  const total = verdict.checks.length
  return {
    scene: {
      module: 'custom',
      entries,
      passed,
      total,
      comment: facts?.aiComment || subject.note || null,
    },
    kpi:
      total > 0
        ? { value: `${passed}/${total}`, unit: '项达标', sub: `今天记了 ${entries.length} 项` }
        : big?.num
          ? { value: big.num.value, unit: big.num.unit, sub: big.label }
          : { value: `${entries.length}`, unit: '项记录', sub: '今天也认真记下来了' },
  }
}

function buildScene(input: ReportPosterInput): Built<ScenePosterModel> {
  switch (input.module) {
    case 'diet':
      return buildDiet(input)
    case 'exercise':
      return buildExercise(input)
    case 'sleep':
      return buildSleep(input)
    case 'study':
      return buildStudy(input)
    case 'custom':
      return buildCustom(input)
  }
}

export function buildPosterModel(input: ReportPosterInput): PosterModel {
  const status = buildStatus(input)
  const { scene, kpi } = buildScene(input)
  const skipped = status.kind === 'skipped'
  return {
    module: input.module,
    moduleBadge: `${moduleMeta[input.module].label} · ${skipped ? '请假条' : MODULE_BADGE[input.module]}`,
    title: input.goal.title,
    dateText: formatPosterDate(input.today),
    dayText: `DAY ${input.period.done}/${input.period.total}`,
    status,
    kpi,
    detail: input.verdict.detail,
    advice: input.verdict.advice[0] ?? null,
    checks: input.verdict.checks,
    skipReason: skipped ? (input.subject.skipReason?.trim() ?? '') : null,
    scene,
  }
}
