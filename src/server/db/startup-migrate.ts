import 'server-only'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { syncOfficialAnnouncements } from './announcements-catalog'
import { db } from './client'

/*
 * 生产启动自动迁移与官方公告幂等同步（database.md 第 7 节）。
 * pack-artifact.sh 会把 src/server/db/migrations 打进 standalone 制品；
 * Next.js 启动时由 src/instrumentation.ts 调用，幂等执行未应用的 SQL 迁移并同步官方公告清单。
 */

export async function runStartupMigrations(): Promise<void> {
  if (!process.env.DATABASE_URL) return
  const migrationsFolder = join(process.cwd(), 'src/server/db/migrations')
  if (existsSync(migrationsFolder)) {
    await migrate(db, { migrationsFolder })
  }
  await syncOfficialAnnouncements(db)
}
