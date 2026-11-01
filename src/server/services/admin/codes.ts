import 'server-only'
import { and, count, desc, eq } from 'drizzle-orm'
import type {
  AdminCodePage,
  AdminCodeQuery,
  AdminCodeRow,
  GenerateCodes,
  GeneratedCodes,
} from '@/features/admin/schemas'
import { ApiError } from '@/server/api/errors'
import type { DbOrTx, Tx } from '@/server/db/client'
import { profiles, redeemCodes, user } from '@/server/db/schema'
import {
  CODE_VALUE_MICROS,
  codePrefix,
  generateCode,
  hashCode,
  normalizeCode,
} from '@/server/quota/redeem-code'
import { writeAudit } from './audit'

/*
 * 兑换码管理（PRD 2.7、2.12、7.3）。生成、规范化、哈希只经 src/server/quota/redeem-code.ts。
 * 明文只在生成接口的响应里出现一次：库里只存 SHA-256，审计和幂等记录都不存明文。
 */

/** 哈希碰撞（极小概率）时重抽的最多轮数 */
const MAX_ROUNDS = 3

const rowColumns = {
  id: redeemCodes.id,
  prefix: redeemCodes.prefix,
  valueMicros: redeemCodes.valueMicros,
  status: redeemCodes.status,
  createdAt: redeemCodes.createdAt,
  redeemedAt: redeemCodes.redeemedAt,
  redeemedById: user.id,
  redeemedByEmail: user.email,
  redeemedByNickname: profiles.nickname,
}

type RowSelect = {
  id: string
  prefix: string
  valueMicros: number
  status: AdminCodeRow['status']
  createdAt: Date
  redeemedAt: Date | null
  redeemedById: string | null
  redeemedByEmail: string | null
  redeemedByNickname: string | null
}

function toRow(r: RowSelect): AdminCodeRow {
  return {
    id: r.id,
    prefix: r.prefix,
    valueMicros: r.valueMicros,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    redeemedBy:
      r.redeemedById && r.redeemedByEmail
        ? { userId: r.redeemedById, nickname: r.redeemedByNickname, email: r.redeemedByEmail }
        : null,
    redeemedAt: r.redeemedAt ? r.redeemedAt.toISOString() : null,
  }
}

function baseSelect(db: DbOrTx) {
  return db
    .select(rowColumns)
    .from(redeemCodes)
    .leftJoin(user, eq(user.id, redeemCodes.redeemedBy))
    .leftJoin(profiles, eq(profiles.userId, redeemCodes.redeemedBy))
}

/** GET /admin/redeem-codes：按生成时间倒序，偏移分页 */
export async function listCodes(db: DbOrTx, query: AdminCodeQuery): Promise<AdminCodePage> {
  const where = query.status ? eq(redeemCodes.status, query.status) : undefined
  const rows = await baseSelect(db)
    .where(where)
    .orderBy(desc(redeemCodes.createdAt), desc(redeemCodes.id))
    .limit(query.limit)
    .offset(query.offset)
  const [totalRow] = await db.select({ total: count() }).from(redeemCodes).where(where)
  return { items: rows.map(toRow), total: Number(totalRow?.total ?? 0) }
}

/** POST /admin/redeem-codes：批量生成，返回明文（只此一次） */
export async function generateCodes(
  tx: Tx,
  adminId: string,
  input: GenerateCodes,
  now: Date,
): Promise<GeneratedCodes> {
  const created: { id: string; code: string }[] = []
  for (let round = 0; round < MAX_ROUNDS && created.length < input.count; round += 1) {
    const batch = await Promise.all(
      Array.from({ length: input.count - created.length }, async () => {
        const code = generateCode()
        const normalized = normalizeCode(code)
        if (!normalized) throw new Error('生成的兑换码无法规范化')
        return { code, hash: await hashCode(normalized), prefix: codePrefix(normalized) }
      }),
    )
    const inserted = await tx
      .insert(redeemCodes)
      .values(
        batch.map((b) => ({
          codeHash: b.hash,
          prefix: b.prefix,
          valueMicros: CODE_VALUE_MICROS,
          status: 'unused' as const,
          createdBy: adminId,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoNothing({ target: redeemCodes.codeHash })
      .returning({ id: redeemCodes.id, codeHash: redeemCodes.codeHash })
    const byHash = new Map(batch.map((b) => [b.hash, b.code]))
    for (const row of inserted) {
      const code = byHash.get(row.codeHash)
      if (code) created.push({ id: row.id, code })
    }
  }
  if (created.length < input.count) throw new Error('兑换码生成冲突过多')

  await writeAudit(tx, adminId, {
    action: 'redeem-codes.generate',
    targetType: 'redeem-code',
    detail: {
      count: created.length,
      valueMicros: CODE_VALUE_MICROS,
      ids: created.map((c) => c.id),
    },
    now,
  })
  return { codes: created, valueMicros: CODE_VALUE_MICROS }
}

/**
 * POST /admin/redeem-codes/{codeId}/void：作废未使用的码。
 * 已作废的原样返回；已兑换 409 REDEEM_CODE_USED；不存在 404 REDEEM_CODE_NOT_FOUND。
 */
export async function voidCode(
  tx: Tx,
  adminId: string,
  codeId: string,
  now: Date,
): Promise<AdminCodeRow> {
  const updated = await tx
    .update(redeemCodes)
    .set({ status: 'void', updatedAt: now })
    .where(and(eq(redeemCodes.id, codeId), eq(redeemCodes.status, 'unused')))
    .returning({ id: redeemCodes.id })

  const [row] = await baseSelect(tx).where(eq(redeemCodes.id, codeId)).limit(1)
  if (!row) throw new ApiError('REDEEM_CODE_NOT_FOUND', '兑换码不存在')
  if (updated.length === 0 && row.status === 'redeemed') {
    throw new ApiError('REDEEM_CODE_USED', '兑换码已被使用，不能作废')
  }
  if (updated.length > 0) {
    await writeAudit(tx, adminId, {
      action: 'redeem-code.void',
      targetType: 'redeem-code',
      targetId: codeId,
      detail: { prefix: row.prefix },
      now,
    })
  }
  return toRow(row)
}
