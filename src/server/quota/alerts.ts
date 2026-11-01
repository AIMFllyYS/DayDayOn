import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db/client'
import { alertsSent, user } from '@/server/db/schema'
import { sendMail } from '@/server/mail'
import { alertMail } from '@/server/mail/templates'

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

const TITLES: Record<AlertKind, string> = {
  'daily-cap-reached': '全站 AI 花费已达今日上限，AI 已暂停',
  'user-daily-spend': '有用户单日 AI 花费超过 5 元',
  'user-hourly-calls': '有用户每小时 AI 调用超过阈值',
  'ip-multi-account': '同一 IP 注册了多个账号',
  'redeem-failures': '有用户兑换码失败次数过多',
}

/**
 * 当天这一种告警还没发过就发信并记录；已发过直接返回 false。
 * 先插入去重行（ON CONFLICT DO NOTHING）再发信：并发时只有一个请求会发。
 * 发信失败只记日志，不抛给调用方（去重行保留，当天不再重试，避免刷屏）。
 */
export async function maybeAlert(
  kind: AlertKind,
  dayKey: string,
  detail: Record<string, string | number>,
): Promise<boolean> {
  try {
    const inserted = await db
      .insert(alertsSent)
      .values({ kind, dayKey })
      .onConflictDoNothing()
      .returning({ kind: alertsSent.kind })
    if (inserted.length === 0) return false

    const admins = await db.select({ email: user.email }).from(user).where(eq(user.role, 'admin'))
    if (admins.length === 0) {
      console.warn(`[alert] ${kind} 没有管理员可通知`)
      return true
    }
    const mail = alertMail(TITLES[kind], { 日期: dayKey, ...detail })
    await sendMail({ to: admins.map((a) => a.email), ...mail })
    return true
  } catch (error) {
    console.error(`[alert] ${kind} 发送失败`, error instanceof Error ? error.message : error)
    return false
  }
}
