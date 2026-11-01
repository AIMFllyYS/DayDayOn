import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import type { Checkin } from '@/features/checkin/schemas'
import type { FieldDef, TargetOnDay } from '@/features/goal/schemas'
import type { LocalDate } from '@/features/shared/schemas'
import { ApiError } from '@/server/api/errors'
import type { DbOrTx } from '@/server/db/client'
import { checkins, goalFieldVersions, goals, goalTargets } from '@/server/db/schema'
import { targetOnDay, type TargetVersion } from '@/server/services/stats'

/*
 * 打卡 service 共用的读取：目标（带归属校验）、目标量历史、打卡行 → DTO。
 */

export type GoalRow = Pick<
  typeof goals.$inferSelect,
  | 'id'
  | 'module'
  | 'title'
  | 'status'
  | 'sortOrder'
  | 'targetKind'
  | 'targetValue'
  | 'weekdays'
  | 'fieldVersion'
>

const goalColumns = {
  id: goals.id,
  module: goals.module,
  title: goals.title,
  status: goals.status,
  sortOrder: goals.sortOrder,
  targetKind: goals.targetKind,
  targetValue: goals.targetValue,
  weekdays: goals.weekdays,
  fieldVersion: goals.fieldVersion,
}

/** 当前用户的目标；不存在或不属于当前用户都是 404 GOAL_NOT_FOUND */
export async function loadGoal(db: DbOrTx, userId: string, goalId: string): Promise<GoalRow> {
  const [row] = await db
    .select(goalColumns)
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .limit(1)
  if (!row) throw new ApiError('GOAL_NOT_FOUND', '目标不存在')
  return row
}

/** 进行中的目标，按 sortOrder（上限 100，PRD 7.5） */
export async function loadActiveGoals(db: DbOrTx, userId: string): Promise<GoalRow[]> {
  return db
    .select(goalColumns)
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.status, 'active')))
    .orderBy(goals.sortOrder, goals.createdAt)
    .limit(100)
}

/** 多个目标的目标量历史：goalId → 行 */
export async function loadTargetHistory(
  db: DbOrTx,
  goalIds: readonly string[],
): Promise<Map<string, TargetVersion[]>> {
  const out = new Map<string, TargetVersion[]>()
  if (goalIds.length === 0) return out
  const rows = await db
    .select({
      goalId: goalTargets.goalId,
      effectiveFrom: goalTargets.effectiveFrom,
      kind: goalTargets.targetKind,
      value: goalTargets.targetValue,
      weekdays: goalTargets.weekdays,
    })
    .from(goalTargets)
    .where(inArray(goalTargets.goalId, [...goalIds]))
    .limit(goalIds.length * 50)
  for (const { goalId, ...row } of rows) out.set(goalId, [...(out.get(goalId) ?? []), row])
  return out
}

/** 某天生效的目标量；没有历史行（老数据）时退回 goals 上的当前值 */
export function targetFor(
  goal: GoalRow,
  history: readonly TargetVersion[] | undefined,
  localDate: LocalDate,
): TargetOnDay {
  return (
    targetOnDay(history ?? [], localDate) ?? {
      kind: goal.targetKind,
      value: goal.targetValue,
      weekdays: goal.weekdays,
    }
  )
}

/** 自定义目标某个版本的字段定义；不存在返回 null */
export async function loadFields(
  db: DbOrTx,
  goalId: string,
  version: number,
): Promise<FieldDef[] | null> {
  const [row] = await db
    .select({ fields: goalFieldVersions.fields })
    .from(goalFieldVersions)
    .where(and(eq(goalFieldVersions.goalId, goalId), eq(goalFieldVersions.version, version)))
    .limit(1)
  return row?.fields ?? null
}

export const checkinColumns = {
  id: checkins.id,
  goalId: checkins.goalId,
  module: checkins.module,
  localDate: checkins.localDate,
  occurredAt: checkins.occurredAt,
  source: checkins.source,
  isMakeup: checkins.isMakeup,
  durationSeconds: checkins.durationSeconds,
  count: checkins.count,
  intakeKcal: checkins.intakeKcal,
  burnKcal: checkins.burnKcal,
  note: checkins.note,
  parsedText: checkins.parsedText,
  payload: checkins.payload,
  fieldVersion: checkins.fieldVersion,
  aiRunId: checkins.aiRunId,
  createdAt: checkins.createdAt,
}

export type CheckinRow = Pick<typeof checkins.$inferSelect, keyof typeof checkinColumns>

export function toCheckinDto(row: CheckinRow): Checkin {
  return {
    ...row,
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}
