import { describe, expect, it } from 'vitest'
import { ALLOWED_EMAIL_DOMAINS, checkEmail, isAllowedDomain, normalizeEmail } from './email-policy'

describe('normalizeEmail', () => {
  it('转小写并去首尾空白', () => {
    expect(normalizeEmail('  Alice@QQ.com \n')).toEqual({ ok: true, email: 'alice@qq.com' })
  })

  it('本地部分含 + 的地址拒绝', () => {
    expect(normalizeEmail('a+1@gmail.com')).toEqual({ ok: false, reason: 'plus-address' })
    expect(normalizeEmail('a+@163.com')).toEqual({ ok: false, reason: 'plus-address' })
  })

  it('Gmail 去掉本地部分的点号', () => {
    expect(normalizeEmail('A.B.c@Gmail.com')).toEqual({ ok: true, email: 'abc@gmail.com' })
  })

  it('非 Gmail 保留点号', () => {
    expect(normalizeEmail('a.b@outlook.com')).toEqual({ ok: true, email: 'a.b@outlook.com' })
  })

  it('Gmail 本地部分只有点号时不合法', () => {
    expect(normalizeEmail('...@gmail.com')).toEqual({ ok: false, reason: 'invalid' })
  })

  it('形状不对的输入不合法', () => {
    for (const bad of ['', 'abc', 'a@b', '@qq.com', 'a b@qq.com', 'a@@qq.com']) {
      expect(normalizeEmail(bad)).toEqual({ ok: false, reason: 'invalid' })
    }
  })
})

describe('checkEmail', () => {
  it('白名单内的 11 个域名都通过', () => {
    expect(ALLOWED_EMAIL_DOMAINS).toHaveLength(11)
    for (const domain of ALLOWED_EMAIL_DOMAINS) {
      expect(checkEmail(`user@${domain}`)).toEqual({ ok: true, email: `user@${domain}` })
    }
  })

  it('白名单外的域名拒绝', () => {
    expect(checkEmail('user@example.com')).toEqual({ ok: false, reason: 'domain-not-allowed' })
    expect(checkEmail('user@sina.com')).toEqual({ ok: false, reason: 'domain-not-allowed' })
  })

  it('子域名不算白名单（mail.qq.com）', () => {
    expect(checkEmail('user@mail.qq.com')).toEqual({ ok: false, reason: 'domain-not-allowed' })
    expect(isAllowedDomain('user@cs.hust.edu.cn')).toBe(false)
  })

  it('大小写与空白不影响白名单判断', () => {
    expect(checkEmail(' User@HUST.edu.cn ')).toEqual({ ok: true, email: 'user@hust.edu.cn' })
  })

  it('+ 地址在白名单域名下也拒绝', () => {
    expect(checkEmail('user+x@qq.com')).toEqual({ ok: false, reason: 'plus-address' })
  })
})
