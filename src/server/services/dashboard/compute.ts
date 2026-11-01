import 'server-only'
import type { TodayGoal } from '@/features/checkin/schemas'
import type { Reminder, WeekHeatmap } from '@/features/dashboard/schemas'
import type { WeightEntry, WeightTrend } from '@/features/metric/schemas'
import { MODULES, type LocalDate, type Module } from '@/features/shared/schemas'
import { addDays, compareLocalDate, parseLocalTime } from '@/lib/time'
import {
  dayCompletion,
  goalDayProgress,
  heatmapCell,
  isPlannedOn,
  targetOnDay,
  type GoalWithProgress,
  type StatCheckin,
  type TargetVersion,
} from '@/server/services/stats'

/*
 * 主页仪表盘的纯规则（PRD 2.8、7.1 提醒、7.2 统计）。不碰数据库、不读当前时间；查询在 ./index.ts。
 * 进度、完成度、热力图格值全部经 stats.ts 计算，这里只负责按目标 × 日期组织数据。
 */

/** 进行中目标 + 它的目标量历史（goal_targets） */
export interface DashboardGoal {
  id: string
  module: Module
  title: string
  sortOrder: number
  history: readonly TargetVersion[]
}

/** 统计用的一条打卡，带所属目标 */
export interface GoalCheckin extends StatCheckin {
  goalId: string
}

/** goalId → localDate → 当天的打卡 */
export type CheckinIndex = Map<string, Map<LocalDate, StatCheckin[]>>

export function indexCheckins(rows: readonly GoalCheckin[]): CheckinIndex {
  const index: CheckinIndex = new Map()
  for (const row of rows) {
    let byDate = index.get(row.goalId)
    if (!byDate) index.set(row.goalId, (byDate = new Map()))
    const list = byDate.get(row.localDate)
    if (list) list.push(row)
    else byDate.set(row.localDate, [row])
  }
  return index
}

/** 目标最早生效的那天（建目标当天）；没有历史返回 null */
function firstEffectiveDate(goal: DashboardGoal): LocalDate | null {
  let first: LocalDate | null = null
  for (const row of goal.history) {
    if (first === null || compareLocalDate(row.effectiveFrom, first) < 0) first = row.effectiveFrom
  }
  return first
}

export interface GoalDay extends GoalWithProgress {
  target: { kind: TodayGoal['target']['kind']; value: number }
  /** 当天有没有打卡记录 */
  hasCheckins: boolean
}

/**
 * 某个目标某天的状态。目标建立之前的日子不算计划内（否则新目标会拉低本周热力图），
 * 但那天如果有记录（建目标当天补昨天）仍然计入进度。没有目标量历史返回 null。
 */
export function goalDay(goal: DashboardGoal, date: LocalDate, index: CheckinIndex): GoalDay | null {
  const target = targetOnDay(goal.history, date)
  if (target === null) return null
  const first = firstEffectiveDate(goal)
  const existed = first !== null && compareLocalDate(date, first) >= 0
  const ofDay = index.get(goal.id)?.get(date) ?? []
  return {
    goalId: goal.id,
    module: goal.module,
    planned: existed && isPlannedOn(target, date),
    progress: goalDayProgress(target, goal.module, ofDay),
    target: { kind: target.kind, value: target.value },
    hasCheckins: ofDay.length > 0,
  }
}

export interface TodaySection {
  /** 今天计划内的目标，按 sortOrder */
  goals: TodayGoal[]
  completion: { done: number; planned: number }
}

/** 今日进度与今日完成度（PRD 2.8 第 1、2 项） */
export function buildToday(
  goals: readonly DashboardGoal[],
  index: CheckinIndex,
  today: LocalDate,
): TodaySection {
  const days: { goal: DashboardGoal; day: GoalDay }[] = []
  for (const goal of goals) {
    const day = goalDay(goal, today, index)
    if (day) days.push({ goal, day })
  }
  const planned = days
    .filter((d) => d.day.planned)
    .sort((a, b) => a.goal.sortOrder - b.goal.sortOrder || cmpId(a.goal.id, b.goal.id))
    .map(({ goal, day }): TodayGoal => ({
      goalId: goal.id,
      module: goal.module,
      title: goal.title,
      target: day.target,
      planned: true,
      progress: day.progress,
      sortOrder: goal.sortOrder,
    }))
  return { goals: planned, completion: dayCompletion(days.map((d) => d.day)) }
}

function cmpId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * 本周热力图（PRD 7.2）：周一到周日 × 五个板块，格值 = stats.heatmapCell。
 * 今天之后的格子为 0。days 必须是 weekDates(today) 的结果。
 */
export function buildHeatmap(
  goals: readonly DashboardGoal[],
  index: CheckinIndex,
  days: readonly LocalDate[],
  today: LocalDate,
): WeekHeatmap {
  const rows = MODULES.map((module) => {
    const ofModule = goals.filter((g) => g.module === module)
    const cells = days.map((date) => {
      if (compareLocalDate(date, today) > 0) return 0
      const states = ofModule
        .map((g) => goalDay(g, date, index))
        .filter((d): d is GoalDay => d !== null && (d.planned || d.hasCheckins))
      return heatmapCell(
        states,
        states.map((s) => s.progress),
      )
    })
    return { module, cells }
  })
  return { days: [...days], rows }
}

/** 'HH:mm' → 从打卡日开始（dayStartHour 点）算起的分钟数，0..1439 */
function minutesIntoDay(time: string, dayStartHour: number): number {
  const { hours, minutes } = parseLocalTime(time)
  return (hours * 60 + minutes - dayStartHour * 60 + 1440) % 1440
}

/**
 * 是否过了提醒时间（PRD 7.1）。按打卡日比较：4 点换日时，凌晨 1 点仍属于前一天，
 * 已经过了前一天 21:00 的提醒。
 */
export function reminderDue(nowLocalTime: string, remindAt: string, dayStartHour: number): boolean {
  return minutesIntoDay(nowLocalTime, dayStartHour) >= minutesIntoDay(remindAt, dayStartHour)
}

/** 打卡提醒：设了提醒、已过时间、今天还有计划目标没完成时才有 */
export function buildReminder(
  remindAt: string | null,
  nowLocalTime: string,
  dayStartHour: number,
  completion: { done: number; planned: number },
): Reminder | null {
  if (remindAt === null) return null
  const remaining = completion.planned - completion.done
  if (remaining < 1) return null
  if (!reminderDue(nowLocalTime, remindAt, dayStartHour)) return null
  return { remaining }
}

/**
 * 体重卡（PRD 2.5）：entries 为近 30 天（升序），latest 为今天或最近一次，
 * reference 为 latest 那天 7 天前（含之前最近一条）的记录。
 */
export function buildWeightTrend(
  entries: readonly WeightEntry[],
  latest: WeightEntry | null,
  reference: WeightEntry | null,
): WeightTrend {
  const sorted = [...entries].sort((a, b) => compareLocalDate(a.localDate, b.localDate))
  return {
    entries: sorted,
    latest,
    deltaGrams7d:
      latest !== null && reference !== null ? latest.weightGrams - reference.weightGrams : null,
  }
}

/** 体重对比的参考日：latest 那天往前 7 天 */
export function weightReferenceDate(latest: LocalDate): LocalDate {
  return addDays(latest, -7)
}
