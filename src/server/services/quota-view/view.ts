import type { AiRunItem, QuotaView } from '@/features/quota/schemas'
import type { AiPurpose, AiRunStatus } from '@/features/quota/schemas'
import { weeklyRemaining } from '@/server/quota/money'

/*
 * 额度与调用记录的 DTO 映射（纯函数，带单测）。
 * 口径见 quota/money.ts：weeklyUsed 已含本周部分的预占，所以剩余 = limit - used。
 */

export interface BalanceRow {
  periodKey: string
  weeklyLimitMicros: number
  weeklyUsedMicros: number
  bonusMicros: number
  reservedMicros: number
}

export function toQuotaView(balance: BalanceRow, periodEndsAt: Date): QuotaView {
  return {
    periodKey: balance.periodKey,
    weeklyLimitMicros: balance.weeklyLimitMicros,
    weeklyUsedMicros: balance.weeklyUsedMicros,
    weeklyRemainingMicros: weeklyRemaining(balance),
    bonusMicros: Math.max(0, balance.bonusMicros),
    reservedMicros: Math.max(0, balance.reservedMicros),
    periodEndsAt: periodEndsAt.toISOString(),
  }
}

export interface AiRunRow {
  id: string
  purpose: AiPurpose
  status: AiRunStatus
  costMicros: number
  createdAt: Date
}

export function toAiRunItem(row: AiRunRow): AiRunItem {
  return {
    id: row.id,
    purpose: row.purpose,
    status: row.status,
    costMicros: row.costMicros,
    createdAt: row.createdAt.toISOString(),
  }
}
