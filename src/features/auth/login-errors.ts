import { errorMessage, errorMessages, FALLBACK_MESSAGE } from '@/lib/api/error-messages'

/*
 * 登录页的错误归一（PRD 2.1、7.1）。纯函数，带单测。
 * /api/auth/* 的错误体有两种来源：
 * - 本项目 hooks 抛的（EMAIL_DOMAIN_NOT_ALLOWED、RATE_LIMITED、ACCOUNT_BANNED…）：与 /api/v1 同一套 code，文案走 error-messages.ts；
 * - Better Auth 自己的（INVALID_OTP、OTP_EXPIRED…，内置限流只有 429 没有 code）：这里补一份文案。
 *   这几条应当并进 error-messages.ts（已写进 sharedChangeRequests），并入后本表只留映射。
 */

/** authClient 返回的 error：better-fetch 把响应体展开后再加上 status */
export interface AuthClientError {
  code?: string
  message?: string
  status?: number
  ban?: { reason: string | null; expiresAt: string | null }
  retryAfterSeconds?: number
}

const BETTER_AUTH_MESSAGES: Record<string, string> = {
  INVALID_OTP: '验证码不对，再看一眼邮件',
  OTP_EXPIRED: '验证码过期了，重新发一个吧',
  TOO_MANY_ATTEMPTS: '输错太多次，这个验证码作废了，重新发一个吧',
  INVALID_CODE: '身份验证器上的码不对，再试一次',
  INVALID_TWO_FACTOR_COOKIE: '验证超时了，重新登录一下吧',
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: '输错太多次了，重新登录一下吧',
  ACCOUNT_TEMPORARILY_LOCKED: '尝试次数太多，过一会儿再来',
  BANNED_USER: '账号已被停用',
}

export interface LoginError {
  code: string
  message: string
}

export function toLoginError(error: AuthClientError | null | undefined): LoginError {
  if (!error) return { code: 'INTERNAL', message: FALLBACK_MESSAGE }
  const code = error.code ?? (error.status === 429 ? 'RATE_LIMITED' : 'INTERNAL')
  if (code in errorMessages) {
    return { code, message: errorMessage({ ...error, code }) }
  }
  return { code, message: BETTER_AUTH_MESSAGES[code] ?? FALLBACK_MESSAGE }
}

/** 这些错误说明当前验证码已经不能再用，界面应当回到"重新发送" */
export function otpIsDead(code: string): boolean {
  return code === 'OTP_EXPIRED' || code === 'TOO_MANY_ATTEMPTS'
}

/**
 * 登录后的回跳地址：只接受站内相对路径，防止 ?next=https://evil.example 这类开放重定向。
 * 不回到登录、引导页本身。
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/'
  if (/^\/(login|onboarding)(\/|\?|$)/.test(next)) return '/'
  return next
}
