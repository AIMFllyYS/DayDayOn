import { createHmac } from 'node:crypto'
import { betterAuth } from 'better-auth'
import { memoryAdapter } from 'better-auth/adapters/memory'
import { admin, emailOTP } from 'better-auth/plugins'
import { beforeEach, describe, expect, it } from 'vitest'
import { classifyAuthPath, twoFactorPlugins } from './two-factor-gate'

/*
 * 管理员两步验证门禁：用真实的 Better Auth 实例（内存适配器）走完整的 hook 流水线。
 * 复现过的漏洞：/sign-in/email-otp 不触发 twoFactor 插件的 after-hook，开了两步验证的管理员只凭邮箱验证码就拿到会话。
 */

const BASE = 'http://localhost:23329'

/** RFC 6238 TOTP（SHA-1、6 位、30 秒），只给测试算验证码 */
function totp(base32Secret: string, now = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const ch of base32Secret.replace(/=+$/, '')) {
    bits += alphabet.indexOf(ch).toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)))
  const mac = createHmac('sha1', Buffer.from(bytes)).update(counter).digest()
  const offset = (mac[mac.length - 1] ?? 0) & 0xf
  const code = (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return String(code).padStart(6, '0')
}

type Row = Record<string, unknown>

function setup() {
  const memory: Record<string, Row[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
    twoFactor: [],
    rateLimit: [],
  }
  const otps = new Map<string, string>()
  const auth = betterAuth({
    baseURL: BASE,
    secret: 'test-secret-test-secret-test-secret-123',
    database: memoryAdapter(memory),
    emailAndPassword: { enabled: false },
    telemetry: { enabled: false },
    rateLimit: { enabled: false },
    plugins: [
      emailOTP({
        async sendVerificationOTP({ email, otp }) {
          otps.set(email, otp)
        },
      }),
      admin(),
      ...twoFactorPlugins(),
    ],
  })

  /** 一个浏览器：自己的 cookie jar */
  function browser() {
    const jar = new Map<string, string>()
    async function call(path: string, body?: unknown) {
      const headers = new Headers({ origin: BASE })
      if (body !== undefined) headers.set('content-type', 'application/json')
      if (jar.size > 0) {
        headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '))
      }
      const res = await auth.handler(
        new Request(`${BASE}/api/auth${path}`, {
          method: body === undefined ? 'GET' : 'POST',
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      )
      for (const c of res.headers.getSetCookie()) {
        const [pair = ''] = c.split(';')
        const eq = pair.indexOf('=')
        const name = pair.slice(0, eq)
        const value = pair.slice(eq + 1)
        if (value === '' || /max-age=0/i.test(c)) jar.delete(name)
        else jar.set(name, value)
      }
      const text = await res.text()
      return { status: res.status, json: (text ? JSON.parse(text) : null) as Row | null }
    }
    async function login(email: string) {
      await call('/email-otp/send-verification-otp', { email, type: 'sign-in' })
      return call('/sign-in/email-otp', { email, otp: otps.get(email) })
    }
    async function session() {
      return (await call('/get-session')).json
    }
    return { call, login, session }
  }

  function makeAdmin(email: string) {
    const row = memory.user?.find((u) => u.email === email)
    if (!row) throw new Error('用户不存在')
    row.role = 'admin'
  }

  /** 登录、设为管理员、绑定两步验证；返回 TOTP 密钥 */
  async function enrolledAdmin(email: string) {
    const b = browser()
    await b.login(email)
    makeAdmin(email)
    const enabled = await b.call('/two-factor/enable', {})
    const uri = new URL(String(enabled.json?.totpURI))
    const secret = uri.searchParams.get('secret') ?? ''
    const verified = await b.call('/two-factor/verify-totp', { code: totp(secret) })
    expect(verified.status).toBe(200)
    return { secret, browser: b }
  }

  return { auth, memory, browser, makeAdmin, enrolledAdmin }
}

let t: ReturnType<typeof setup>
beforeEach(() => {
  t = setup()
})

describe('验证码登录的两步验证', () => {
  it('普通用户：验证码登录直接拿到会话', async () => {
    const b = t.browser()
    const res = await b.login('a@qq.com')
    expect(res.status).toBe(200)
    expect(res.json?.twoFactorRedirect).toBeUndefined()
    expect((await b.session())?.user).toMatchObject({ email: 'a@qq.com' })
  })

  it('开了两步验证的管理员：验证码登录不给会话，返回 twoFactorRedirect', async () => {
    await t.enrolledAdmin('boss@qq.com')
    const b = t.browser()
    const res = await b.login('boss@qq.com')
    expect(res.status).toBe(200)
    expect(res.json?.twoFactorRedirect).toBe(true)
    expect(await b.session()).toBeNull()
    // 被删掉的会话不留在库里
    const userId = t.memory.user?.find((u) => u.email === 'boss@qq.com')?.id
    const sessions = t.memory.session?.filter((s) => s.userId === userId) ?? []
    expect(sessions).toHaveLength(1)
  })

  it('再输身份验证器的 6 位码才拿到会话', async () => {
    const { secret } = await t.enrolledAdmin('boss@qq.com')
    const b = t.browser()
    await b.login('boss@qq.com')
    const wrong = await b.call('/two-factor/verify-totp', { code: '000000' })
    expect(wrong.status).toBe(401)
    const ok = await b.call('/two-factor/verify-totp', { code: totp(secret) })
    expect(ok.status).toBe(200)
    expect((await b.session())?.user).toMatchObject({ email: 'boss@qq.com', role: 'admin' })
  })

  it('绑定两步验证后，绑定前在别处登录、没过两步验证的会话被吊销', async () => {
    const other = t.browser()
    await other.login('boss@qq.com')
    t.makeAdmin('boss@qq.com')
    expect(await other.session()).not.toBeNull()
    await t.enrolledAdmin('boss@qq.com')
    expect(await other.session()).toBeNull()
  })

  it('关闭两步验证的端点不开放', async () => {
    const { browser: b } = await t.enrolledAdmin('boss@qq.com')
    const res = await b.call('/two-factor/disable', {})
    expect(res.status).toBe(403)
    expect(t.memory.user?.find((u) => u.email === 'boss@qq.com')?.twoFactorEnabled).toBe(true)
  })
})

describe('admin 插件端点', () => {
  async function victimId() {
    await t.browser().login('victim@qq.com')
    return String(t.memory.user?.find((u) => u.email === 'victim@qq.com')?.id)
  }

  it('开了两步验证的管理员可以封号', async () => {
    const userId = await victimId()
    const { browser: b } = await t.enrolledAdmin('boss@qq.com')
    const res = await b.call('/admin/ban-user', { userId, banReason: '刷额度' })
    expect(res.status).toBe(200)
    expect(t.memory.user?.find((u) => u.id === userId)?.banned).toBe(true)
  })

  it('没开两步验证的管理员：403 TWO_FACTOR_REQUIRED', async () => {
    const userId = await victimId()
    const b = t.browser()
    await b.login('boss@qq.com')
    t.makeAdmin('boss@qq.com')
    const res = await b.call('/admin/ban-user', { userId, banReason: 'x' })
    expect(res.status).toBe(403)
    expect(res.json?.code).toBe('TWO_FACTOR_REQUIRED')
    expect(t.memory.user?.find((u) => u.id === userId)?.banned).not.toBe(true)
  })

  it.each([
    ['/admin/impersonate-user', (userId: string) => ({ userId })],
    ['/admin/set-role', (userId: string) => ({ userId, role: 'admin' })],
    ['/admin/update-user', (userId: string) => ({ userId, data: { role: 'admin' } })],
    ['/admin/remove-user', (userId: string) => ({ userId })],
  ])('%s 即使是开了两步验证的管理员也拒绝', async (path, body) => {
    const userId = await victimId()
    const { browser: b } = await t.enrolledAdmin('boss@qq.com')
    const res = await b.call(path, body(userId))
    expect(res.status).toBe(403)
    const victim = t.memory.user?.find((u) => u.id === userId)
    expect(victim?.role).not.toBe('admin')
  })
})

describe('classifyAuthPath', () => {
  it('封号 / 解封 / 吊销会话放行，其余 admin 端点拒绝', () => {
    expect(classifyAuthPath('/admin/ban-user')).toBe('allowed')
    expect(classifyAuthPath('/admin/unban-user')).toBe('allowed')
    expect(classifyAuthPath('/admin/revoke-user-sessions')).toBe('allowed')
    expect(classifyAuthPath('/admin/impersonate-user')).toBe('blocked')
    expect(classifyAuthPath('/admin/list-users')).toBe('blocked')
    expect(classifyAuthPath('/two-factor/disable')).toBe('blocked')
    expect(classifyAuthPath('/sign-in/email-otp')).toBe('not-admin')
  })
})
