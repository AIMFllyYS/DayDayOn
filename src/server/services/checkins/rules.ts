import 'server-only'
import type { CalendarDay, CheckinPayload, DietItem, Intensity } from '@/features/checkin/schemas'
import { EXERCISE_CATEGORIES } from '@/features/checkin/schemas'
import type { TargetOnDay } from '@/features/goal/schemas'
import type { LocalDate, Module } from '@/features/shared/schemas'
import { addDays, combineLocal, localDateOf } from '@/lib/time'
import { goalDayProgress, type StatCheckin } from '@/server/services/stats'

/*
 * 打卡的纯规则（PRD 2.4、3、7.2）：不碰数据库、不读当前时间，全部带单测（rules.test.ts）。
 */

/** 用户资料里的时区与日切换时间 */
export interface Clock {
  timeZone: string
  dayStartHour: number
}

/** 今天的打卡日；补卡时为昨天 */
export function targetDayOf(now: Date, clock: Clock, isMakeup: boolean): LocalDate {
  const today = localDateOf(now, clock.timeZone, clock.dayStartHour)
  return isMakeup ? addDays(today, -1) : today
}

/**
 * 非睡眠打卡的时刻由服务端定（PRD 7.2）：取 now；补卡取昨天打卡日 12:00（用户时区）。
 */
export function serverOccurredAt(now: Date, clock: Clock, isMakeup: boolean): Date {
  if (!isMakeup) return now
  return combineLocal(targetDayOf(now, clock, true), '12:00', clock.timeZone)
}

export type SleepCheck = { ok: true; occurredAt: Date } | { ok: false; reason: string }

/**
 * 睡眠时刻校验（PRD 7.2）：wakeAt ≤ now，且 localDateOf(wakeAt) 等于今天（补卡时为昨天）。
 * 时长范围（30 分钟–20 小时）由请求 schema 校验。睡眠记到起床时刻所在的打卡日（PRD 3）。
 */
export function checkSleepTimes(
  bedAt: Date,
  wakeAt: Date,
  now: Date,
  clock: Clock,
  isMakeup: boolean,
): SleepCheck {
  if (bedAt.getTime() >= wakeAt.getTime()) return { ok: false, reason: '入睡要早于起床' }
  if (wakeAt.getTime() > now.getTime()) return { ok: false, reason: '起床时间还没到' }
  const expected = targetDayOf(now, clock, isMakeup)
  if (localDateOf(wakeAt, clock.timeZone, clock.dayStartHour) !== expected) {
    return { ok: false, reason: isMakeup ? '只能补昨天的睡眠' : '起床时间不在今天' }
  }
  return { ok: true, occurredAt: wakeAt }
}

// ---------------------------------------------------------------------------
// 运动消耗：MET × 体重(kg) × 时长(h)（PRD 2.4），估算结果，非医疗建议
// ---------------------------------------------------------------------------

type MetRow = Record<Intensity, number>

/** 按 Compendium of Physical Activities 的常见取值取整；"其他"和用户新建的品类用最后一行 */
export const MET_TABLE: Record<(typeof EXERCISE_CATEGORIES)[number], MetRow> = {
  跑步: { easy: 6, moderate: 8.3, hard: 11 },
  快走: { easy: 3.5, moderate: 4.3, hard: 5 },
  骑行: { easy: 4, moderate: 6.8, hard: 10 },
  游泳: { easy: 5.8, moderate: 7, hard: 9.8 },
  跳绳: { easy: 8.8, moderate: 11.8, hard: 12.3 },
  球类: { easy: 4.5, moderate: 6.5, hard: 8 },
  力量: { easy: 3.5, moderate: 5, hard: 6 },
  瑜伽: { easy: 2.5, moderate: 3, hard: 4 },
  舞蹈: { easy: 4.5, moderate: 5.5, hard: 7.8 },
  其他: { easy: 3, moderate: 4.5, hard: 6 },
}

