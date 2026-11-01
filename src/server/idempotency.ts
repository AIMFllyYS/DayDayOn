import 'server-only'
import { and, eq, lt, sql } from 'drizzle-orm'
import { db } from '@/server/db/client'
import { idempotencyKeys } from '@/server/db/schema'
import { sha256Hex } from '@/server/crypto'

/*
 * 幂等键（api-conventions.md 第 9 节、PRD 7.3）。签名 F1，实现 P1。
 * 表 idempotency_keys：唯一 (user_id, key)，保留 24 小时。
 */

export const IDEMPOTENCY_TTL_SECONDS = 24 * 3600

export interface IdempotencyBegin {
  userId: string
  key: string
  /** 方法 + 路径 + 请求体的 SHA-256 十六进制（requestHash()） */
  requestHash: string
  now?: Date
}

export type IdempotencyOutcome =
  /** 第一次到达：已插入 processing 行，继续执行 */
  | { kind: 'new' }
  /** 摘要相同、已完成：原样返回 */
  | { kind: 'replay'; status: number; body: unknown }
  /** 摘要相同、已完成，但当时选择不存响应体（批量生成兑换码）：返回 409 IDEMPOTENCY_KEY_REUSED */
  | { kind: 'replay-without-body' }
  /** 摘要相同、还在处理：409 REQUEST_IN_PROGRESS */
  | { kind: 'in-progress' }
  /** 摘要不同：409 IDEMPOTENCY_KEY_REUSED */
  | { kind: 'mismatch' }

/** 计算请求摘要：方法、路径、请求体用换行拼接后取 SHA-256 */
export async function requestHash(method: string, path: string, body: string): Promise<string> {
  return sha256Hex(`${method.toUpperCase()}\n${path}\n${body}`)
}

type Row = Pick<
  typeof idempotencyKeys.$inferSelect,
  'requestHash' | 'status' | 'responseStatus' | 'responseBody'
>

/** 已有一行时的判定（纯函数，便于测试） */
export function classifyExisting(
  row: Row,
  hash: string,
): Exclude<IdempotencyOutcome, { kind: 'new' }> {
  if (row.requestHash !== hash) return { kind: 'mismatch' }
  if (row.status === 'processing') return { kind: 'in-progress' }
  // storeBody = false 时 responseStatus 也不存；存了状态但体为空的是 204 这类无体响应
  if (row.responseStatus === null) return { kind: 'replay-without-body' }
  return { kind: 'replay', status: row.responseStatus, body: row.responseBody ?? null }
}

/**
 * 开始一次幂等请求。
 * 过期行（超过 24 小时）先删掉再插入，等同于一个新键。插入用 ON CONFLICT DO NOTHING：
 * 没插进去说明已有一行，再读出来判定，不依赖捕获唯一冲突。
 */
export async function beginIdempotent(input: IdempotencyBegin): Promise<IdempotencyOutcome> {
  const now = input.now ?? new Date()
  await db
    .delete(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.userId, input.userId),
        eq(idempotencyKeys.key, input.key),
        lt(idempotencyKeys.expiresAt, now),
      ),
    )
  const inserted = await db
    .insert(idempotencyKeys)
    .values({
      userId: input.userId,
      key: input.key,
      requestHash: input.requestHash,
      status: 'processing',
      expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_SECONDS * 1000),
    })
    .onConflictDoNothing({ target: [idempotencyKeys.userId, idempotencyKeys.key] })
    .returning({ id: idempotencyKeys.id })
  if (inserted.length > 0) return { kind: 'new' }

  const [row] = await db
    .select({
      requestHash: idempotencyKeys.requestHash,
      status: idempotencyKeys.status,
      responseStatus: idempotencyKeys.responseStatus,
      responseBody: idempotencyKeys.responseBody,
    })
    .from(idempotencyKeys)
    .where(and(eq(idempotencyKeys.userId, input.userId), eq(idempotencyKeys.key, input.key)))
    .limit(1)
  // 插入冲突后又读不到：另一个请求刚好 abort 删掉了它，按处理中返回，让客户端稍后重试
  if (!row) return { kind: 'in-progress' }
  return classifyExisting(row, input.requestHash)
}

/**
 * 完成：写入响应。storeBody = false 时只记状态和摘要（明文兑换码不落库，PRD 7.3）
 */
export async function completeIdempotent(
  userId: string,
  key: string,
  response: { status: number; body: unknown; storeBody: boolean },
): Promise<void> {
  await db
    .update(idempotencyKeys)
    .set({
      status: 'completed',
      responseStatus: response.storeBody ? response.status : null,
      // jsonb：null 用 SQL NULL，不写 JSON 的 'null'
      responseBody: response.storeBody ? (response.body ?? sql`NULL`) : sql`NULL`,
      updatedAt: new Date(),
    })
    .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key)))
}

/** 失败：删除 processing 行，让客户端可以用同一个键重试 */
export async function abortIdempotent(userId: string, key: string): Promise<void> {
  await db
    .delete(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.userId, userId),
        eq(idempotencyKeys.key, key),
        eq(idempotencyKeys.status, 'processing'),
      ),
    )
}
