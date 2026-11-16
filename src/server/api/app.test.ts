import { describe, expect, it } from 'vitest'
import { app } from './app'
import { ApiError, ERROR_STATUS } from './errors'
import { buildOpenApiDocument } from './openapi'
import { errorResponses } from './schemas'

describe('根应用', () => {
  it('未注册的路径返回 404 NOT_FOUND 错误体', async () => {
    const res = await app.request('/api/v1/__nope__')
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('ApiError', () => {
  it('状态码来自错误码表，额外字段并入响应体', () => {
    const e = new ApiError('WEIGHT_CHANGE_UNCONFIRMED', '差太多', { previousWeightGrams: 60000 })
    expect(e.status).toBe(409)
    expect(e.toBody()).toEqual({
      code: 'WEIGHT_CHANGE_UNCONFIRMED',
      detail: '差太多',
      previousWeightGrams: 60000,
    })
  })

  it('PRD 7.5 的状态码', () => {
    expect(ERROR_STATUS.ONBOARDING_REQUIRED).toBe(403)
    expect(ERROR_STATUS.ALREADY_ONBOARDED).toBe(409)
    expect(ERROR_STATUS.REDEEM_LOCKED).toBe(429)
    expect(ERROR_STATUS.AI_RECOGNITION_FAILED).toBe(422)
    expect(ERROR_STATUS.MAKEUP_NOT_ALLOWED).toBe(400)
  })
})

describe('errorResponses', () => {
  it('按状态码合并错误码', () => {
    const r = errorResponses('GOAL_NOT_FOUND', 'CHECKIN_NOT_FOUND', 'CHECKIN_EXISTS')
    expect(Object.keys(r).sort()).toEqual(['404', '409'])
    expect(r[404]?.description).toBe('GOAL_NOT_FOUND | CHECKIN_NOT_FOUND')
  })
})

describe('OpenAPI 契约一致性', () => {
  it('ErrorSchema 包含 draft、引导前路由不含 ONBOARDING_REQUIRED、流式路由与幂等头已注册', () => {
    const doc = buildOpenApiDocument()
    const errorSchema = doc.components?.schemas?.Error as
      { properties?: Record<string, unknown> } | undefined
    expect(errorSchema?.properties).toHaveProperty('draft')

    const onboardingFreeOps = [
      doc.paths?.['/api/v1/me']?.get,
      doc.paths?.['/api/v1/me']?.delete,
      doc.paths?.['/api/v1/me/onboarding']?.post,
      doc.paths?.['/api/v1/me/export']?.get,
    ]
    for (const op of onboardingFreeOps) {
      expect(op).toBeDefined()
      const desc403 = op?.responses?.['403']?.description ?? ''
      expect(desc403).not.toContain('ONBOARDING_REQUIRED')
    }

    expect(
      doc.paths?.['/api/v1/agent/chat']?.post?.responses?.['200']?.content?.['text/event-stream'],
    ).toBeDefined()
    expect(
      doc.paths?.['/api/v1/goals/{goalId}/referee']?.post?.responses?.['200']?.content?.[
        'text/event-stream'
      ],
    ).toBeDefined()

    const idempotentOps = [
      doc.paths?.['/api/v1/friends/invite']?.post,
      doc.paths?.['/api/v1/friends/accept']?.post,
      doc.paths?.['/api/v1/friends/{friendUserId}/interact']?.post,
      doc.paths?.['/api/v1/chats/{friendUserId}']?.post,
      doc.paths?.['/api/v1/friends/{friendUserId}/chat']?.post,
    ]
    for (const op of idempotentOps) {
      const hasHeader = (op?.parameters ?? []).some(
        (p) => 'in' in p && p.in === 'header' && p.name === 'idempotency-key',
      )
      expect(hasHeader).toBe(true)
    }
  })
})
