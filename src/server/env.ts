import 'server-only'
import * as z from 'zod'

/*
 * 服务端环境变量：zod 校验，全项目唯一入口（database.md 第 1 节、auth.md 第 7 节）。
 *
 * 懒校验：第一次读取某个变量时才解析 process.env，模块加载本身不抛错。
 * `next build`（CI 里没有任何 .env）会加载 Route Handler 所在的模块图，
 * 构建阶段缺变量时用占位值兜底；运行时（next start / dev）缺变量照常抛错。
 */

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url({ error: 'DATABASE_URL 必须是连接串' }),
  BETTER_AUTH_SECRET: z.string().min(32, { error: 'BETTER_AUTH_SECRET 至少 32 个字符' }),
  BETTER_AUTH_URL: z.url({ error: 'BETTER_AUTH_URL 必须是网址' }),
  NEXT_PUBLIC_APP_URL: z.url({ error: 'NEXT_PUBLIC_APP_URL 必须是网址' }),
  // 可空：开发环境没有 SMTP_USER 时验证码打印到控制台（PRD 2.1）
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  // 可空：没有密钥时识别接口返回 503 AI_PAUSED（PRD 风险表）
  DEEPSEEK_API_KEY: z.string().min(1).optional(),
  // 可空：未配置时回退到 Cloudflare 官方测试密钥对（ADR-0023）
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
})

export type Env = z.infer<typeof EnvSchema>

/** 只在 `next build` 缺变量时使用，运行时永远不会用到 */
const BUILD_PLACEHOLDERS = {
  DATABASE_URL: 'postgres://build:build@127.0.0.1:23432/build',
  BETTER_AUTH_SECRET: 'build-time-placeholder-secret-not-used-at-runtime',
  BETTER_AUTH_URL: 'http://localhost:23329',
  NEXT_PUBLIC_APP_URL: 'http://localhost:23329',
} as const

function isNextBuild(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build'
}

/** 空字符串视为未设置：.env 模板里留空的可选项不应触发校验错误 */
function readRaw(): Record<string, string | undefined> {
  const raw: Record<string, string | undefined> = {}
  for (const key of Object.keys(EnvSchema.shape)) {
    const v = process.env[key]
    raw[key] = v === undefined || v === '' ? undefined : v
  }
  return raw
}

let cached: Env | undefined

/** 校验并缓存环境变量。运行时缺必填项会抛错，错误信息只含变量名 */
export function getEnv(): Env {
  if (cached) return cached
  const raw = readRaw()
  const result = EnvSchema.safeParse(raw)
  if (result.success) {
    cached = result.data
    return cached
  }
  if (isNextBuild()) {
    const merged = { ...raw }
    for (const [k, v] of Object.entries(BUILD_PLACEHOLDERS)) merged[k] ??= v
    cached = EnvSchema.parse(merged)
    return cached
  }
  const fields = Object.keys(z.flattenError(result.error).fieldErrors).join(', ')
  throw new Error(`环境变量缺失或不合法：${fields}（见 .env.example）`)
}

/** 便捷写法：`env.DATABASE_URL`。每次读取都经过 getEnv()，因此仍是懒校验 */
export const env: Readonly<Env> = new Proxy({} as Env, {
  get: (_target, key) => getEnv()[key as keyof Env],
})

export const isProduction = (): boolean => getEnv().NODE_ENV === 'production'
