import { sql } from 'drizzle-orm'
import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
// 只引入类型：drizzle-kit 加载 schema 时类型导入会被擦除，不依赖 `@/` 别名
import type { FieldDef } from '../../../features/goal/schemas'
import type { Module } from '../../../features/shared/schemas'
import { user } from './auth'
import { id, timestamps } from './columns'

export type TargetKind = 'duration' | 'count'
export type GoalStatus = 'active' | 'archived'

/** 目标（PRD 2.3）。targetKind / targetValue / weekdays 是 goal_targets 当前生效行的冗余副本（PRD 7.2） */
export const goals = pgTable(
  'goals',
  {
    ...id,
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    module: text().$type<Module>().notNull(),
    title: text().notNull(),
    // 可空：说明可以不填
    description: text(),
    targetKind: text().$type<TargetKind>().notNull(),
    /** duration 为秒，count 为次数 */
    targetValue: integer().notNull(),
    /** ISO 星期 1–7 */
    weekdays: smallint()
      .array()
      .notNull()
      .default(sql`'{1,2,3,4,5,6,7}'::smallint[]`),
    // 可空：HH:mm，只用于显示
    plannedTime: text(),
    status: text().$type<GoalStatus>().notNull().default('active'),
    sortOrder: integer().notNull().default(0),
    // 可空：只有自定义目标有字段定义版本
    fieldVersion: integer(),
    ...timestamps,
  },
  (t) => [
    index('goals_user_id_status_idx').on(t.userId, t.status),
    // 睡眠目标最多 1 个进行中（PRD 7.4），冲突映射为 GOAL_LIMIT_REACHED
    uniqueIndex('goals_user_id_active_sleep_key')
      .on(t.userId)
      .where(sql`${t.module} = 'sleep' AND ${t.status} = 'active'`),
  ],
)

/** 目标量历史（PRD 7.2）：某天的进度用当天生效的那一行 */
export const goalTargets = pgTable(
  'goal_targets',
  {
    ...id,
    goalId: uuid()
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    effectiveFrom: date({ mode: 'string' }).notNull(),
    targetKind: text().$type<TargetKind>().notNull(),
    targetValue: integer().notNull(),
    weekdays: smallint().array().notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('goal_targets_goal_id_effective_from_key').on(t.goalId, t.effectiveFrom)],
)

/** 自定义目标的字段定义版本（PRD 2.3） */
export const goalFieldVersions = pgTable(
  'goal_field_versions',
  {
    ...id,
    goalId: uuid()
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    version: integer().notNull(),
    fields: jsonb().$type<FieldDef[]>().notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('goal_field_versions_goal_id_version_key').on(t.goalId, t.version)],
)
