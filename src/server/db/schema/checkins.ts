import { sql } from 'drizzle-orm'
import {
  boolean,
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
import type { CheckinPayload } from '../../../features/checkin/schemas'
import type { Module, RatingScope } from '../../../features/shared/schemas'
import { aiRuns } from './ai'
import { user } from './auth'
import { id, timestamps, timestamptz } from './columns'
import { goals } from './goals'

export type CheckinSource = 'manual' | 'ai'

/** 打卡记录（PRD 2.4、3、7.2）。没有 rating 列：评分只存 daily_ratings（PRD 7.2） */
export const checkins = pgTable(
  'checkins',
  {
    ...id,
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    goalId: uuid()
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    module: text().$type<Module>().notNull(),
    /** 打卡日：服务端用 localDateOf() 算出（PRD 3） */
    localDate: date({ mode: 'string' }).notNull(),
    occurredAt: timestamptz().notNull(),
    source: text().$type<CheckinSource>().notNull().default('manual'),
    isMakeup: boolean().notNull().default(false),
    // 可空：只有运动、睡眠、带时长的学习有
    durationSeconds: integer(),
    count: integer().notNull().default(1),
    // 可空：饮食手动填写时热量可空
    intakeKcal: integer(),
    // 可空：没有体重记录时不估算运动消耗（PRD 2.4）
    burnKcal: integer(),
    // 可空：备注可不填
    note: text(),
    // 可空：只有 AI 识别的打卡有解析文本
    parsedText: text(),
    payload: jsonb().$type<CheckinPayload>().notNull(),
    // 可空：只有自定义目标的打卡有字段版本
    fieldVersion: integer(),
    // 可空：只有 AI 识别的打卡关联 ai_runs；注销后 ai_runs 保留，打卡随用户删除
    aiRunId: uuid().references(() => aiRuns.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    index('checkins_user_id_local_date_idx').on(t.userId, t.localDate),
    index('checkins_goal_id_local_date_idx').on(t.goalId, t.localDate),
    // 睡眠每个打卡日最多一条（PRD 7.4），冲突映射为 CHECKIN_EXISTS
    uniqueIndex('checkins_goal_id_local_date_sleep_key')
      .on(t.goalId, t.localDate)
      .where(sql`${t.module} = 'sleep'`),
    // 一次 AI 识别只能确认一次
    uniqueIndex('checkins_ai_run_id_key')
      .on(t.aiRunId)
      .where(sql`${t.aiRunId} IS NOT NULL`),
  ],
)

/** 体重（PRD 2.5）：每个打卡日一条，再记就覆盖 */
export const bodyMetrics = pgTable(
  'body_metrics',
  {
    ...id,
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    localDate: date({ mode: 'string' }).notNull(),
    weightGrams: integer().notNull(),
    measuredAt: timestamptz().notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('body_metrics_user_id_local_date_key').on(t.userId, t.localDate)],
)

/** 满意度（PRD 2.5）：scope = overall 或板块；同一天再评就覆盖 */
export const dailyRatings = pgTable(
  'daily_ratings',
  {
    ...id,
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    localDate: date({ mode: 'string' }).notNull(),
    scope: text().$type<RatingScope>().notNull(),
    value: smallint().notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('daily_ratings_user_id_local_date_scope_key').on(t.userId, t.localDate, t.scope),
  ],
)
