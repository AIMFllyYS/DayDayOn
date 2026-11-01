import * as z from 'zod'
import { ERROR_CODES, ERROR_STATUS, type ErrorCode } from './errors'

/*
 * 跨领域的接口 schema（api-conventions.md 第 2 节）：错误体、分页、幂等头。
 * 领域 DTO 在 src/features/<领域>/schemas.ts。
 */

export const ErrorSchema = z
  .object({
    code: z.enum(ERROR_CODES as [ErrorCode, ...ErrorCode[]]),
    detail: z.string(),
    fields: z.record(z.string(), z.array(z.string())).optional(),
    ban: z
      .object({ reason: z.string().nullable(), expiresAt: z.iso.datetime().nullable() })
      .optional(),
    previousWeightGrams: z.number().int().optional(),
    aiRunId: z.string().optional(),
    retryAfterSeconds: z.number().int().optional(),
  })
  .meta({ id: 'Error' })

const errorResponse = { content: { 'application/json': { schema: ErrorSchema } } }

/**
 * createRoute 的 responses 里展开：`...errorResponses('GOAL_NOT_FOUND', 'VALIDATION_FAILED')`。
 * 按错误码推出状态码；同一状态码的多个错误码合并到描述里。
 */
export function errorResponses(...codes: ErrorCode[]) {
  const byStatus = new Map<number, ErrorCode[]>()
  for (const code of codes) {
    const status = ERROR_STATUS[code]
    byStatus.set(status, [...(byStatus.get(status) ?? []), code])
  }
  const out: Record<number, typeof errorResponse & { description: string }> = {}
  for (const [status, cs] of byStatus)
    out[status] = { ...errorResponse, description: cs.join(' | ') }
  return out
}

/** 每个需要登录的路由都会出现的错误 */
export const AUTH_ERRORS = ['UNAUTHENTICATED', 'ACCOUNT_BANNED', 'ONBOARDING_REQUIRED'] as const
export const ADMIN_ERRORS = [
  'UNAUTHENTICATED',
  'ACCOUNT_BANNED',
  'FORBIDDEN',
  'TWO_FACTOR_REQUIRED',
] as const

/** 创建类 POST 的请求头（键必须小写，见 lessons/hono.md） */
export const IdempotencyHeadersSchema = z.object({
  'idempotency-key': z.uuid({ error: 'idempotency-key 必须是 UUID' }),
})

/** 无响应体的成功（204 之外需要返回 JSON 时用） */
export const OkSchema = z.object({ ok: z.literal(true) }).meta({ id: 'Ok' })

export {
  cursorPage,
  offsetPage,
  CursorQuerySchema,
  OffsetQuerySchema,
} from '@/features/shared/schemas'
