import { bigint, boolean, index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { LedgerBucket, LedgerKind, RedeemCodeStatus } from '../../../features/quota/schemas'
import { aiRuns } from './ai'
import { user } from './auth'
import { id, timestamps, timestamptz } from './columns'

/** 每人一行的额度账户（ADR-0002 第 5.2 节）。periodKey 不同就先重置再操作（database.md 第 6 节） */
export const quotaAccounts = pgTable(
  'quota_accounts',
  {
    ...id,
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** 北京时间 ISO 周键，如 2026-W44 */
    periodKey: text().notNull(),
    weeklyLimitMicros: bigint({ mode: 'number' }).notNull(),
    weeklyUsedMicros: bigint({ mode: 'number' }).notNull().default(0),
    bonusMicros: bigint({ mode: 'number' }).notNull().default(0),
    reservedMicros: bigint({ mode: 'number' }).notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex('quota_accounts_user_id_key').on(t.userId)],
)

/** 额度流水：只增不改，余额可由流水重算 */
export const quotaLedger = pgTable(
  'quota_ledger',
  {
    ...id,
    // 可空：注销后去关联，账本保留
    userId: text().references(() => user.id, { onDelete: 'set null' }),
    kind: text().$type<LedgerKind>().notNull(),
    /** 有符号：增加为正、扣减为负 */
    amountMicros: bigint({ mode: 'number' }).notNull(),
    bucket: text().$type<LedgerBucket>().notNull(),
    // 可空：只有 reserve / settle / release 关联 AI 调用
    aiRunId: uuid().references(() => aiRuns.id, { onDelete: 'set null' }),
    // 可空：reset、grant 等内部操作没有幂等键
    idempotencyKey: text(),
    // 可空：管理员调整、兑换等写原因
    note: text(),
    ...timestamps,
  },
  (t) => [index('quota_ledger_user_id_created_at_idx').on(t.userId, t.createdAt)],
)

/** 兑换码（PRD 2.7、7.3）：库里只存 SHA-256 */
export const redeemCodes = pgTable(
  'redeem_codes',
  {
    ...id,
    codeHash: text().notNull(),
    /** 明文前段，如 DDON-AB12，后台列表显示用 */
    prefix: text().notNull(),
    valueMicros: bigint({ mode: 'number' }).notNull(),
    status: text().$type<RedeemCodeStatus>().notNull().default('unused'),
    // 可空：注销后去关联，账本保留
    createdBy: text().references(() => user.id, { onDelete: 'set null' }),
    // 可空：未使用时为空；注销后去关联，账本保留
    redeemedBy: text().references(() => user.id, { onDelete: 'set null' }),
    // 可空：未使用时为空
    redeemedAt: timestamptz(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('redeem_codes_code_hash_key').on(t.codeHash),
    index('redeem_codes_status_idx').on(t.status),
  ],
)

/** 兑换尝试（PRD 7.3）：只增，后台据此标记"兑换失败过多" */
export const redeemAttempts = pgTable(
  'redeem_attempts',
  {
    ...id,
    // 可空：注销后去关联，账本保留
    userId: text().references(() => user.id, { onDelete: 'set null' }),
    ip: text().notNull(),
    ok: boolean().notNull(),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [
    index('redeem_attempts_user_id_created_at_idx').on(t.userId, t.createdAt),
    index('redeem_attempts_ip_created_at_idx').on(t.ip, t.createdAt),
  ],
)
