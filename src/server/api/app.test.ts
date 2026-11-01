import { describe, expect, it } from 'vitest'
import { app } from './app'
import { ApiError, ERROR_STATUS } from './errors'
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
