import { sql } from 'drizzle-orm'
import { timestamp, uuid } from 'drizzle-orm/pg-core'

/*
 * 共用列（database.md 第 4 节）。业务表展开 `...id, ...timestamps`；
 * 自然主键的表（app_settings、ai_daily_spend、rate_limit_counters、alerts_sent）只展开 timestamps（PRD 7.4）。
 * 列名由 casing: 'snake_case' 自动映射，不手写字符串。
 */

/** 业务表主键：PostgreSQL 18 内置 uuidv7()，按时间递增 */
export const id = {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
}

export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

/** timestamptz 的简写 */
export const timestamptz = () => timestamp({ withTimezone: true })
