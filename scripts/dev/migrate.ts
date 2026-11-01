// 本地执行迁移：pnpm db:migrate。规范见 docs/conventions/database.md 第 7 节
import { existsSync } from 'node:fs'
import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')

const url = process.env.DATABASE_URL
if (!url) throw new Error('缺少 DATABASE_URL：复制 .env.example 为 .env.local 后填写')

const migrationsFolder = path.resolve('src/server/db/migrations')

async function main(): Promise<void> {
  // 还没有生成过迁移时没有 journal，migrate() 会抛错；此时直接跳过
  if (!existsSync(path.join(migrationsFolder, 'meta', '_journal.json'))) {
    console.log('[db:migrate] 还没有迁移文件，跳过。先运行 pnpm db:generate')
    return
  }
  const pool = new Pool({ connectionString: url, max: 1 })
  try {
    await migrate(drizzle({ client: pool, casing: 'snake_case' }), { migrationsFolder })
    console.log('[db:migrate] 完成')
  } finally {
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error('[db:migrate] 失败', error)
  process.exitCode = 1
})
