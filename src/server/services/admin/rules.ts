import 'server-only'
import type { Anomaly, AnomalyKind } from '@/features/admin/schemas'
import { addDays, eachLocalDate } from '@/lib/time'

/*
 * 后台的纯规则（PRD 2.12、ADR-0002 第 7 节）：异常判定、花费曲线补零。不碰数据库、不读当前时间，带单测。
 * overview.ts 查出候选行再交给这里判定；SQL 里的 HAVING 只是为了少取行，判定以这里为准。
 */

/** 异常阈值：单人单日 > 5 元、单人每小时 > 60 次、同一注册 IP > 3 个账号（ai-and-quota.md 第 8 节） */
export const ANOMALY_THRESHOLDS = {
  userDailySpendMicros: 5_000_000,
  userHourlyCalls: 60,
  accountsPerIp: 3,
} as const

export interface AnomalyInput {
  /** 今天（北京时间）每个用户的 AI 花费 */
  dailySpend: readonly { userId: string; spentMicros: number }[]
  /** 近 24 小时每个用户每个整点小时的调用次数（同一用户可以有多行） */
  hourlyCalls: readonly { userId: string; calls: number }[]
  /** 每个注册 IP 的账号数 */
  signupIps: readonly { ip: string; accounts: number }[]
  /** 近 24 小时每个用户的兑换失败次数 */
  redeemFailures: readonly { userId: string; failures: number }[]
}

export interface AnomalyOptions {
  /** 兑换失败多少次算异常：与锁定阈值一致（AppSettings.redeemFailLockThreshold） */
  redeemFailThreshold: number
  /** userId → 昵称或邮箱 */
  labels: ReadonlyMap<string, string>
  now: Date
}

const KIND_ORDER: Record<AnomalyKind, number> = {
  'user-daily-spend': 0,
  'user-hourly-calls': 1,
  'ip-multi-account': 2,
  'redeem-failures': 3,
}

/** 按阈值判定异常；同一用户的多个小时只取最高的一次。按种类、再按数值降序排列 */
export function detectAnomalies(input: AnomalyInput, opts: AnomalyOptions): Anomaly[] {
  const detectedAt = opts.now.toISOString()
  const label = (userId: string) => opts.labels.get(userId) ?? null
  const out: Anomaly[] = []

  for (const row of input.dailySpend) {
    if (row.spentMicros > ANOMALY_THRESHOLDS.userDailySpendMicros) {
      out.push({
        kind: 'user-daily-spend',
        subject: row.userId,
        label: label(row.userId),
        value: row.spentMicros,
        detectedAt,
      })
    }
  }

  const peakCalls = new Map<string, number>()
  for (const row of input.hourlyCalls) {
    peakCalls.set(row.userId, Math.max(peakCalls.get(row.userId) ?? 0, row.calls))
  }
  for (const [userId, calls] of peakCalls) {
    if (calls > ANOMALY_THRESHOLDS.userHourlyCalls) {
      out.push({
        kind: 'user-hourly-calls',
        subject: userId,
        label: label(userId),
        value: calls,
        detectedAt,
      })
    }
  }

  for (const row of input.signupIps) {
    if (row.accounts > ANOMALY_THRESHOLDS.accountsPerIp) {
      out.push({
        kind: 'ip-multi-account',
        subject: row.ip,
        label: null,
        value: row.accounts,
        detectedAt,
      })
    }
  }

  for (const row of input.redeemFailures) {
    if (row.failures >= opts.redeemFailThreshold) {
      out.push({
        kind: 'redeem-failures',
        subject: row.userId,
        label: label(row.userId),
        value: row.failures,
        detectedAt,
      })
    }
  }

  return out.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.value - a.value)
}

/** 近 days 天（含今天）每天的花费，按日期升序；没有记录的日子补 0 */
export function fillSpendSeries(
  rows: readonly { dayKey: string; spentMicros: number }[],
  today: string,
  days = 30,
): { dayKey: string; spentMicros: number }[] {
  const byDay = new Map(rows.map((r) => [r.dayKey, r.spentMicros]))
  return eachLocalDate(addDays(today, -(days - 1)), today).map((dayKey) => ({
    dayKey,
    spentMicros: byDay.get(dayKey) ?? 0,
  }))
}

/** 今天的花费是否已达全站日上限（实时判断，PRD 7.3） */
export function isCapReached(todaySpentMicros: number, dailySpendCapMicros: number): boolean {
  return todaySpentMicros >= dailySpendCapMicros
}

/** ILIKE 的通配符转义：用户输入的 % _ \ 按字面匹配 */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&')
}
