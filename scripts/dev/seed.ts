// 本地种子数据：pnpm db:seed（database.md 第 9 节）。幂等：补齐缺失配置，并把低于新基线的频控阈值提升到默认值、清理本地限流计数。
// 用户由 Better Auth 在登录时创建，这里不造用户。
import { existsSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { appSettings, rateLimit, rateLimitCounters } from '../../src/server/db/schema'
import { DEFAULT_SETTINGS, type AppSettingKey } from '../../src/server/settings-schema'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')

const url = process.env.DATABASE_URL
if (!url) throw new Error('缺少 DATABASE_URL：复制 .env.example 为 .env.local 后填写')

const RATE_LIMIT_BASELINE_KEYS: AppSettingKey[] = [
  'signupPerIpDaily',
  'otpPerEmailDaily',
  'otpPerIpDaily',
]

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

    // 若库里已存在的频控阈值低于代码新基线，自动提升到新基线，避免旧种子值锁死本地登录
    let upgraded = 0
    for (const key of RATE_LIMIT_BASELINE_KEYS) {
      const target = DEFAULT_SETTINGS[key]
      const res = await db
        .update(appSettings)
        .set({ value: target, updatedAt: new Date() })
        .where(sql`${appSettings.key} = ${key} AND (${appSettings.value})::text::int < ${target}`)
        .returning({ key: appSettings.key })
      upgraded += res.length
    }

    await db.delete(rateLimitCounters)
    await db.delete(rateLimit)

    console.log(
      `[db:seed] app_settings 新增 ${inserted.length} 项、提升旧频控阈值 ${upgraded} 项（共 ${rows.length} 项），并已清空本地限流计数`,
    )
  } finally {
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error('[db:seed] 失败', error)
  process.exitCode = 1
})
