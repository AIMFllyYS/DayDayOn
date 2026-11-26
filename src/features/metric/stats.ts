import { addDays, isoWeekday, type LocalDateString } from '@/lib/time'

/*
 * 每日指标（体重 / 心情 / 步数）统计纯函数：
 * 零 React / DOM / 系统时区依赖，全部基于 YYYY-MM-DD 日历偏移，供 /metrics/[metric]「统计图」Tab 消费并带完整单测。
 */

export interface DatedNumber {
  localDate: LocalDateString
  value: number
}

export type MetricRangeDays = 30 | 90 | 365

/** 按区间天数切片（含 endDate 当天往前 days 天） */
export function filterByDays<T extends { localDate: LocalDateString }>(
  entries: readonly T[],
  endDate: LocalDateString,
  days: number,
): T[] {
  const start = addDays(endDate, -(Math.max(1, Math.floor(days)) - 1))
  return entries.filter((e) => e.localDate >= start && e.localDate <= endDate)
}

export interface MonthlyBucket {
  month: string // YYYY-MM
  label: string // e.g. '11月'
  average: number | null
  count: number
}

/** 最近 N 个自然月（含 endDate 所在月）的月度均值，升序排列 */
export function monthlyAverages(
  entries: readonly DatedNumber[],
  endDate: LocalDateString,
  months = 6,
  decimals = 1,
): MonthlyBucket[] {
  const [yStr, mStr] = endDate.split('-')
  const endY = Number(yStr)
  const endM = Number(mStr)
  const keys: string[] = []
  for (let i = months - 1; i >= 0; i -= 1) {
    const total = endY * 12 + (endM - 1) - i
    const y = Math.floor(total / 12)
    const m = (total % 12) + 1
    keys.push(`${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`)
  }

  const byMonth = new Map<string, number[]>()
  for (const e of entries) {
    const mk = e.localDate.slice(0, 7)
    const list = byMonth.get(mk)
    if (list) list.push(e.value)
    else byMonth.set(mk, [e.value])
  }

  const factor = 10 ** decimals
  return keys.map((month) => {
    const vals = byMonth.get(month) ?? []
    const average =
      vals.length > 0
        ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * factor) / factor
        : null
    return {
      month,
      label: `${Number(month.slice(5, 7))}月`,
      average,
      count: vals.length,
    }
  })
}

export interface WeekdayBucket {
  /** ISO 星期 1=周一 … 7=周日 */
  weekday: number
  label: string
  average: number | null
  count: number
}

const WEEKDAY_SHORT = ['一', '二', '三', '四', '五', '六', '日'] as const

/** 按周一~周日统计均值规律 */
export function weekdayAverages(entries: readonly DatedNumber[], decimals = 1): WeekdayBucket[] {
  const sums = [0, 0, 0, 0, 0, 0, 0]
  const counts = [0, 0, 0, 0, 0, 0, 0]
  for (const e of entries) {
    const idx = isoWeekday(e.localDate) - 1
    if (idx >= 0 && idx < 7) {
      sums[idx] = (sums[idx] ?? 0) + e.value
      counts[idx] = (counts[idx] ?? 0) + 1
    }
  }
  const factor = 10 ** decimals
  return WEEKDAY_SHORT.map((label, idx) => {
    const count = counts[idx] ?? 0
    const average = count > 0 ? Math.round(((sums[idx] ?? 0) / count) * factor) / factor : null
    return { weekday: idx + 1, label: `周${label}`, average, count }
  })
}

export interface WeightSummaryStats {
  count: number
  latestKg: number | null
  minKg: number | null
  maxKg: number | null
  avgKg: number | null
  /** 区间首尾净变化（kg），少于 2 条为 null */
  netChangeKg: number | null
  /** 结合身高计算的 BMI（保留 1 位小数），缺少体重或身高为 null */
  bmi: number | null
  bmiLabel: string | null
}

/** 体重区间摘要与 BMI 参考（非医疗建议） */
export function computeWeightStats(
  entries: readonly { localDate: LocalDateString; weightGrams: number }[],
  heightCm?: number | null,
): WeightSummaryStats {
  const count = entries.length
  if (count === 0) {
    return {
      count: 0,
      latestKg: null,
      minKg: null,
      maxKg: null,
      avgKg: null,
      netChangeKg: null,
      bmi: null,
      bmiLabel: null,
    }
  }
  const kgs = entries.map((e) => Math.round((e.weightGrams / 1000) * 10) / 10)
  const latestKg = kgs.at(-1)!
  const firstKg = kgs[0]!
  const minKg = Math.min(...kgs)
  const maxKg = Math.max(...kgs)
  const avgKg = Math.round((kgs.reduce((s, v) => s + v, 0) / count) * 10) / 10
  const netChangeKg = count >= 2 ? Math.round((latestKg - firstKg) * 10) / 10 : null

  let bmi: number | null = null
  let bmiLabel: string | null = null
  if (heightCm && heightCm >= 80 && heightCm <= 250) {
    const m = heightCm / 100
    bmi = Math.round((latestKg / (m * m)) * 10) / 10
    bmiLabel = bmi < 18.5 ? '偏轻' : bmi < 24 ? '正常' : bmi < 28 ? '偏重' : '偏高'
  }
  return { count, latestKg, minKg, maxKg, avgKg, netChangeKg, bmi, bmiLabel }
}

