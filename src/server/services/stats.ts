import 'server-only'
import type { GoalProgress } from '@/features/checkin/schemas'
import type { TargetOnDay } from '@/features/goal/schemas'
import type { LocalDate, Module } from '@/features/shared/schemas'
import { addDays, isoWeekday } from '@/lib/time'

/*
 * 共享统计（PRD 7.2）：纯函数，不碰数据库，不读当前时间。
 * 签名与类型 F1；实现 P2（带单测）；D1、D3、D4 只调用。
 */

/** 统计用的一条打卡（从 checkins 行取需要的列） */
export interface StatCheckin {
  localDate: LocalDate
  isMakeup: boolean
  durationSeconds: number | null
  count: number
  /** 饮食计次用：payload.mealType；其余板块为 null */
  mealType: string | null
  /** 统计排序用（排行并列时按最后一次打卡时间） */
  occurredAt: string
  /** false = 未达标仅存档：不计进度、完成度、连续天数与排行（checkin-modules.md 第 3.4 节） */
  isValid: boolean
  /** true = 多阶段打卡尚未集齐（如饮食 1/3、2/3 待三餐汇总）：计入当日阶段进度，但不算完成（done=false）且非未达标存档 */
  pending?: boolean
}

export interface GoalWithProgress {
  goalId: string
  module: Module
  /** 当天是否在计划星期里（isPlannedOn） */
  planned: boolean
  progress: GoalProgress
}

/** goal_targets 的一行：从 effectiveFrom 这天起生效的目标量与计划星期 */
export interface TargetVersion extends TargetOnDay {
  effectiveFrom: LocalDate
}

/**
 * 某天生效的目标量（PRD 7.2「目标量历史」）：effectiveFrom ≤ localDate 里最新的一行。
 * 早于第一行的日子（例如建目标当天补昨天）用最早的一行；history 为空返回 null。
 * history 不要求有序。
 */
export function targetOnDay(
  history: readonly TargetVersion[],
  localDate: LocalDate,
): TargetOnDay | null {
  let effective: TargetVersion | null = null
  let earliest: TargetVersion | null = null
  for (const row of history) {
    if (earliest === null || row.effectiveFrom < earliest.effectiveFrom) earliest = row
    if (
      row.effectiveFrom <= localDate &&
      (effective === null || row.effectiveFrom > effective.effectiveFrom)
    ) {
      effective = row
    }
  }
  const picked = effective ?? earliest
  return picked === null
    ? null
    : { kind: picked.kind, value: picked.value, weekdays: picked.weekdays }
}

/** 某天是否在计划星期里（ISO 1–7） */
export function isPlannedOn(target: TargetOnDay, localDate: LocalDate): boolean {
  return target.weekdays.includes(isoWeekday(localDate))
}

/**
 * 某个目标某天的进度（PRD 3「频次」、7.2）：
 * duration 累加 durationSeconds；睡眠取当天那条的时长；
 * 饮食 count = 当天不同餐次数；其余 count 类按记录数。
 * checkinsOfDay 只含该目标该打卡日的记录。补卡计入进度；未达标（isValid = false）不计。
 */
export function goalDayProgress(
  target: TargetOnDay,
  module: Module,
  checkinsOfDay: readonly StatCheckin[],
): GoalProgress {
  const valid = checkinsOfDay.filter((c) => c.isValid)
  if (module === 'diet' && valid.length === 0) {
    const pendingMainMeals = new Set(
      checkinsOfDay.flatMap((c) =>
        c.pending &&
        (c.mealType === 'breakfast' || c.mealType === 'lunch' || c.mealType === 'dinner')
          ? [c.mealType]
          : [],
      ),
    ).size
    if (pendingMainMeals > 0) {
      return { value: pendingMainMeals, target: Math.max(3, target.value), done: false }
    }
  }
  const value =
    target.kind === 'duration' ? durationValue(module, valid) : countValue(module, valid)
  return { value, target: target.value, done: value >= target.value }
}

function durationValue(module: Module, checkins: readonly StatCheckin[]): number {
  const seconds = checkins.map((c) => Math.max(0, c.durationSeconds ?? 0))
  // 睡眠每个打卡日只有一条（唯一索引）；万一出现多条取最长的，不累加
  if (module === 'sleep') return seconds.length === 0 ? 0 : Math.max(...seconds)
  return seconds.reduce((sum, s) => sum + s, 0)
}

function countValue(module: Module, checkins: readonly StatCheckin[]): number {
  if (module === 'diet') {
    // 同一餐记多条只算一次；若某条因豁免跳过了整天目标（count > 1），取较大值
    const maxCount = checkins.reduce((m, c) => Math.max(m, c.count), 0)
    const meals = new Set(checkins.flatMap((c) => (c.mealType === null ? [] : [c.mealType]))).size
    return Math.max(maxCount, meals)
  }
  // 睡眠按"当天那一条"：最多 1 次
  if (module === 'sleep') return Math.min(1, checkins.length)
  return checkins.reduce((sum, c) => sum + Math.max(1, c.count), 0)
}

/** 当天完成度：只数计划内的目标（不在计划日的打卡计入进度，但不计入 planned） */
export function dayCompletion(goalsWithProgress: readonly GoalWithProgress[]): {
  done: number
  planned: number
} {
  let done = 0
  let planned = 0
  for (const g of goalsWithProgress) {
    if (!g.planned) continue
    planned += 1
    if (g.progress.done) done += 1
  }
  return { done, planned }
}

/**
 * 连续天数（PRD 3）：从 today（今天还没打卡就从昨天）往回数，连续有任意有效打卡（含补卡）的打卡日数。
 * checkinDates 可重复、无序；晚于 today 的日期忽略。调用方只传 isValid = true 的记录的日期
 * （用 validDates() 过滤）。
 */
export function computeStreak(checkinDates: readonly LocalDate[], today: LocalDate): number {
  const dates = new Set(checkinDates)
  let cursor = dates.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (dates.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

/** 连续天数的输入：只取有效打卡的日期 */
export function validDates(
  rows: readonly Pick<StatCheckin, 'localDate' | 'isValid'>[],
): LocalDate[] {
  return rows.filter((r) => r.isValid).map((r) => r.localDate)
}

/** 排行计分（PRD 2.9、3）：排除补卡与未达标、同日去重后的打卡日数。rows 已按范围过滤 */
export function countRankDays(
  rows: readonly Pick<StatCheckin, 'localDate' | 'isMakeup' | 'isValid'>[],
): number {
  return new Set(rows.filter((r) => !r.isMakeup && r.isValid).map((r) => r.localDate)).size
}

/**
 * 热力图一格（PRD 7.2）：该板块当天已完成的计划目标数 / 当天计划目标数；
 * 没有计划但有打卡记 1；都没有为 0。返回 0..1。
 * progresses 与 goalsOfModule 按下标一一对应。
 */
export function heatmapCell(
  goalsOfModule: readonly Pick<GoalWithProgress, 'planned'>[],
  progresses: readonly GoalProgress[],
): number {
  if (goalsOfModule.length !== progresses.length) {
    throw new RangeError('heatmapCell：goalsOfModule 与 progresses 长度不一致')
  }
  let planned = 0
  let done = 0
  let anyCheckin = false
  goalsOfModule.forEach((g, i) => {
    const p = progresses[i]
    if (p === undefined) return
    if (p.value > 0) anyCheckin = true
    if (!g.planned) return
    planned += 1
    if (p.done) done += 1
  })
  if (planned === 0) return anyCheckin ? 1 : 0
  return done / planned
}
