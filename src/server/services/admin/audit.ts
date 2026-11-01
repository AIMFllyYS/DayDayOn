import 'server-only'
import type { DbOrTx } from '@/server/db/client'
import { adminAuditLogs } from '@/server/db/schema'

/*
 * 管理员操作审计（PRD 2.12）：每个后台写操作在同一事务里写一条，只增不删。
 * 封号 / 解封走 Better Auth，审计由 P1 的 hooks.after 写，不在这里。
 */

export type AdminAction =
  | 'ai.pause'
  | 'ai.resume'
  | 'quota.adjust'
  | 'redeem-codes.generate'
  | 'redeem-code.void'
  | 'settings.update'

export interface AuditEntry {
  action: AdminAction
  targetType: 'site' | 'user' | 'redeem-code' | 'settings'
  /** 全站操作没有对象 id */
  targetId?: string | null
  /** 不放明文兑换码、个人数据 */
  detail?: Record<string, unknown>
  now: Date
}

export async function writeAudit(tx: DbOrTx, adminId: string, entry: AuditEntry): Promise<void> {
  await tx.insert(adminAuditLogs).values({
    adminId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    detail: entry.detail ?? {},
    createdAt: entry.now,
    updatedAt: entry.now,
  })
}
