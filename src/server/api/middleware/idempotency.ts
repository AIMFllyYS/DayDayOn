import 'server-only'
import { createMiddleware } from 'hono/factory'
import type { MiddlewareHandler } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { sha256HexBytes } from '@/server/crypto'
import {
  abortIdempotent,
  beginIdempotent,
  completeIdempotent,
  requestHash,
} from '@/server/idempotency'
import type { AppEnv } from '../app'
import { ApiError } from '../errors'
import { IdempotencyHeadersSchema } from '../schemas'

/*
 * 幂等中间件（api-conventions.md 第 9 节、PRD 7.3）。签名 F1，实现 P1。
 * 读 'idempotency-key' 请求头（路由的 request.headers 用 IdempotencyHeadersSchema 声明）。
 * 新请求放行并在响应后 completeIdempotent；重放原样返回；处理中 409 REQUEST_IN_PROGRESS；
 * 摘要不同 409 IDEMPOTENCY_KEY_REUSED；handler 抛错时 abortIdempotent。
 *
 * 哪些结果会被记住：
 * - 5xx、402（额度不足）、429（限流）：什么都没发生，删掉记录，允许用同一个键稍后重试；
 * - 其余（2xx、400、404、409、422…）：记住，重放原样返回。422 AI_RECOGNITION_FAILED 已经扣过费，
 *   重试不能再调一次模型。
 */

export interface IdempotencyOptions {
  /** false：只存状态和摘要，不存响应体（批量生成兑换码），同键重放返回 409 IDEMPOTENCY_KEY_REUSED */
  storeBody?: boolean
}

/** 不记住结果、允许同键重试的状态码 */
function isRetryable(status: number): boolean {
  return status >= 500 || status === 402 || status === 429
}

/** 必须挂在 requireUser 之后 */
export function idempotency(options: IdempotencyOptions = {}): MiddlewareHandler<AppEnv> {
  const storeBody = options.storeBody ?? true
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user') as AppEnv['Variables']['user'] | undefined
    if (!user) throw new Error('idempotency() 必须挂在 requireUser 之后')

    const parsed = IdempotencyHeadersSchema.safeParse({
      'idempotency-key': c.req.header('idempotency-key'),
    })
    if (!parsed.success) {
      const error = new ApiError('VALIDATION_FAILED', '缺少或不合法的 idempotency-key 请求头', {
        fields: { 'idempotency-key': ['需要一个 UUID'] },
      })
      return c.json(error.toBody(), error.status)
    }
    const key = parsed.data['idempotency-key']

    // 读成字节：Hono 会缓存，后面的 json / form 校验器照常能读到（multipart 图片不转成字符串）
    const bodyDigest = await sha256HexBytes(await c.req.arrayBuffer())
    const hash = await requestHash(c.req.method, c.req.path, bodyDigest)

    const outcome = await beginIdempotent({ userId: user.id, key, requestHash: hash })
    switch (outcome.kind) {
      case 'replay': {
        c.header('Idempotent-Replayed', 'true')
        if (outcome.body === null) return c.body(null, outcome.status as 204)
        return c.json(outcome.body, outcome.status as ContentfulStatusCode)
      }
      case 'replay-without-body':
      case 'mismatch': {
        const error = new ApiError(
          'IDEMPOTENCY_KEY_REUSED',
          outcome.kind === 'mismatch' ? '同一个键对应了不同的请求' : '这个请求已经完成过',
        )
        return c.json(error.toBody(), error.status)
      }
      case 'in-progress': {
        const error = new ApiError('REQUEST_IN_PROGRESS', '同一个请求还在处理中')
        return c.json(error.toBody(), error.status)
      }
      case 'new':
        break
    }

    try {
      await next()
    } catch (error) {
      await abortIdempotent(user.id, key)
      throw error
    }

    const status = c.res.status
    // handler 抛出的非业务错误（c.error 不是 ApiError）一律不记住
    const unexpected = c.error !== undefined && !(c.error instanceof ApiError)
    if (unexpected || isRetryable(status)) {
      await abortIdempotent(user.id, key)
      return
    }
    let body: unknown = null
    if (storeBody && c.res.headers.get('content-type')?.includes('application/json')) {
      body = await c.res.clone().json()
    }
    await completeIdempotent(user.id, key, { status, body, storeBody })
  })
}
