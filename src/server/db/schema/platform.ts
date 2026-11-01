import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { user } from './auth'
import { id, timestamps, timestamptz } from './columns'

/** 全站配置（PRD 7.3）：key 为自然主键，value 按 src/server/settings-schema.ts 校验 */
export const appSettings = pgTable('app_settings', {
  key: text().primaryKey(),
  value: jsonb().$type<unknown>().notNull(),
  ...timestamps,
})

/** /api/v1 与 Better Auth hook 共用的限流计数（api-conventions.md 第 8 节），自然主键 */
export const rateLimitCounters = pgTable(
  'rate_limit_counters',
  {
    /** <规则名>:<userId 或 ip>:<窗口起点> */
    key: text().primaryKey(),
    count: integer().notNull().default(0),
    expiresAt: timestamptz().notNull(),
    ...timestamps,
  },
  (t) => [index('rate_limit_counters_expires_at_idx').on(t.expiresAt)],
)

export type IdempotencyStatus = 'processing' | 'completed'

/** 幂等键（api-conventions.md 第 9 节），保留 24 小时 */
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    ...id,
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    key: text().notNull(),
    /** 方法 + 路径 + 请求体的 SHA-256 */
    requestHash: text().notNull(),
    status: text().$type<IdempotencyStatus>().notNull().default('processing'),
    // 可空：处理中时还没有响应
    responseStatus: smallint(),
    // 可空：处理中；或像批量生成兑换码这类明文不落库的接口（PRD 7.3）
    responseBody: jsonb().$type<unknown>(),
    expiresAt: timestamptz().notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('idempotency_keys_user_id_key_key').on(t.userId, t.key),
    index('idempotency_keys_expires_at_idx').on(t.expiresAt),
  ],
)

/** 管理员操作审计（PRD 2.12）：只增不删 */
export const adminAuditLogs = pgTable(
  'admin_audit_logs',
  {
    ...id,
    // 可空：注销后去关联，账本保留
    adminId: text().references(() => user.id, { onDelete: 'set null' }),
    action: text().notNull(),
    targetType: text().notNull(),
    // 可空：全站操作（暂停 AI、改配置）没有对象 id
    targetId: text(),
    detail: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [index('admin_audit_logs_created_at_idx').on(t.createdAt)],
)

/** 告警去重（PRD 7.3）：每天每种一次，自然主键 */
export const alertsSent = pgTable(
  'alerts_sent',
  {
    kind: text().notNull(),
    dayKey: text().notNull(),
    ...timestamps,
  },
  (t) => [primaryKey({ name: 'alerts_sent_kind_day_key_pk', columns: [t.kind, t.dayKey] })],
)
