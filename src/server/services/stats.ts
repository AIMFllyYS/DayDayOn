import 'server-only'
import type { GoalProgress } from '@/features/checkin/schemas'
import type { TargetOnDay } from '@/features/goal/schemas'
import type { LocalDate, Module } from '@/features/shared/schemas'

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
}

export interface GoalWithProgress {
  goalId: string
  module: Module
  /** 当天是否在计划星期里（isPlannedOn） */
  planned: boolean
  progress: GoalProgress
}

/** 某天是否在计划星期里（ISO 1–7）。实现：P2 */
export function isPlannedOn(target: TargetOnDay, localDate: LocalDate): boolean {
  void target
  void localDate
  throw new Error('not implemented: P2')
}

/**
 * 某个目标某天的进度（PRD 3「频次」、7.2）：
 * duration 累加 durationSeconds；睡眠取当天那条的时长；
 * 饮食 count = 当天不同餐次数；其余 count 类按记录数。
 * checkinsOfDay 只含该目标该打卡日的记录。实现：P2
 */
export function goalDayProgress(
  target: TargetOnDay,
  module: Module,
  checkinsOfDay: readonly StatCheckin[],
): GoalProgress {
  void target
  void module
  void checkinsOfDay
  throw new Error('not implemented: P2')
}

/** 当天完成度：只数计划内的目标（不在计划日的打卡计入进度，但不计入 planned）。实现：P2 */
export function dayCompletion(goalsWithProgress: readonly GoalWithProgress[]): {
  done: number
  planned: number
} {
  void goalsWithProgress
  throw new Error('not implemented: P2')
}

/**
 * 连续天数（PRD 3）：从 today（今天还没打卡就从昨天）往回数，连续有任意打卡（含补卡）的打卡日数。
 * checkinDates 可重复、无序。实现：P2
 */
export function computeStreak(checkinDates: readonly LocalDate[], today: LocalDate): number {
  void checkinDates
  void today
  throw new Error('not implemented: P2')
}

/** 排行计分（PRD 2.9、3）：排除补卡、同日去重后的打卡日数。rows 已按范围过滤。实现：P2 */
export function countRankDays(
  rows: readonly Pick<StatCheckin, 'localDate' | 'isMakeup'>[],
): number {
  void rows
  throw new Error('not implemented: P2')
}

/**
 * 热力图一格（PRD 7.2）：该板块当天已完成目标数 / 当天计划目标数；
 * 没有计划但有打卡记 1；都没有为 0。返回 0..1。实现：P2
 */
export function heatmapCell(
  goalsOfModule: readonly Pick<GoalWithProgress, 'planned'>[],
  progresses: readonly GoalProgress[],
): number {
  void goalsOfModule
  void progresses
  throw new Error('not implemented: P2')
}
