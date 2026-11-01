import 'server-only'
import { APIError } from 'better-auth/api'
import { env } from '@/server/env'
import { LOCAL_IP } from './ip'

/*
 * Cloudflare Turnstile 服务端校验（ADR-0023、auth.md 第 3 节）。
 * 在 hooks.before 的发送验证码端点（/email-otp/send-verification-otp）最前面调用：
 * 校验未通过时不消耗后续的邮箱 60s 冷却或每日限流计数。
 *
 * 请求头约定与 Better Auth 官方 captcha 插件一致：`x-captcha-response`。
 */

export const CAPTCHA_HEADER = 'x-captcha-response'
export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
/** Cloudflare 官方测试 Secret Key（总是通过，仅在未配置 TURNSTILE_SECRET_KEY 时回退） */
export const TURNSTILE_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA'
const VERIFY_TIMEOUT_MS = 10_000

interface SiteVerifyResponse {
  success?: boolean
  'error-codes'?: string[]
  action?: string
  hostname?: string
}

export interface VerifyTurnstileOptions {
  token: string | null | undefined
  secretKey: string
  remoteIp?: string
  expectedAction?: string
  fetchFn?: typeof fetch
}

export interface VerifyTurnstileResult {
  ok: boolean
  code?: 'MISSING_RESPONSE' | 'VERIFICATION_FAILED'
  errorCodes?: string[]
}

/** 纯校验逻辑（可注入 fetchFn 做单元测试） */
export async function verifyTurnstileToken({
  token,
  secretKey,
  remoteIp,
  expectedAction,
  fetchFn = fetch,
}: VerifyTurnstileOptions): Promise<VerifyTurnstileResult> {
  const trimmed = token?.trim()
  if (!trimmed) {
    return { ok: false, code: 'MISSING_RESPONSE' }
  }

  try {
    const body: Record<string, string> = {
      secret: secretKey,
      response: trimmed,
    }
    if (remoteIp && remoteIp !== LOCAL_IP) {
      body.remoteip = remoteIp
    }

    const res = await fetchFn(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    })

    if (!res.ok) {
      return { ok: false, code: 'VERIFICATION_FAILED', errorCodes: [`http-${res.status}`] }
    }

    const data = (await res.json()) as SiteVerifyResponse
    if (!data.success) {
      return {
        ok: false,
        code: 'VERIFICATION_FAILED',
        errorCodes: data['error-codes'] ?? ['siteverify-rejected'],
      }
    }

    if (expectedAction && data.action && data.action !== expectedAction) {
      return {
        ok: false,
        code: 'VERIFICATION_FAILED',
        errorCodes: ['action-mismatch'],
      }
    }

    return { ok: true }
  } catch (error) {
    // 非生产环境且使用官方测试密钥时，若本机断网无法连接 Cloudflare，放行官方 DUMMY token
    if (
      process.env.NODE_ENV !== 'production' &&
      secretKey === TURNSTILE_TEST_SECRET_KEY &&
      trimmed.includes('DUMMY.TOKEN')
    ) {
      return { ok: true }
    }
    console.warn(
      '[auth] Turnstile 校验请求异常',
      error instanceof Error ? error.message : String(error),
    )
    return { ok: false, code: 'VERIFICATION_FAILED', errorCodes: ['network-error'] }
  }
}

/** 在 Better Auth hooks.before 中调用：校验不通过直接抛 APIError */
export async function enforceTurnstile(
  headers: Headers | null | undefined,
  remoteIp: string,
): Promise<void> {
  const token = headers?.get(CAPTCHA_HEADER)
  // 单元测试环境未配置密钥且未传请求头时跳过，避免纯接口测试依赖外部网络
  if (env.NODE_ENV === 'test' && !env.TURNSTILE_SECRET_KEY && !token) {
    return
  }

  const secretKey = env.TURNSTILE_SECRET_KEY ?? TURNSTILE_TEST_SECRET_KEY
  const result = await verifyTurnstileToken({
    token,
    secretKey,
    remoteIp,
    expectedAction: 'send-otp',
  })

  if (!result.ok) {
    if (result.code === 'MISSING_RESPONSE') {
      throw new APIError('BAD_REQUEST', {
        code: 'MISSING_RESPONSE',
        message: '请先完成人机验证',
      })
    }
    throw new APIError('FORBIDDEN', {
      code: 'VERIFICATION_FAILED',
      message: '人机验证未通过，刷新后再试一次吧',
    })
  }
}
