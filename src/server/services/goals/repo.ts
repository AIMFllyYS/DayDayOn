import 'server-only'
import { and, count, eq, ne, sql } from 'drizzle-orm'
import type { FieldDef, Goal, GoalStatus, TargetKind } from '@/features/goal/schemas'
import type { LocalDate, Module } from '@/features/shared/schemas'
import { DEFAULT_DAY_START_HOUR, localDateOf } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import type { DbOrTx, Tx } from '@/server/db/client'
import { goalFieldVersions, goals, profiles } from '@/server/db/schema'
import { ACTIVE_SLEEP_CONSTRAINT, checkActivation, isUniqueViolation } from './rules'

/*
 * goals 服务内部的查询与映射。只给 src/server/services/goals/ 用；
 * 其他领域需要目标数据时调用 index.ts / create.ts 导出的函数。
 */

const DEFAULT_TIME_ZONE = 'Asia/Shanghai'

/** 今天的打卡日：按资料里的时区与日切换时间（PRD 3）；没有资料行时用默认值 */
export async function userToday(db: DbOrTx, userId: string, now: Date): Promise<LocalDate> {
  const [row] = await db
    .select({ timeZone: profiles.timeZone, dayStartHour: profiles.dayStartHour })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1)
  return localDateOf(
    now,
    row?.timeZone ?? DEFAULT_TIME_ZONE,
    row?.dayStartHour ?? DEFAULT_DAY_START_HOUR,
  )
}

/**
 * 锁住用户的资料行：同一用户的建目标 / 恢复目标串行执行，
 * "最多 20 个进行中"的计数不会被并发请求绕过。没有资料行时不锁（只剩唯一索引兜底睡眠）。
 */
export async function lockUserGoals(tx: Tx, userId: string): Promise<void> {
  await tx
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .for('update')
}

/** 进行中目标数与是否已有进行中的睡眠目标；exceptGoalId 不计入 */
export async function activationState(
  db: DbOrTx,
  userId: string,
  exceptGoalId?: string,
): Promise<{ activeCount: number; hasActiveSleep: boolean }> {
  const [row] = await db
    .select({
      activeCount: count(),
      sleep: sql<number>`count(*) filter (where ${goals.module} = 'sleep')`.mapWith(Number),
    })
    .from(goals)
    .where(
      and(
        eq(goals.userId, userId),
        eq(goals.status, 'active'),
        exceptGoalId ? ne(goals.id, exceptGoalId) : undefined,
      ),
    )
  return { activeCount: row?.activeCount ?? 0, hasActiveSleep: (row?.sleep ?? 0) > 0 }
}

/** 超限时抛 GOAL_LIMIT_REACHED */
export async function assertCanActivate(
  db: DbOrTx,
  userId: string,
  module: Module,
  exceptGoalId?: string,
): Promise<void> {
  const violation = checkActivation(module, await activationState(db, userId, exceptGoalId))
  if (violation === 'active-limit') {
    throw new ApiError('GOAL_LIMIT_REACHED', '进行中的目标已达上限')
  }
  if (violation === 'active-sleep') {
    throw new ApiError('GOAL_LIMIT_REACHED', '已经有一个进行中的睡眠目标')
  }
}

/** 并发下仍撞上睡眠部分唯一索引时，映射成 GOAL_LIMIT_REACHED */
export function mapGoalWriteError(error: unknown): never {
  if (isUniqueViolation(error, ACTIVE_SLEEP_CONSTRAINT)) {
    throw new ApiError('GOAL_LIMIT_REACHED', '已经有一个进行中的睡眠目标')
  }
  throw error
}

/** goals 行 + 当前版本字段定义 → 接口 DTO 需要的列 */
export const goalColumns = {
  id: goals.id,
  module: goals.module,
  title: goals.title,
  description: goals.description,
  targetKind: goals.targetKind,
  targetValue: goals.targetValue,
  weekdays: goals.weekdays,
  plannedTime: goals.plannedTime,
  status: goals.status,
  sortOrder: goals.sortOrder,
  fieldVersion: goals.fieldVersion,
  fields: goalFieldVersions.fields,
  createdAt: goals.createdAt,
  updatedAt: goals.updatedAt,
}

export interface GoalRow {
  id: string
  module: Module
  title: string
  description: string | null
  targetKind: TargetKind
  targetValue: number
  weekdays: number[]
  plannedTime: string | null
  status: GoalStatus
  sortOrder: number
  fieldVersion: number | null
  fields: FieldDef[] | null
  createdAt: Date
  updatedAt: Date
}

/** 当前版本字段定义的连接条件 */
export const currentFieldsJoin = and(
  eq(goalFieldVersions.goalId, goals.id),
  eq(goalFieldVersions.version, goals.fieldVersion),
)

export function toGoalDto(row: GoalRow): Goal {
  const custom = row.module === 'custom'
  return {
    id: row.id,
    module: row.module,
    title: row.title,
    description: row.description,
    target: { kind: row.targetKind, value: row.targetValue },
    weekdays: row.weekdays,
    plannedTime: row.plannedTime,
    status: row.status,
    sortOrder: row.sortOrder,
    fieldVersion: custom ? row.fieldVersion : null,
    fields: custom ? (row.fields ?? null) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** 按 id 读一个目标（限定用户）；不存在或不属于该用户返回 null */
export async function findGoal(
  db: DbOrTx,
  userId: string,
  goalId: string,
  opts: { lock?: boolean } = {},
): Promise<GoalRow | null> {
  const base = db
    .select(goalColumns)
    .from(goals)
    .leftJoin(goalFieldVersions, currentFieldsJoin)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .limit(1)
  // FOR UPDATE 不能用在外连接的可空一侧，只锁 goals
  const rows = opts.lock ? await base.for('update', { of: goals }) : await base
  return rows[0] ?? null
}
