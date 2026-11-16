import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  consume: vi.fn(),
  maybeAlert: vi.fn(),
  getSettings: vi.fn(),
}))

vi.mock('@/server/rate-limit', () => ({
  consume: (...args: unknown[]) => mocks.consume(...args),
}))

vi.mock('@/server/quota/alerts', () => ({
  maybeAlert: (...args: unknown[]) => mocks.maybeAlert(...args),
}))

vi.mock('@/server/settings', () => ({
  getSettings: () => mocks.getSettings(),
}))

vi.mock('@/server/db/client', () => ({
  db: {},
}))

const { databaseHooks } = await import('./hooks')

describe('auth databaseHooks: 同 IP 多账号告警与注册限流', () => {
  beforeEach(() => {
    mocks.consume.mockReset()
    mocks.maybeAlert.mockReset()
    mocks.maybeAlert.mockResolvedValue(true)
    mocks.getSettings.mockResolvedValue({ signupPerIpDaily: 100 })
  })

  it('同 IP 当日注册第 3 个账号不触发告警，第 4 个账号放行但触发 ip-multi-account 告警', async () => {
    const beforeCreate = databaseHooks.user!.create!.before!
    const ctx = {
      headers: new Headers({ 'x-real-ip': '203.0.113.42' }),
    } as Parameters<typeof beforeCreate>[1]

    mocks.consume.mockResolvedValueOnce({ ok: true, count: 3, retryAfterSeconds: 0 })
    await expect(beforeCreate({} as never, ctx)).resolves.toBeUndefined()
    expect(mocks.maybeAlert).not.toHaveBeenCalled()

    mocks.consume.mockResolvedValueOnce({ ok: true, count: 4, retryAfterSeconds: 0 })
    await expect(beforeCreate({} as never, ctx)).resolves.toBeUndefined()
    expect(mocks.maybeAlert).toHaveBeenCalledTimes(1)
    expect(mocks.maybeAlert.mock.calls[0]?.[0]).toBe('ip-multi-account')
    expect(mocks.maybeAlert.mock.calls[0]?.[2]).toEqual({ ip: '203.0.113.42', count: 4 })
  })

  it('同 IP 当日注册超过 signupPerIpDaily 时抛出 RATE_LIMITED', async () => {
    const beforeCreate = databaseHooks.user!.create!.before!
    const ctx = {
      headers: new Headers({ 'x-real-ip': '203.0.113.42' }),
    } as Parameters<typeof beforeCreate>[1]

    mocks.consume.mockResolvedValueOnce({ ok: false, count: 101, retryAfterSeconds: 3600 })
    await expect(beforeCreate({} as never, ctx)).rejects.toMatchObject({
      body: { code: 'RATE_LIMITED' },
    })
    expect(mocks.maybeAlert).toHaveBeenCalledTimes(1)
  })
})
