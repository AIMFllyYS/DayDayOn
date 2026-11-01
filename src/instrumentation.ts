/*
 * Next.js 服务启动钩子：
 * 1. 默认关闭 Better Auth 遥测（BETTER_AUTH_TELEMETRY=0）
 * 2. 生产 Node.js 运行时自动执行 Drizzle 迁移（幂等）
 */

export async function register(): Promise<void> {
  process.env.BETTER_AUTH_TELEMETRY ??= '0'
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production') {
    const { runStartupMigrations } = await import('@/server/db/startup-migrate')
    await runStartupMigrations()
  }
}
