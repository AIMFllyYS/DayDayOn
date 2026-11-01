import type { ContentfulStatusCode } from 'hono/utils/http-status'

/*
 * 错误码表：全项目唯一来源（api-conventions.md 第 6 节、PRD 5、7.5）。
 * 响应体固定为 { code, detail, ...extra }；前端只按 code 分支，文案在 src/lib/api/error-messages.ts。
 * 新增错误码只能由 F1 / 集成阶段改本文件（plan-mvp-build.md 第 2 节）。
 *
 * 本文件不 import 'server-only'：前端 error-messages.ts 需要 `import type { ErrorCode }`。
 */

export const ERROR_STATUS = {
  // 400
  VALIDATION_FAILED: 400,
  EMAIL_DOMAIN_NOT_ALLOWED: 400,
  MAKEUP_NOT_ALLOWED: 400,
  REDEEM_CODE_INVALID: 400,
  // 401
  UNAUTHENTICATED: 401,
  // 402
  QUOTA_INSUFFICIENT: 402,
  // 403
  FORBIDDEN: 403,
  ACCOUNT_BANNED: 403,
  TWO_FACTOR_REQUIRED: 403,
  ONBOARDING_REQUIRED: 403,
  // 404
  NOT_FOUND: 404,
  GOAL_NOT_FOUND: 404,
  CHECKIN_NOT_FOUND: 404,
  TODO_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
  REDEEM_CODE_NOT_FOUND: 404,
  // 409
  ALREADY_ONBOARDED: 409,
  GOAL_LIMIT_REACHED: 409,
  TODO_LIMIT_REACHED: 409,
  CHECKIN_EXISTS: 409,
  WEIGHT_CHANGE_UNCONFIRMED: 409,
  REDEEM_CODE_USED: 409,
  IDEMPOTENCY_KEY_REUSED: 409,
  REQUEST_IN_PROGRESS: 409,
  // 413
  PAYLOAD_TOO_LARGE: 413,
  // 415
  UNSUPPORTED_MEDIA_TYPE: 415,
  // 422
  AI_RECOGNITION_FAILED: 422,
  // 429
  RATE_LIMITED: 429,
  REDEEM_LOCKED: 429,
  // 500
  INTERNAL: 500,
  // 501：契约已定、实现未落地的接口或中间件（F1 桩）
  NOT_IMPLEMENTED: 501,
  // 503
  AI_PAUSED: 503,
} as const satisfies Record<string, ContentfulStatusCode>

export type ErrorCode = keyof typeof ERROR_STATUS
export const ERROR_CODES = Object.keys(ERROR_STATUS) as ErrorCode[]

/** 封号信息（PRD 7.1）：ACCOUNT_BANNED 带上 */
export interface BanInfo {
  reason: string | null
  /** ISO 时刻；null 表示永久 */
  expiresAt: string | null
}

/** 各错误码可以携带的额外字段 */
export interface ErrorExtras {
  /** VALIDATION_FAILED：z.flattenError(error).fieldErrors */
  fields?: Record<string, string[]>
  /** ACCOUNT_BANNED */
  ban?: BanInfo
  /** WEIGHT_CHANGE_UNCONFIRMED */
  previousWeightGrams?: number
  /** AI_RECOGNITION_FAILED：已产生的调用记录，费用照常结算 */
  aiRunId?: string
  /** RATE_LIMITED / REDEEM_LOCKED：同时写 Retry-After 头 */
  retryAfterSeconds?: number
}

export interface ErrorBody extends ErrorExtras {
  code: ErrorCode
  detail: string
}

/**
 * service 和中间件抛出的业务错误；根应用的 onError 把它转成 { code, detail, ...extras }。
 * detail 只给开发者看，不要放用户数据、SQL 或堆栈。
 */
export class ApiError extends Error {
  readonly code: ErrorCode
  readonly status: ContentfulStatusCode
  readonly extras: ErrorExtras

  constructor(code: ErrorCode, detail?: string, extras: ErrorExtras = {}) {
    super(detail ?? code)
    this.name = 'ApiError'
    this.code = code
    this.status = ERROR_STATUS[code]
    this.extras = extras
  }

  toBody(): ErrorBody {
    return { code: this.code, detail: this.message, ...this.extras }
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}
