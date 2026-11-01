import 'server-only'

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

/** 计算请求摘要。实现：P1 */
export async function requestHash(method: string, path: string, body: string): Promise<string> {
  void method
  void path
  void body
  throw new Error('not implemented: P1')
}

/** 开始一次幂等请求。实现：P1 */
export async function beginIdempotent(input: IdempotencyBegin): Promise<IdempotencyOutcome> {
  void input
  throw new Error('not implemented: P1')
}

/**
 * 完成：写入响应。storeBody = false 时只记状态和摘要（明文兑换码不落库，PRD 7.3）。实现：P1
 */
export async function completeIdempotent(
  userId: string,
  key: string,
  response: { status: number; body: unknown; storeBody: boolean },
): Promise<void> {
  void userId
  void key
  void response
  throw new Error('not implemented: P1')
}

/** 失败：删除 processing 行，让客户端可以用同一个键重试。实现：P1 */
export async function abortIdempotent(userId: string, key: string): Promise<void> {
  void userId
  void key
  throw new Error('not implemented: P1')
}
