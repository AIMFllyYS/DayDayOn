import 'server-only'

/*
 * 阈值告警（PRD 7.3、ai-and-quota.md 第 8 节）。签名 F1，实现 P1。
 * 发给所有 role = admin 的邮箱；按 alerts_sent(kind, dayKey) 去重（每天每种一次）。
 */

export type AlertKind =
  | 'daily-cap-reached'
  | 'user-daily-spend'
  | 'user-hourly-calls'
  | 'ip-multi-account'
  | 'redeem-failures'

/**
 * 当天这一种告警还没发过就发信并记录；已发过直接返回 false。
 * 发信失败只记日志，不抛给调用方。实现：P1
 */
export async function maybeAlert(
  kind: AlertKind,
  dayKey: string,
  detail: Record<string, string | number>,
): Promise<boolean> {
  void kind
  void dayKey
  void detail
  throw new Error('not implemented: P1')
}
