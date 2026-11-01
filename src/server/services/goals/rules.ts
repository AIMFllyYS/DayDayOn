import type { FieldDef, Target, TargetOnDay } from '@/features/goal/schemas'
import { GOAL_ACTIVE_LIMIT } from '@/features/goal/schemas'
import type { Module } from '@/features/shared/schemas'

/*
 * 目标的纯业务规则（PRD 2.3、7.2、7.4）：不碰数据库，便于单测。
 * service 读出当前状态后调用这里判断"要不要写 / 写什么 / 是否超限"。
 */

/** 部分唯一索引：同一用户最多 1 个进行中的睡眠目标 */
export const ACTIVE_SLEEP_CONSTRAINT = 'goals_user_id_active_sleep_key'

/** 星期去重排序，存库和比较都用这个形状 */
export function normalizeWeekdays(weekdays: readonly number[]): number[] {
  return [...new Set(weekdays)].sort((a, b) => a - b)
}

export function sameWeekdays(a: readonly number[], b: readonly number[]): boolean {
  const x = normalizeWeekdays(a)
  const y = normalizeWeekdays(b)
  return x.length === y.length && x.every((d, i) => d === y[i])
}

/** 目标量或计划星期变了才写 goal_targets（改标题、说明不产生历史） */
export function targetChanged(current: TargetOnDay, next: TargetOnDay): boolean {
  return (
    current.kind !== next.kind ||
    current.value !== next.value ||
    !sameWeekdays(current.weekdays, next.weekdays)
  )
}

/** 字段定义是否真的变了：按 JSON 比较（字段顺序也算变化，影响表单展示） */
export function fieldsChanged(current: readonly FieldDef[] | null, next: readonly FieldDef[]) {
  if (current === null) return true
  return JSON.stringify(current) !== JSON.stringify(next)
}

/** 新的字段版本号：当前版本 + 1；还没有版本时从 1 开始 */
export function nextFieldVersion(current: number | null): number {
  return (current ?? 0) + 1
}

export type GoalLimitViolation = 'active-limit' | 'active-sleep'

/**
 * 让一个目标变成进行中（新建或恢复）前的检查。
 * activeCount / hasActiveSleep 都不含这个目标本身。
 */
export function checkActivation(
  module: Module,
  state: { activeCount: number; hasActiveSleep: boolean },
): GoalLimitViolation | null {
  if (state.activeCount >= GOAL_ACTIVE_LIMIT) return 'active-limit'
  if (module === 'sleep' && state.hasActiveSleep) return 'active-sleep'
  return null
}

/** 睡眠目标按时长计；其他板块不限 */
export function isTargetAllowed(module: Module, target: Target): boolean {
  return module !== 'sleep' || target.kind === 'duration'
}

/**
 * 是否是某个唯一约束的冲突。drizzle 把 pg 的错误包在 DrizzleQueryError.cause 里，
 * 两层都看；constraint 不传时任何唯一冲突都算。
 */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  for (let e: unknown = error, depth = 0; e && depth < 3; depth++) {
    if (typeof e !== 'object') return false
    const {
      code,
      constraint: name,
      cause,
    } = e as {
      code?: unknown
      constraint?: unknown
      cause?: unknown
    }
    if (code === '23505') return constraint === undefined || name === constraint
    e = cause
  }
  return false
}