export interface MoodBucket {
  value: 1 | 2 | 3 | 4 | 5
  label: string
  count: number
  percent: number
}

export interface MoodSummaryStats {
  count: number
  average: number | null
  /** 好心情（>= 4 分）占比 0–100 */
  goodRate: number | null
  /** 最长连续好心情（>= 4 分且日期连续）天数 */
  longestGoodStreak: number
  distribution: MoodBucket[]
}

const MOOD_BUCKET_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  5: '超棒',
  4: '不错',
  3: '一般',
  2: '不太好',
  1: '很糟',
}

/** 心情五档分布、好心情占比与最长好心情连击 */
export function computeMoodStats(
  entries: readonly { localDate: LocalDateString; value: number }[],
): MoodSummaryStats {
  const count = entries.length
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let sum = 0
  let goodCount = 0
  let longestGoodStreak = 0
  let currentStreak = 0
  let prevGoodDate: LocalDateString | null = null

  for (const e of entries) {
    const v = Math.max(1, Math.min(5, Math.round(e.value)))
    counts[v] = (counts[v] ?? 0) + 1
    sum += v
    if (v >= 4) {
      goodCount += 1
      if (prevGoodDate && addDays(prevGoodDate, 1) === e.localDate) {
        currentStreak += 1
      } else {
        currentStreak = 1
      }
      prevGoodDate = e.localDate
      if (currentStreak > longestGoodStreak) longestGoodStreak = currentStreak
    } else {
      currentStreak = 0
      prevGoodDate = null
    }
  }

  const distribution: MoodBucket[] = ([5, 4, 3, 2, 1] as const).map((value) => {
    const c = counts[value] ?? 0
    return {
      value,
      label: MOOD_BUCKET_LABELS[value],
      count: c,
      percent: count > 0 ? Math.round((c / count) * 100) : 0,
    }
  })

  return {
    count,
    average: count > 0 ? Math.round((sum / count) * 10) / 10 : null,
    goodRate: count > 0 ? Math.round((goodCount / count) * 100) : null,
    longestGoodStreak,
    distribution,
  }
}

export interface DailyStepBar {
  localDate: LocalDateString
  dayLabel: string
  steps: number | null
}

export interface StepsSummaryStats {
  count: number
  totalSteps: number
  avgSteps: number | null
  maxSteps: number | null
  maxDate: LocalDateString | null
  /** 估算累计步行距离（按 1 步 ≈ 0.72 米，保留 1 位小数） */
  estimatedKm: number
  /** 达到参考虚线的天数；若关闭参考虚线（threshold === null）返回 null */
  reachedDays: number | null
  /** 近 14 天每日柱图序列（无记录日为 null） */
  recent14Days: DailyStepBar[]
}

/** 步数区间统计（联动用户自定义参考线 dailyStepTarget） */
export function computeStepsStats(
  entries: readonly { localDate: LocalDateString; steps: number }[],
  endDate: LocalDateString,
  threshold: number | null,
): StepsSummaryStats {
  const count = entries.length
  let totalSteps = 0
  let maxSteps: number | null = null
  let maxDate: LocalDateString | null = null
  let reached = 0

  const byDate = new Map<LocalDateString, number>()
  for (const e of entries) {
    totalSteps += e.steps
    byDate.set(e.localDate, e.steps)
    if (maxSteps === null || e.steps > maxSteps) {
      maxSteps = e.steps
      maxDate = e.localDate
    }
    if (threshold !== null && e.steps >= threshold) {
      reached += 1
    }
  }

  const recent14Days: DailyStepBar[] = []
  for (let i = 13; i >= 0; i -= 1) {
    const d = addDays(endDate, -i)
    recent14Days.push({
      localDate: d,
      dayLabel: `${Number(d.slice(8, 10))}`,
      steps: byDate.get(d) ?? null,
    })
  }

  return {
    count,
    totalSteps,
    avgSteps: count > 0 ? Math.round(totalSteps / count) : null,
    maxSteps,
    maxDate,
    estimatedKm: Math.round((totalSteps * 0.72) / 100) / 10,
    reachedDays: threshold !== null ? reached : null,
    recent14Days,
  }
}
