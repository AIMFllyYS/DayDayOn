import { bigint, index, integer, pgTable, text } from 'drizzle-orm/pg-core'
import type { AiPurpose, AiRunStatus } from '../../../features/quota/schemas'
import { user } from './auth'
import { id, timestamps } from './columns'

/**
 * AI 调用记录（ai-and-quota.md 第 3 节第 6 步）：只增不删。
 * 不记录 prompt 正文、用户输入、模型输出和图片。
 */
export const aiRuns = pgTable(
  'ai_runs',
  {
    ...id,
    // 可空：注销后去关联，账本保留
    userId: text().references(() => user.id, { onDelete: 'set null' }),
    ip: text().notNull(),
    purpose: text().$type<AiPurpose>().notNull(),
    promptVersion: integer().notNull(),
    status: text().$type<AiRunStatus>().notNull(),
    inputMissTokens: integer().notNull().default(0),
    inputHitTokens: integer().notNull().default(0),
    outputTokens: integer().notNull().default(0),
    costMicros: bigint({ mode: 'number' }).notNull().default(0),
    reservedMicros: bigint({ mode: 'number' }).notNull().default(0),
    /** 内部耗时，不进接口（PRD 7.3） */
    latencyMs: integer().notNull().default(0),
    /** 北京时间日期键 YYYY-MM-DD（全站日上限） */
    dayKey: text().notNull(),
    // 可空：没有幂等键的内部调用
    idempotencyKey: text(),
    ...timestamps,
  },
  (t) => [
    index('ai_runs_user_id_created_at_idx').on(t.userId, t.createdAt),
    index('ai_runs_day_key_idx').on(t.dayKey),
  ],
)

/** 全站每日花费（北京时间），自然主键（PRD 7.4）。没有 alertedAt：告警去重用 alerts_sent */
export const aiDailySpend = pgTable('ai_daily_spend', {
  dayKey: text().primaryKey(),
  spentMicros: bigint({ mode: 'number' }).notNull().default(0),
  ...timestamps,
})
