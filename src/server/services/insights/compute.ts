import 'server-only'
import type { GoalInsight, InsightDays } from '@/features/insights/schemas'
import { effectiveRules } from '@/features/referee/defaults'
import type { Verdict } from '@/features/referee/schemas'
import type { LocalDate, Module } from '@/features/shared/schemas'
import { addDays, compareLocalDate, daysBetween, eachLocalDate, localTimeOf } from '@/lib/time'

/*
 * 板块近况的纯计算（features/insights/schemas.ts）。不碰数据库、不读当前时间；查询在 ./index.ts。
 * 「达标没有」只认入库时服务端算好的 isValid / score / verdict，不在这里重判。
 */

export interface InsightGoal {
  id: string
  module: Module
  title: string
  refereeRules: unknown
  deadlineDate: LocalDate | null
}

export interface InsightRow {
  localDate: LocalDate
  isValid: boolean
  score: number | null
  durationSeconds: number | null
  intakeKcal: number | null
  burnKcal: number | null
  payload: unknown
  verdict: Verdict | null
}

/** 统计范围：含今天往前 days 天 */
export function insightRange(
  today: LocalDate,
  days: InsightDays,
): { from: LocalDate; to: LocalDate } {
  return { from: addDays(today, -(days - 1)), to: today }
}

const round1 = (n: number) => Math.round(n * 10) / 10
const mean = (xs: readonly number[]) =>
  xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length

/** 'HH:mm' → 分钟；中午 12 点之前算作次日凌晨（+1440），这样 23:30 和 00:30 能求平均 */
export function nightMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  const v = (h ?? 0) * 60 + (m ?? 0)
  return v < 720 ? v + 1440 : v
}

function bedTimeOf(payload: unknown, timeZone: string): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const bedAt = (payload as { bedAt?: unknown }).bedAt
  return typeof bedAt === 'string' ? localTimeOf(bedAt, timeZone) : null
}

/** 逐项核验里最常没通过的一条 */
export function topFailureOf(rows: readonly InsightRow[]): GoalInsight['topFailure'] {
  const counts = new Map<string, { text: string; count: number }>()
  let judged = 0
  for (const r of rows) {
    if (!r.verdict) continue
    judged += 1
    for (const c of r.verdict.checks) {
      if (c.ok) continue
      const cur = counts.get(c.id)
      if (cur) {
        cur.count += 1
        cur.text = c.text
      } else counts.set(c.id, { text: c.text, count: 1 })
    }
  }
  let best: { text: string; count: number } | null = null
  for (const v of counts.values()) if (!best || v.count > best.count) best = v
  return best ? { text: best.text, count: best.count, of: judged } : null
}

function dailySeries(
  dates: readonly LocalDate[],
  byDate: Map<LocalDate, InsightRow[]>,
  pick: (rows: InsightRow[]) => number | null,
) {
  return dates.map((date) => {
    const rows = byDate.get(date)
    return { date, value: rows && rows.length > 0 ? pick(rows) : null }
  })
}

const sumSeconds = (rows: readonly InsightRow[]) =>
  rows.reduce((a, r) => a + Math.max(0, r.durationSeconds ?? 0), 0)

export function computeGoalInsight(input: {
  goal: InsightGoal
  rows: readonly InsightRow[]
  today: LocalDate
  days: InsightDays
  timeZone: string
}): GoalInsight {
  const { goal, rows, today, days, timeZone } = input
  const { from, to } = insightRange(today, days)
  const dates = eachLocalDate(from, to)
  const inRange = rows.filter(
    (r) => compareLocalDate(r.localDate, from) >= 0 && compareLocalDate(r.localDate, to) <= 0,
  )
  const byDate = new Map<LocalDate, InsightRow[]>()
  for (const r of inRange) {
    const list = byDate.get(r.localDate)
    if (list) list.push(r)
    else byDate.set(r.localDate, [r])
  }
  const valid = inRange.filter((r) => r.isValid)

  const base: GoalInsight = {
    goalId: goal.id,
    module: goal.module,
    title: goal.title,
    total: inRange.length,
    valid: valid.length,
    validDays: new Set(valid.map((r) => r.localDate)).size,
    avgScore: null,
    passScore: null,
    totalSeconds: 0,
    dailyTargetSeconds: null,
    kcal: null,
    avgSleepSeconds: null,
    avgBedMinutes: null,
    lateNights: null,
    bedtimeBy: null,
    minSleepSeconds: null,
    series: [],
    topFailure: topFailureOf(inRange),
    deadline:
      goal.deadlineDate === null
        ? null
        : { date: goal.deadlineDate, daysLeft: Math.max(0, daysBetween(today, goal.deadlineDate)) },
  }

  switch (goal.module) {
    case 'diet': {
      const rules = effectiveRules('diet', goal.refereeRules)
      const scores = inRange.flatMap((r) => (r.score === null ? [] : [r.score]))
      const avg = mean(scores)
      const kcals = inRange.flatMap((r) => (r.intakeKcal === null ? [] : [r.intakeKcal]))
      const avgKcal = mean(kcals)
      return {
        ...base,
        avgScore: avg === null ? null : round1(avg),
        passScore: rules.passScore,
        kcal: avgKcal === null ? null : Math.round(avgKcal),
        series: dailySeries(dates, byDate, (list) => {
          const s = mean(list.flatMap((r) => (r.score === null ? [] : [r.score])))
          return s === null ? null : round1(s)
        }),
      }
    }
    case 'exercise': {
      const kcals = inRange.flatMap((r) => (r.burnKcal === null ? [] : [r.burnKcal]))
      return {
        ...base,
        totalSeconds: sumSeconds(inRange),
        kcal: kcals.length === 0 ? null : kcals.reduce((a, b) => a + b, 0),
        series: dailySeries(dates, byDate, sumSeconds),
      }
    }
    case 'study': {
      const rules = effectiveRules('study', goal.refereeRules)
      return {
        ...base,
        totalSeconds: sumSeconds(inRange),
        dailyTargetSeconds: rules.minFocusMinutes * 60,
        series: dailySeries(dates, byDate, sumSeconds),
      }
    }
    case 'sleep': {
      const rules = effectiveRules('sleep', goal.refereeRules)
      const secs = inRange.flatMap((r) => (r.durationSeconds === null ? [] : [r.durationSeconds]))
      const beds = inRange.flatMap((r) => {
        const t = bedTimeOf(r.payload, timeZone)
        return t === null ? [] : [nightMinutes(t)]
      })
      const avgSecs = mean(secs)
      const avgBed = mean(beds)
      const redLine = nightMinutes(rules.bedtimeBy)
      return {
        ...base,
        avgSleepSeconds: avgSecs === null ? null : Math.round(avgSecs),
        avgBedMinutes: avgBed === null ? null : Math.round(avgBed) % 1440,
        lateNights: beds.filter((b) => b > redLine).length,
        bedtimeBy: rules.bedtimeBy,
        minSleepSeconds: Math.round(rules.minHours * 3600),
        series: dailySeries(dates, byDate, (list) =>
          Math.max(...list.map((r) => r.durationSeconds ?? 0)),
        ),
      }
    }
    case 'custom':
      return {
        ...base,
        series: dailySeries(dates, byDate, (list) => list.filter((r) => r.isValid).length),
      }
  }
}
