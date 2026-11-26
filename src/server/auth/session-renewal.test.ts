import { betterAuth } from 'better-auth'
import { memoryAdapter } from 'better-auth/adapters/memory'
import { emailOTP } from 'better-auth/plugins'
import { describe, expect, it } from 'vitest'
import {
  SESSION_EXPIRES_IN_SECONDS,
  SESSION_POLICY,
  SESSION_UPDATE_AGE_SECONDS,
} from './session-config'

/*
 * 30 天滑动会话留存与 RSC/API 协同回归测试（Issue #98）：
 * 1. 新登录会话有效期与 Cookie Max-Age 均为 30 天；
 * 2. RSC 只读路径传 disableRefresh: true 不会提前写库，避免饿死紧随其后的 /api/v1 续期；
 * 3. API 路径传 returnHeaders: true 会在超过 updateAge（24h）后同时推进 DB expiresAt 与返回新 Set-Cookie；
 * 4. 存量 7 天老会话首次活跃自动平滑续期至 +30 天；
 * 5. 过期会话会生成 Max-Age=0 清理头，供 Hono 401 响应透传清除死 Cookie。
 */

const BASE = 'http://localhost:23329'
type Row = Record<string, unknown>

function createHarness() {
  const memory: Record<string, Row[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
    rateLimit: [],
  }
  const otps = new Map<string, string>()
  const auth = betterAuth({
    baseURL: BASE,
    secret: 'test-secret-test-secret-test-secret-123',
    database: memoryAdapter(memory),
    session: SESSION_POLICY,
    emailAndPassword: { enabled: false },
    telemetry: { enabled: false },
    rateLimit: { enabled: false },
    plugins: [
      emailOTP({
        async sendVerificationOTP({ email, otp }) {
          otps.set(email, otp)
        },
      }),
    ],
  })

  async function signIn(email: string) {
    await auth.handler(
      new Request(`${BASE}/api/auth/email-otp/send-verification-otp`, {
        method: 'POST',
        headers: { origin: BASE, 'content-type': 'application/json' },
        body: JSON.stringify({ email, type: 'sign-in' }),
      }),
    )
    const res = await auth.handler(
      new Request(`${BASE}/api/auth/sign-in/email-otp`, {
        method: 'POST',
        headers: { origin: BASE, 'content-type': 'application/json' },
        body: JSON.stringify({ email, otp: otps.get(email) }),
      }),
    )
    expect(res.status).toBe(200)
    const setCookies = res.headers.getSetCookie()
    const cookieHeader = setCookies.map((c) => c.split(';')[0] ?? '').join('; ')
    return { setCookies, cookieHeader }
  }

  return { auth, memory, signIn }
}

function parseMaxAge(cookies: readonly string[]): number | null {
  for (const cookie of cookies) {
    const m = /max-age=(\d+)/i.exec(cookie)
    if (m?.[1]) return Number(m[1])
  }
  return null
}

function dateMs(v: unknown): number {
  return v instanceof Date ? v.getTime() : new Date(String(v)).getTime()
}

describe('30 天滑动会话留存策略', () => {
  it('策略常量固定为 30 天有效期 / 24 小时续期间隔', () => {
    expect(SESSION_EXPIRES_IN_SECONDS).toBe(30 * 24 * 60 * 60)
    expect(SESSION_UPDATE_AGE_SECONDS).toBe(24 * 60 * 60)
  })

  it('登录时签发 30 天 Max-Age Cookie 且数据库 expiresAt 为 30 天后', async () => {
    const { memory, signIn } = createHarness()
    const before = Date.now()
    const { setCookies } = await signIn('active@example.com')

    expect(parseMaxAge(setCookies)).toBe(SESSION_EXPIRES_IN_SECONDS)
    const row = memory.session?.[0]
    expect(row).toBeDefined()
    const expiresAt = dateMs(row?.expiresAt)
    const deltaSeconds = Math.round((expiresAt - before) / 1000)
    expect(deltaSeconds).toBeGreaterThanOrEqual(SESSION_EXPIRES_IN_SECONDS - 5)
    expect(deltaSeconds).toBeLessThanOrEqual(SESSION_EXPIRES_IN_SECONDS + 5)
  })

  it('RSC disableRefresh=true 不抢先写库，随后 API returnHeaders=true 正常推进 DB 并下发续期 Cookie', async () => {
    const { auth, memory, signIn } = createHarness()
    const { cookieHeader } = await signIn('sliding@example.com')
    const row = memory.session?.[0]
    expect(row).toBeDefined()

    // 模拟已过 2 天（超过 updateAge=1 天）：expiresAt 仅剩 28 天
    const staleExpiry = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000)
    if (row) row.expiresAt = staleExpiry

    const headers = new Headers({ cookie: cookieHeader })

    // 1. RSC 只读路径：不刷新 DB
    const rsc = await auth.api.getSession({ headers, query: { disableRefresh: true } })
    expect(rsc?.user.email).toBe('sliding@example.com')
    expect(dateMs(row?.expiresAt)).toBe(staleExpiry.getTime())

    // 2. 紧随其后的 Hono /api/v1 路径：推进 DB expiresAt 并产出新 Set-Cookie
    const apiResult = await auth.api.getSession({ headers, returnHeaders: true })
    expect(apiResult.response?.user.email).toBe('sliding@example.com')
    const renewedExpiry = dateMs(row?.expiresAt)
    expect(renewedExpiry).toBeGreaterThan(staleExpiry.getTime() + 24 * 60 * 60 * 1000)

    const renewedCookies = apiResult.headers.getSetCookie()
    expect(renewedCookies.length).toBeGreaterThan(0)
    expect(parseMaxAge(renewedCookies)).toBe(SESSION_EXPIRES_IN_SECONDS)
  })

  it('存量 7 天老会话在首次 API 活跃时平滑续期至 30 天', async () => {
    const { auth, memory, signIn } = createHarness()
    const { cookieHeader } = await signIn('legacy@example.com')
    const row = memory.session?.[0]
    expect(row).toBeDefined()

    // 模拟老 7 天会话只剩 5 天
    const legacyExpiry = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    if (row) row.expiresAt = legacyExpiry

    const apiResult = await auth.api.getSession({
      headers: new Headers({ cookie: cookieHeader }),
      returnHeaders: true,
    })
    expect(apiResult.response?.user.email).toBe('legacy@example.com')
    const upgradedDeltaSec = Math.round((dateMs(row?.expiresAt) - Date.now()) / 1000)
    expect(upgradedDeltaSec).toBeGreaterThanOrEqual(SESSION_EXPIRES_IN_SECONDS - 5)
    expect(parseMaxAge(apiResult.headers.getSetCookie())).toBe(SESSION_EXPIRES_IN_SECONDS)
  })

  it('已过期会话返回 null 并生成 Max-Age=0 清理头', async () => {
    const { auth, memory, signIn } = createHarness()
    const { cookieHeader } = await signIn('expired@example.com')
    const row = memory.session?.[0]
    if (row) row.expiresAt = new Date(Date.now() - 60_000)

    const apiResult = await auth.api.getSession({
      headers: new Headers({ cookie: cookieHeader }),
      returnHeaders: true,
    })
    expect(apiResult.response).toBeNull()
    expect(parseMaxAge(apiResult.headers.getSetCookie())).toBe(0)
  })
})
