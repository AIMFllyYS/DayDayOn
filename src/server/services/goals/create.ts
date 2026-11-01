import 'server-only'
import { eq, sql } from 'drizzle-orm'
import type { CreateGoal, Goal } from '@/features/goal/schemas'
import type { LocalDate } from '@/features/shared/schemas'
import { ApiError } from '@/server/api/errors'
import type { Tx } from '@/server/db/client'
import { goalFieldVersions, goals, goalTargets } from '@/server/db/schema'
import { assertCanActivate, lockUserGoals, mapGoalWriteError, toGoalDto } from './repo'
import { isTargetAllowed, normalizeWeekdays } from './rules'

export interface CreateGoalOptions {
  /** 今天的打卡日：写 goal_targets.effectiveFrom */
  today: LocalDate
}

/**
 * 建一个目标：写 goals、goal_targets（effectiveFrom = today），自定义目标再写 goal_field_versions v1。
 * 进行中目标超过 20 个、或已有进行中睡眠目标时抛 ApiError('GOAL_LIMIT_REACHED')（捕获部分唯一索引冲突）。
 * 签名 F1，实现 D2（PRD 2.3、7.2）；D1 引导在同一事务里调用。
 * input 应已经过 CreateGoalSchema 校验；这里再兜一次板块相关的规则，防止调用方绕过 schema。
 */
export async function createGoal(
  tx: Tx,
  userId: string,
  input: CreateGoal,
  opts: CreateGoalOptions,
): Promise<Goal> {
  const custom = input.module === 'custom'
  if (custom !== (input.fields !== undefined)) {
    throw new ApiError('VALIDATION_FAILED', '只有自定义目标需要字段定义', {
      fields: { fields: ['只有自定义目标需要字段定义'] },
    })
  }
  if (!isTargetAllowed(input.module, input.target)) {
    throw new ApiError('VALIDATION_FAILED', '睡眠目标按时长计', {
      fields: { target: ['睡眠目标按时长计'] },
    })
  }

  await lockUserGoals(tx, userId)
  await assertCanActivate(tx, userId, input.module)

  const weekdays = normalizeWeekdays(input.weekdays)
  // 新目标排在最后：当前最大 sortOrder + 1
  const [{ nextSort } = { nextSort: 0 }] = await tx
    .select({ nextSort: sql<number>`coalesce(max(${goals.sortOrder}) + 1, 0)`.mapWith(Number) })
    .from(goals)
    .where(eq(goals.userId, userId))

  let row
  try {
    ;[row] = await tx
      .insert(goals)
      .values({
        userId,
        module: input.module,
        title: input.title,
        description: input.description ? input.description : null,
        targetKind: input.target.kind,
        targetValue: input.target.value,
        weekdays,
        plannedTime: input.plannedTime ?? null,
        status: 'active',
        sortOrder: nextSort,
        fieldVersion: custom ? 1 : null,
      })
      .returning()
  } catch (error) {
    mapGoalWriteError(error)
  }
  if (!row) throw new Error('插入目标没有返回行')

  await tx.insert(goalTargets).values({
    goalId: row.id,
    effectiveFrom: opts.today,
    targetKind: input.target.kind,
    targetValue: input.target.value,
    weekdays,
  })
  if (custom && input.fields) {
    await tx.insert(goalFieldVersions).values({ goalId: row.id, version: 1, fields: input.fields })
  }

  return toGoalDto({ ...row, fields: input.fields ?? null })
}
