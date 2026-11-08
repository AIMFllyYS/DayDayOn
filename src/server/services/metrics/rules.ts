import 'server-only'
import {
  STEPS_MAX,
  STEPS_MIN,
  WEIGHT_CONFIRM_DELTA_GRAMS,
  WEIGHT_MAX_GRAMS,
  WEIGHT_MIN_GRAMS,
  type StepEntry,
  type StepTrend,
  type WeightEntry,
} from '@/features/metric/schemas'
import type { LocalDate } from '@/features/shared/schemas'
import { addDays } from '@/lib/time'

/*
 * 每日指标的纯规则（PRD 2.5、3「体重异常值」+ Issue #57 每日步数）。带单测（rules.test.ts）。
 */

export function isWeightInRange(grams: number): boolean {
  return Number.isInteger(grams) && grams >= WEIGHT_MIN_GRAMS && grams <= WEIGHT_MAX_GRAMS
}

export function isStepsInRange(steps: number): boolean {
  return Number.isInteger(steps) && steps >= STEPS_MIN && steps <= STEPS_MAX
}

/** 和上一条相差超过 3 kg（严格大于）需要确认；没有上一条不需要 */
export function needsWeightConfirm(previousGrams: number | null, grams: number): boolean {
  return previousGrams !== null && Math.abs(grams - previousGrams) > WEIGHT_CONFIRM_DELTA_GRAMS
}

/**
 * 走势摘要：latest = 最近一条；deltaGrams7d = latest − （latest 日期 7 天前当天或更早的最近一条）。
 * entries 按日期升序，可以比展示窗口更长（为了找到 7 天前的那条）。
 */
export function weightSummary(
  entries: readonly WeightEntry[],
  windowStart: LocalDate,
): { entries: WeightEntry[]; latest: WeightEntry | null; deltaGrams7d: number | null } {
  const latest = entries.at(-1) ?? null
  let delta: number | null = null
  if (latest) {
    const cutoff = addDays(latest.localDate, -7)
    const base = entries.filter((e) => e.localDate <= cutoff).at(-1)
    if (base) delta = latest.weightGrams - base.weightGrams
  }
  return { entries: entries.filter((e) => e.localDate >= windowStart), latest, deltaGrams7d: delta }
}

/**
 * 步数走势摘要：
 * - todaySteps：若今天（today）有记录则取今天步数，否则固定为 0（防纯网页端报错）；
 * - deltaSteps7d：最近一条与 7 天前记录的差值。
 */
export function stepSummary(
  entries: readonly StepEntry[],
  windowStart: LocalDate,
  today: LocalDate,
): StepTrend {
  const latest = entries.at(-1) ?? null
  const todayEntry = entries.find((e) => e.localDate === today)
  const todaySteps = todayEntry ? Math.max(0, todayEntry.steps) : 0
  let delta: number | null = null
  if (latest) {
    const cutoff = addDays(latest.localDate, -7)
    const base = entries.filter((e) => e.localDate <= cutoff).at(-1)
    if (base) delta = latest.steps - base.steps
  }
  return {
    todaySteps,
    entries: entries.filter((e) => e.localDate >= windowStart),
    latest,
    deltaSteps7d: delta,
  }
}
