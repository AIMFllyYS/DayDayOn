import 'server-only'
import { and, asc, eq } from 'drizzle-orm'
import {
  type CreateGoal,
  type Goal,
  type GoalDetail,
  type GoalList,
  type GoalStatus,
  targetKindError,
  type UpdateGoal,
} from '@/features/goal/schemas'
import { ApiError } from '@/server/api/errors'
import type { DbOrTx, Tx } from '@/server/db/client'
import { goalFieldVersions, goals, goalTargets } from '@/server/db/schema'
import { createGoal } from './create'
import {
  assertCanActivate,
  currentFieldsJoin,
  findGoal,
  goalColumns,
  lockUserGoals,
  mapGoalWriteError,
  toGoalDto,
  userToday,
} from './repo'
import {
  fieldsChanged,
  isTargetAllowed,
  nextFieldVersion,
  normalizeWeekdays,
  targetChanged,
} from './rules'

/*
 * 目标服务（PRD 2.3、7.2、7.5）。普通 TS：不 import next/*、hono；每条查询都带 userId；
 * 返回值就是接口 DTO（GoalSchema / GoalDetailSchema / GoalListSchema）。
 * 写函数接收 tx，由调用方（路由或引导）开事务。
 */

export { createGoal, type CreateGoalOptions } from './create'

/** GET /goals 的上限（PRD 7.5：不分页，上限 100） */
const LIST_LIMIT = 100

export interface WriteOptions {
  /** 当前时刻：算今天的打卡日（目标量历史的 effectiveFrom） */
  now: Date
}

/** POST /goals：按用户时区算出今天，再建目标 */
export async function createGoalForUser(
  tx: Tx,
  userId: string,
  input: CreateGoal,
  opts: WriteOptions,
): Promise<Goal> {
  const today = await userToday(tx, userId, opts.now)
  return createGoal(tx, userId, input, { today })
}

/** GET /goals?status= */
export async function listGoals(
  db: DbOrTx,
  userId: string,
  input: { status: GoalStatus },
): Promise<GoalList> {
  const rows = await db
    .select(goalColumns)
    .from(goals)
    .leftJoin(goalFieldVersions, currentFieldsJoin)
    .where(and(eq(goals.userId, userId), eq(goals.status, input.status)))
    .orderBy(asc(goals.sortOrder), asc(goals.createdAt))
    .limit(LIST_LIMIT)
  return { items: rows.map(toGoalDto) }
}

/** GET /goals/{goalId}：目标 + 全部字段版本 + 目标量历史（都按时间升序） */
export async function getGoal(db: DbOrTx, userId: string, goalId: string): Promise<GoalDetail> {
  const row = await findGoal(db, userId, goalId)
  if (!row) throw new ApiError('GOAL_NOT_FOUND', '目标不存在')

  // 下面两条只按 goalId 查：上一步已确认这个目标属于当前用户
  const [versions, targets] = await Promise.all([
    db
      .select({
        version: goalFieldVersions.version,
        fields: goalFieldVersions.fields,
        createdAt: goalFieldVersions.createdAt,
      })
      .from(goalFieldVersions)
      .where(eq(goalFieldVersions.goalId, goalId))
      .orderBy(asc(goalFieldVersions.version)),
    db
      .select({
        effectiveFrom: goalTargets.effectiveFrom,
        kind: goalTargets.targetKind,
        value: goalTargets.targetValue,
        weekdays: goalTargets.weekdays,
      })
      .from(goalTargets)
      .where(eq(goalTargets.goalId, goalId))
      .orderBy(asc(goalTargets.effectiveFrom)),
  ])

  return {
    ...toGoalDto(row),
    fieldVersions: versions.map((v) => ({
      version: v.version,
      fields: v.fields,
      createdAt: v.createdAt.toISOString(),
    })),
    targetHistory: targets,
  }
}

/**
 * PATCH /goals/{goalId}：
 * - target / weekdays 变了：goal_targets 插入（当天已有则覆盖）effectiveFrom = 今天的一行；
 * - fields 变了（只有自定义目标）：goal_field_versions 新增 version + 1；
 * - status 改回 active（恢复）：先检查 20 个上限与睡眠唯一。
 */
export async function updateGoal(
  tx: Tx,
  userId: string,
  goalId: string,
  input: UpdateGoal,
  opts: WriteOptions,
): Promise<Goal> {
  // 先锁用户，再锁目标：与 createGoal 的加锁顺序一致，避免死锁
  await lockUserGoals(tx, userId)
  const current = await findGoal(tx, userId, goalId, { lock: true })
  if (!current) throw new ApiError('GOAL_NOT_FOUND', '目标不存在')

  const target = input.target ?? { kind: current.targetKind, value: current.targetValue }
  const weekdays = normalizeWeekdays(input.weekdays ?? current.weekdays)
  // 只校验这次提交的目标量：规则收紧前建的老目标仍能归档、改标题
  if (input.target !== undefined && !isTargetAllowed(current.module, target)) {
    throw new ApiError('VALIDATION_FAILED', targetKindError(current.module), {
      fields: { target: [targetKindError(current.module)] },
    })
  }
  if (input.fields !== undefined && current.module !== 'custom') {
    throw new ApiError('VALIDATION_FAILED', '只有自定义目标需要字段定义', {
      fields: { fields: ['只有自定义目标需要字段定义'] },
    })
  }
  if (input.status === 'active' && current.status !== 'active') {
    await assertCanActivate(tx, userId, current.module, goalId)
  }

  const changes: Partial<typeof goals.$inferInsert> = {}
  if (input.title !== undefined) changes.title = input.title
  if (input.description !== undefined) changes.description = input.description || null
  if (input.plannedTime !== undefined) changes.plannedTime = input.plannedTime
  if (input.status !== undefined) changes.status = input.status
  if (input.sortOrder !== undefined) changes.sortOrder = input.sortOrder

  const currentTarget = {
    kind: current.targetKind,
    value: current.targetValue,
    weekdays: current.weekdays,
  }
  if (targetChanged(currentTarget, { ...target, weekdays })) {
    const today = await userToday(tx, userId, opts.now)
    const row = { targetKind: target.kind, targetValue: target.value, weekdays }
    await tx
      .insert(goalTargets)
      .values({ goalId, effectiveFrom: today, ...row })
      .onConflictDoUpdate({
        target: [goalTargets.goalId, goalTargets.effectiveFrom],
        set: { ...row, updatedAt: opts.now },
      })
    Object.assign(changes, row)
  }

  let fields = current.fields
  if (input.fields !== undefined && fieldsChanged(current.fields, input.fields)) {
    const version = nextFieldVersion(current.fieldVersion)
    await tx.insert(goalFieldVersions).values({ goalId, version, fields: input.fields })
    changes.fieldVersion = version
    fields = input.fields
  }

  let updated
  try {
    ;[updated] = await tx
      .update(goals)
      .set({ ...changes, updatedAt: opts.now })
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .returning()
  } catch (error) {
    mapGoalWriteError(error)
  }
  if (!updated) throw new ApiError('GOAL_NOT_FOUND', '目标不存在')
  return toGoalDto({ ...updated, fields })
}

/** DELETE /goals/{goalId}：打卡记录、目标量历史、字段版本由外键级联删除 */
export async function deleteGoal(tx: Tx, userId: string, goalId: string): Promise<void> {
  const deleted = await tx
    .delete(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .returning({ id: goals.id })
  if (deleted.length === 0) throw new ApiError('GOAL_NOT_FOUND', '目标不存在')
}
