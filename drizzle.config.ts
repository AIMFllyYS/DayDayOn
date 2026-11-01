import { existsSync } from 'node:fs'
import { defineConfig } from 'drizzle-kit'

// drizzle-kit 不会自动读取 .env.local，这里用 Node 24 内置的 loadEnvFile 加载
if (existsSync('.env.local')) process.loadEnvFile('.env.local')

const url = process.env.DATABASE_URL
if (!url) throw new Error('缺少 DATABASE_URL：复制 .env.example 为 .env.local 后填写')

// 规范见 docs/conventions/database.md：casing 必须和 src/server/db/client.ts 一致
export default defineConfig({
  schema: './src/server/db/schema',
  out: './src/server/db/migrations',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: { url },
})
