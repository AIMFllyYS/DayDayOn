import { describe, expect, it } from 'vitest'
import { groupSecret, parseTotpUri } from './totp'

describe('parseTotpUri', () => {
  it('取出密钥、账号和签发方', () => {
    const r = parseTotpUri(
      'otpauth://totp/DayDayOn:admin%40qq.com?secret=JBSWY3DPEHPK3PXP&issuer=DayDayOn&digits=6&period=30',
    )
    expect(r).toEqual({ secret: 'JBSWY3DPEHPK3PXP', account: 'admin@qq.com', issuer: 'DayDayOn' })
  })

  it('没有 issuer 参数时用标签里的前缀', () => {
    const r = parseTotpUri('otpauth://totp/DayDayOn:a%40b.com?secret=jbswy3dp')
    expect(r).toEqual({ secret: 'JBSWY3DP', account: 'a@b.com', issuer: 'DayDayOn' })
  })

  it('标签没有前缀', () => {
    expect(parseTotpUri('otpauth://totp/a%40b.com?secret=JBSWY3DP')?.account).toBe('a@b.com')
  })

  it('不合法的输入返回 null', () => {
    expect(parseTotpUri('not a url')).toBeNull()
    expect(parseTotpUri('https://example.com/?secret=JBSWY3DP')).toBeNull()
    expect(parseTotpUri('otpauth://hotp/x?secret=JBSWY3DP')).toBeNull()
    expect(parseTotpUri('otpauth://totp/x')).toBeNull()
    expect(parseTotpUri('otpauth://totp/x?secret=not-base32!')).toBeNull()
  })
})

describe('groupSecret', () => {
  it('每 4 个一组', () => {
    expect(groupSecret('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP')
    expect(groupSecret('ABCDEF')).toBe('ABCD EF')
    expect(groupSecret('ABCD')).toBe('ABCD')
  })
})
