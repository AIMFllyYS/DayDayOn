import 'server-only'

/*
 * 限流计数（api-conventions.md 第 8 节）：/api/v1 中间件与 Better Auth hooks.before 共用。
 * 计数存 rate_limit_counters，一条 INSERT … ON CONFLICT … DO UPDATE … RETURNING 完成计数和判断。
 * 签名 F1，实现 P1（带单测：窗口起点计算）。
 */

export interface RateLimitRule {
  /** 规则名，键的第一段，如 'ai-hourly'、'otp-email-daily' */
  name: string
  /** 窗口长度（秒） */
  windowSeconds: number
  /** 窗口内最多次数 */
  max: number
}

export interface RateLimitResult {
  ok: boolean
  /** 本次计数后的次数 */
  count: number
  /** 超限时距离窗口结束的秒数，用于 Retry-After */
  retryAfterSeconds: number
}

/**
 * 计数并判断。键为 `<rule.name>:<subject>:<窗口起点>`；subject 是 userId 或 IP。
 * `now` 由调用方传入以便测试。实现：P1
 */
export async function consume(
  rule: RateLimitRule,
  subject: string,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  void rule
  void subject
  void now
  throw new Error('not implemented: P1')
}