function isPresetCategory(c: string): c is keyof typeof MET_TABLE {
  return Object.hasOwn(MET_TABLE, c)
}

export function metOf(category: string, intensity: Intensity): number {
  return (isPresetCategory(category) ? MET_TABLE[category] : MET_TABLE.其他)[intensity]
}

/** 没有体重记录时不估算，返回 null */
export function estimateBurnKcal(
  category: string,
  intensity: Intensity,
  durationSeconds: number,
  weightGrams: number | null,
): number | null {
  if (weightGrams === null || weightGrams <= 0) return null
  return Math.round(metOf(category, intensity) * (weightGrams / 1000) * (durationSeconds / 3600))
}

/** 饮食摄入：有热量的条目求和；全部没填为 null（手动填写时热量可空） */
export function intakeKcalOf(items: readonly DietItem[]): number | null {
  const known = items.flatMap((i) => (i.kcal === null ? [] : [i.kcal]))
  return known.length === 0 ? null : known.reduce((s, k) => s + k, 0)
}

// ---------------------------------------------------------------------------
// 统计
// ---------------------------------------------------------------------------

/** 一条打卡行 → stats 的输入 */
export function toStatCheckin(row: {
  localDate: LocalDate
  isMakeup: boolean
  durationSeconds: number | null
  count: number
  payload: CheckinPayload
  occurredAt: Date
}): StatCheckin {
  return {
    localDate: row.localDate,
    isMakeup: row.isMakeup,
    durationSeconds: row.durationSeconds,
    count: row.count,
    mealType: row.payload.module === 'diet' ? row.payload.mealType : null,
    occurredAt: row.occurredAt.toISOString(),
  }
}

/** 日历：按打卡日聚合，只列出有打卡的日子，按日期升序 */
export function calendarDays(
  rows: readonly StatCheckin[],
  module: Module,
  targetFor: (localDate: LocalDate) => TargetOnDay,
): CalendarDay[] {
  const byDate = new Map<LocalDate, StatCheckin[]>()
  for (const r of rows) byDate.set(r.localDate, [...(byDate.get(r.localDate) ?? []), r])
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([localDate, list]) => ({
      localDate,
      count: list.length,
      done: goalDayProgress(targetFor(localDate), module, list).done,
      makeupOnly: list.every((c) => c.isMakeup),
    }))
}

/** 'YYYY-MM' → [当月 1 日, 次月 1 日)（查询用半开区间） */
export function monthBounds(month: string): { from: LocalDate; until: LocalDate } {
  const from = `${month}-01`
  return { from, until: `${addDays(from, 32).slice(0, 7)}-01` }
}

// ---------------------------------------------------------------------------
// 游标：服务端编码的不透明字符串（api-conventions.md 第 10 节）
// ---------------------------------------------------------------------------

export interface HistoryCursor {
  localDate: LocalDate
  id: string
}

export function encodeCursor(c: HistoryCursor): string {
  return Buffer.from(JSON.stringify([c.localDate, c.id]), 'utf8').toString('base64url')
}

/** 解析失败返回 null（handler 映射成 400） */
export function decodeCursor(raw: string): HistoryCursor | null {
  try {
    const v: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    if (
      Array.isArray(v) &&
      v.length === 2 &&
      typeof v[0] === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(v[0]) &&
      typeof v[1] === 'string' &&
      /^[0-9a-f-]{36}$/i.test(v[1])
    ) {
      return { localDate: v[0], id: v[1] }
    }
    return null
  } catch {
    return null
  }
}

/** Postgres 唯一约束冲突（drizzle 把驱动错误包在 cause 里，逐层找） */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  let e: unknown = error
  for (let depth = 0; depth < 5 && typeof e === 'object' && e !== null; depth += 1) {
    const { code, constraint: name } = e as { code?: unknown; constraint?: unknown }
    if (code === '23505') return constraint === undefined || name === constraint
    e = (e as { cause?: unknown }).cause
  }
  return false
}
