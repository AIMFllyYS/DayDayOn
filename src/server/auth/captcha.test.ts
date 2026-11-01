import { describe, expect, it, vi } from 'vitest'
import { TURNSTILE_TEST_SECRET_KEY, verifyTurnstileToken } from './captcha'

describe('verifyTurnstileToken', () => {
  it('缺少或空白 token 返回 MISSING_RESPONSE', async () => {
    expect(await verifyTurnstileToken({ token: null, secretKey: 'sec' })).toEqual({
      ok: false,
      code: 'MISSING_RESPONSE',
    })
    expect(await verifyTurnstileToken({ token: '   ', secretKey: 'sec' })).toEqual({
      ok: false,
      code: 'MISSING_RESPONSE',
    })
  })

  it('siteverify 返回 success: true 且 action 匹配时通过', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, action: 'send-otp' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const res = await verifyTurnstileToken({
      token: 'valid-token',
      secretKey: 'sec-123',
      remoteIp: '203.0.113.5',
      expectedAction: 'send-otp',
      fetchFn,
    })

    expect(res).toEqual({ ok: true })
    expect(fetchFn).toHaveBeenCalledOnce()
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({
      secret: 'sec-123',
      response: 'valid-token',
      remoteip: '203.0.113.5',
    })
  })

  it('本地 127.0.0.1 不传 remoteip 给 Cloudflare', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }))

    await verifyTurnstileToken({
      token: 'valid-token',
      secretKey: 'sec-123',
      remoteIp: '127.0.0.1',
      fetchFn,
    })

    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({
      secret: 'sec-123',
      response: 'valid-token',
    })
  })

  it('siteverify 返回 success: false 时拒绝并附带 errorCodes', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false, 'error-codes': ['timeout-or-duplicate'] }), {
        status: 200,
      }),
    )

    const res = await verifyTurnstileToken({
      token: 'used-token',
      secretKey: 'sec-123',
      fetchFn,
    })

    expect(res).toEqual({
      ok: false,
      code: 'VERIFICATION_FAILED',
      errorCodes: ['timeout-or-duplicate'],
    })
  })

  it('action 不一致时拒绝（防跨场景复用 token）', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true, action: 'other-action' }), { status: 200 }),
      )

    const res = await verifyTurnstileToken({
      token: 'token-from-other-form',
      secretKey: 'sec-123',
      expectedAction: 'send-otp',
      fetchFn,
    })

    expect(res).toEqual({
      ok: false,
      code: 'VERIFICATION_FAILED',
      errorCodes: ['action-mismatch'],
    })
  })

  it('非生产环境下断网时官方测试密钥 DUMMY.TOKEN 可降级通过', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('fetch failed'))

    const res = await verifyTurnstileToken({
      token: 'XXXX.DUMMY.TOKEN.XXXX',
      secretKey: TURNSTILE_TEST_SECRET_KEY,
      fetchFn,
    })

    expect(res).toEqual({ ok: true })
  })
})
