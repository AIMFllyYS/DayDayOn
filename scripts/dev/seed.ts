// 本地种子数据：pnpm db:seed（database.md 第 9 节）。幂等：只补齐缺失的全站配置，不覆盖已改过的值。
// 用户由 Better Auth 在登录时创建，这里不造用户。
import { existsSync } from 'node:fs'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { appSettings } from '../../src/server/db/schema'
import { DEFAULT_SETTINGS } from '../../src/server/settings-schema'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')

const url = process.env.DATABASE_URL
if (!url) throw new Error('缺少 DATABASE_URL：复制 .env.example 为 .env.local 后填写')

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: url, max: 1 })
  try {
    const db = drizzle({ client: pool, casing: 'snake_case' })
    const rows = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value }))
    const inserted = await db
      .insert(appSettings)
      .values(rows)
      .onConflictDoNothing({ target: appSettings.key })
      .returning({ key: appSettings.key })
    console.log(`[db:seed] app_settings 新增 ${inserted.length} 项，共 ${rows.length} 项`)
  } finally {
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error('[db:seed] 失败', error)
  process.exitCode = 1
})
