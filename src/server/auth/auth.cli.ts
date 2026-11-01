/*
 * 只给 Better Auth CLI 用的配置入口（database.md 第 8 节）。运行时不 import 本文件。
 *
 * auth@1.7.14 的 CLI 用 jiti 加载配置，解析不了 `import 'server-only'`（MODULE_NOT_FOUND），
 * 所以这里不含 server-only、不用 `@/` 别名、不连数据库，只复刻会影响表结构的配置：
 * plugins 列表必须与 src/server/auth/auth.ts 保持一致。
 *
 * 重新生成：pnpm dlx auth@1.7.14 generate --config src/server/auth/auth.cli.ts --output src/server/db/schema/auth.ts --yes
 */
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, emailOTP, twoFactor } from 'better-auth/plugins'

// CLI 只读取 provider 与插件的表定义，不执行查询；传一个空对象占位
const fakeDb = {} as Parameters<typeof drizzleAdapter>[0]

export const auth = betterAuth({
  database: drizzleAdapter(fakeDb, { provider: 'pg' }),
  emailAndPassword: { enabled: false },
  rateLimit: { enabled: true, storage: 'database' },
  plugins: [
    emailOTP({ async sendVerificationOTP() {} }),
    admin(),
    twoFactor({ issuer: 'DayDayOn' }),
  ],
})
