import { describe, expect, it } from 'vitest'
import { otpIsDead, safeNextPath, toLoginError } from './login-errors'

describe('toLoginError', () => {
  it('本项目的 code 用 error-messages.ts 的文案', () => {
    expect(toLoginError({ code: 'EMAIL_DOMAIN_NOT_ALLOWED', status: 400 }).message).toContain(
      '华科邮箱',
    )
  })

  it('封号带原因', () => {
    const e = toLoginError({
      code: 'ACCOUNT_BANNED',
      status: 403,
      ban: { reason: '刷额度', expiresAt: null },
    })
    expect(e.message).toBe('账号已被停用，原因：刷额度')
  })

  it('Better Auth 内置限流只有 429，没有 code：按 RATE_LIMITED', () => {
    const e = toLoginError({ status: 429, message: 'Too many requests.' })
    expect(e.code).toBe('RATE_LIMITED')
    expect(e.message).toContain('太频繁了')
  })

  it('Better Auth 自己的验证码错误有中文文案', () => {
    expect(toLoginError({ code: 'INVALID_OTP', status: 400 }).message).toBe(
      '验证码不对，再看一眼邮件',
    )
  })

  it('未知 code 用兜底文案', () => {
    expect(toLoginError({ code: 'WHATEVER' }).message).toBe('出了点小状况，稍后再试试')
    expect(toLoginError(null).code).toBe('INTERNAL')
  })
})

describe('otpIsDead', () => {
  it('过期、输错太多次时需要重新发送', () => {
    expect(otpIsDead('OTP_EXPIRED')).toBe(true)
    expect(otpIsDead('TOO_MANY_ATTEMPTS')).toBe(true)
    expect(otpIsDead('INVALID_OTP')).toBe(false)
  })
})

describe('safeNextPath', () => {
  it('站内路径原样返回', () => {
    expect(safeNextPath('/goals/abc?x=1')).toBe('/goals/abc?x=1')
  })

  it('外站、协议相对地址、反斜杠一律回到主页', () => {
    expect(safeNextPath('https://evil.example')).toBe('/')
    expect(safeNextPath('//evil.example')).toBe('/')
    expect(safeNextPath('/\\evil.example')).toBe('/')
    expect(safeNextPath(null)).toBe('/')
  })

  it('不回到登录页、引导页', () => {
    expect(safeNextPath('/login')).toBe('/')
    expect(safeNextPath('/onboarding?x=1')).toBe('/')
    expect(safeNextPath('/loginx')).toBe('/loginx')
  })
})
