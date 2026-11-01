import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/server/db/client'
import { rateLimitCounters } from '@/server/db/schema'

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
 * 固定窗口：窗口起点 = 按 windowSeconds 对齐的 UTC 时刻。
 * 日窗口（86400 秒）按 UTC 对齐即北京时间 08:00 切换，限流只需要"24 小时内最多 N 次"，不需要对齐自然日。
 */
export function windowOf(rule: Pick<RateLimitRule, 'windowSeconds'>, now: Date) {
  const windowMs = rule.windowSeconds * 1000
  const startMs = Math.floor(now.getTime() / windowMs) * windowMs
  const endMs = startMs + windowMs
  return {
    start: new Date(startMs),
    end: new Date(endMs),
    retryAfterSeconds: Math.max(1, Math.ceil((endMs - now.getTime()) / 1000)),
  }
}

/** 计数键：`<规则名>:<subject>:<窗口起点秒>` */
export function counterKey(
  rule: Pick<RateLimitRule, 'name'>,
  subject: string,
  start: Date,
): string {
  return `${rule.name}:${subject}:${Math.floor(start.getTime() / 1000)}`
}

/** 把计数结果翻译成是否放行 */
export function judge(rule: Pick<RateLimitRule, 'max'>, count: number, retryAfterSeconds: number) {
  const ok = count <= rule.max
  return { ok, count, retryAfterSeconds: ok ? 0 : retryAfterSeconds }
}

let lastSweep = 0
const SWEEP_INTERVAL_MS = 10 * 60_000

/** 顺手清理过期计数行：每个进程最多 10 分钟一次，失败不影响限流 */
function sweepExpired(now: Date): void {
  if (now.getTime() - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now.getTime()
  db.delete(rateLimitCounters)
    .where(sql`${rateLimitCounters.expiresAt} < ${now}`)
    .catch((error: unknown) => {
      console.error('[rate-limit] 清理过期计数失败', error instanceof Error ? error.message : error)
    })
}

/**
 * 计数并判断。键为 `<rule.name>:<subject>:<窗口起点>`；subject 是 userId 或 IP。
 * 超限的请求同样计数（继续猛刷的客户端不会因为计数停住而提前解锁）。
 */
export async function consume(
  rule: RateLimitRule,
  subject: string,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const win = windowOf(rule, now)
  const key = counterKey(rule, subject, win.start)
  const [row] = await db
    .insert(rateLimitCounters)
    .values({ key, count: 1, expiresAt: win.end })
    .onConflictDoUpdate({
      target: rateLimitCounters.key,
      set: { count: sql`${rateLimitCounters.count} + 1`, updatedAt: now },
    })
    .returning({ count: rateLimitCounters.count })
  sweepExpired(now)
  return judge(rule, row?.count ?? 1, win.retryAfterSeconds)
}
