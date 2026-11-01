import 'server-only'
import type { CreateGoal, Goal } from '@/features/goal/schemas'
import type { LocalDate } from '@/features/shared/schemas'
import type { Tx } from '@/server/db/client'

export interface CreateGoalOptions {
  /** 今天的打卡日：写 goal_targets.effectiveFrom */
  today: LocalDate
}

/**
 * 建一个目标：写 goals、goal_targets（effectiveFrom = today），自定义目标再写 goal_field_versions v1。
 * 进行中目标超过 20 个、或已有进行中睡眠目标时抛 ApiError('GOAL_LIMIT_REACHED')（捕获部分唯一索引冲突）。
 * 签名 F1，实现 D2（PRD 2.3、7.2）；D1 引导在同一事务里调用。
 */
export async function createGoal(
  tx: Tx,
  userId: string,
  input: CreateGoal,
  opts: CreateGoalOptions,
): Promise<Goal> {
  void tx
  void userId
  void input
  void opts
  throw new Error('not implemented: D2')
}
