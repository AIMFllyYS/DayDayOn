import 'server-only'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import { Pool } from 'pg'
import { env } from '@/server/env'
import * as schema from './schema'

/*
 * 全项目唯一的数据库连接（database.md 第 1 节）。
 * Pool 是懒连接：new Pool() 不会立即建连，所以 `next build` 加载本模块时不需要数据库。
 * 开发环境热更新会重复执行模块，把 pool 挂在 globalThis 上复用，避免连接数涨满。
 */

type Schema = typeof schema

const globalForDb = globalThis as typeof globalThis & { __daydayonPool?: Pool }

function createPool(): Pool {
  // 连接池上限 10：数据库容器限制 512 MB 内存，不要调大
  return new Pool({ connectionString: env.DATABASE_URL, max: 10 })
}

let pool: Pool | undefined = globalForDb.__daydayonPool
let instance: NodePgDatabase<Schema> | undefined

function getDb(): NodePgDatabase<Schema> {
  if (instance) return instance
  pool ??= createPool()
  if (process.env.NODE_ENV !== 'production') globalForDb.__daydayonPool = pool
  instance = drizzle({ client: pool, schema, casing: 'snake_case' })
  return instance
}

/**
 * 数据库实例。首次访问属性时才创建连接池（读取 env），模块加载不读环境变量。
 * Better Auth 的 drizzle 适配器、service 都用它。
 */
export const db: NodePgDatabase<Schema> = new Proxy({} as NodePgDatabase<Schema>, {
  get(_target, key) {
    const real = getDb()
    const value: unknown = Reflect.get(real, key, real)
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(real) : value
  },
})

/** 事务句柄。service 的写函数一律接收 `tx: Tx`，事务内只用 tx（database.md 第 6 节） */
export type Tx = PgTransaction<NodePgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>

/** 只读查询既可以传 db 也可以传 tx */
export type DbOrTx = NodePgDatabase<Schema> | Tx
