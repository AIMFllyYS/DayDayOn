import 'server-only'
import { and, count, desc, eq, gte, ilike, isNotNull, lte, sql } from 'drizzle-orm'
import type {
  AdminUserPage,
  AdminUserQuery,
  AdminUserRow,
  QuotaAdjustment,
  QuotaAdjustmentResult,
} from '@/features/admin/schemas'
import { weekRange } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import type { DbOrTx, Tx } from '@/server/db/client'
import { aiRuns, profiles, quotaAccounts, user } from '@/server/db/schema'
import { adjustBonus } from '@/server/quota/ledger'
import { writeAudit } from './audit'
import { escapeLike } from './rules'

/*
 * 后台用户表（PRD 2.12、7.3）：偏移分页、按邮箱包含匹配搜索。
 * 封号 / 解封不在这里：前端调 authClient.admin.banUser / unbanUser，审计由 auth hooks 写。
 * 本周 = 北京时间 ISO 周（ai_runs.dayKey 落在周一到周日之间）。
 */

/** 当前是否处于封禁中：banned 且未到期（与 auth/guards 的 isBanned 一致） */
function isBannedNow(banned: boolean | null, banExpires: Date | null, now: Date): boolean {
  if (!banned) return false
  return banExpires === null || banExpires.getTime() > now.getTime()
}

function emailFilter(q: string | undefined) {
  return q ? ilike(user.email, `%${escapeLike(q)}%`) : undefined
}

/** GET /admin/users */
export async function listUsers(
  db: DbOrTx,
  query: AdminUserQuery,
  now: Date,
): Promise<AdminUserPage> {
  const week = weekRange(now)
  const where = emailFilter(query.q)

  const ipCounts = db.$with('ip_counts').as(
    db
      .select({ ip: profiles.signupIp, accounts: count().as('accounts') })
      .from(profiles)
      .where(isNotNull(profiles.signupIp))
      .groupBy(profiles.signupIp),
  )
  const weekRuns = db.$with('week_runs').as(
    db
      .select({
        userId: aiRuns.userId,
        spentMicros: sql<string>`sum(${aiRuns.costMicros})`.as('spent_micros'),
        calls: count().as('calls'),
      })
      .from(aiRuns)
      .where(and(gte(aiRuns.dayKey, week.start), lte(aiRuns.dayKey, week.end)))
      .groupBy(aiRuns.userId),
  )

  const rows = await db
    .with(ipCounts, weekRuns)
    .select({
      userId: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      banned: user.banned,
      banReason: user.banReason,
      banExpires: user.banExpires,
      nickname: profiles.nickname,
      signupIp: profiles.signupIp,
      sameIpCount: ipCounts.accounts,
      weekSpentMicros: weekRuns.spentMicros,
      weekCalls: weekRuns.calls,
      bonusMicros: quotaAccounts.bonusMicros,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .leftJoin(ipCounts, eq(ipCounts.ip, profiles.signupIp))
    .leftJoin(weekRuns, eq(weekRuns.userId, user.id))
    .leftJoin(quotaAccounts, eq(quotaAccounts.userId, user.id))
    .where(where)
    .orderBy(desc(user.createdAt), desc(user.id))
    .limit(query.limit)
    .offset(query.offset)

  const [totalRow] = await db.select({ total: count() }).from(user).where(where)

  const items: AdminUserRow[] = rows.map((r) => {
    const banned = isBannedNow(r.banned, r.banExpires, now)
    return {
      userId: r.userId,
      nickname: r.nickname ?? null,
      email: r.email,
      role: r.role === 'admin' ? 'admin' : 'user',
      createdAt: r.createdAt.toISOString(),
      signupIp: r.signupIp ?? null,
      sameIpCount: Number(r.sameIpCount ?? (r.signupIp ? 1 : 0)),
      weekSpentMicros: Number(r.weekSpentMicros ?? 0),
      weekCalls: Number(r.weekCalls ?? 0),
      bonusMicros: r.bonusMicros ?? 0,
      status: banned ? 'banned' : 'active',
      banReason: banned ? (r.banReason ?? null) : null,
      banExpiresAt: banned && r.banExpires ? r.banExpires.toISOString() : null,
    }
  })
  return { items, total: Number(totalRow?.total ?? 0) }
}

/**
 * POST /admin/users/{userId}/quota-adjustments：加购余额 ± 金额（写 adjust 流水）+ 审计。
 * 用户不存在 404 USER_NOT_FOUND；扣成负数由 ledger 抛 400 VALIDATION_FAILED。
 */
export async function adjustUserQuota(
  tx: Tx,
  adminId: string,
  userId: string,
  input: QuotaAdjustment,
  now: Date,
): Promise<QuotaAdjustmentResult> {
  const [target] = await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1)
  if (!target) throw new ApiError('USER_NOT_FOUND', '用户不存在')

  const balance = await adjustBonus(tx, userId, input.amountMicros, input.reason, now)
  await writeAudit(tx, adminId, {
    action: 'quota.adjust',
    targetType: 'user',
    targetId: userId,
    detail: { amountMicros: input.amountMicros, reason: input.reason },
    now,
  })
  return { userId, bonusMicros: balance.bonusMicros }
}
