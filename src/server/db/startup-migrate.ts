import 'server-only'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db } from './client'

/*
 * 生产启动自动迁移（database.md 第 5 节）。
 * pack-artifact.sh 会把 src/server/db/migrations 打进 standalone 制品；
 * Next.js 启动时由 src/instrumentation.ts 调用，幂等执行未应用的 SQL 迁移。
 */

export async function runStartupMigrations(): Promise<void> {
  if (!process.env.DATABASE_URL) return
  const migrationsFolder = join(process.cwd(), 'src/server/db/migrations')
  if (!existsSync(migrationsFolder)) return
  await migrate(db, { migrationsFolder })
}
