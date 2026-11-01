import { describe, expect, it } from 'vitest'
import {
  CODE_ALPHABET,
  CODE_BODY_LENGTH,
  codePrefix,
  generateCode,
  hashCode,
  normalizeCode,
} from './redeem-code'

describe('generateCode', () => {
  it('格式为 DDON-XXXX-XXXX-XXXX，只含字符表里的字符', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode()
      expect(code).toMatch(/^DDON-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/)
      const body = code.slice(5).replaceAll('-', '')
      expect(body).toHaveLength(CODE_BODY_LENGTH)
      for (const ch of body) expect(CODE_ALPHABET).toContain(ch)
    }
  })

  it('字符表不含易混字符 0 O 1 I L', () => {
    for (const ch of ['0', 'O', '1', 'I', 'L']) expect(CODE_ALPHABET).not.toContain(ch)
  })

  it('生成的码彼此不同', () => {
    const set = new Set(Array.from({ length: 500 }, () => generateCode()))
    expect(set.size).toBe(500)
  })

  it('生成的码能被 normalizeCode 接受', () => {
    const code = generateCode()
    expect(normalizeCode(code)).toBe(code.replaceAll('-', ''))
  })
})

describe('normalizeCode', () => {
  it('转大写、去空白和横线', () => {
    expect(normalizeCode(' ddon-abcd-efgh-jkmn ')).toBe('DDONABCDEFGHJKMN')
    expect(normalizeCode('DDON ABCD EFGH JKMN')).toBe('DDONABCDEFGHJKMN')
    expect(normalizeCode('DDONABCDEFGHJKMN')).toBe('DDONABCDEFGHJKMN')
  })

  it('全角横线也去掉', () => {
    expect(normalizeCode('DDON－ABCD－EFGH－JKMN')).toBe('DDONABCDEFGHJKMN')
  })

  it('长度不对返回 null', () => {
    expect(normalizeCode('DDON-ABCD-EFGH')).toBeNull()
    expect(normalizeCode('DDON-ABCD-EFGH-JKMNP')).toBeNull()
    expect(normalizeCode('')).toBeNull()
  })

  it('前缀不对返回 null', () => {
    expect(normalizeCode('XDON-ABCD-EFGH-JKMN')).toBeNull()
  })

  it('含字符表外的字符返回 null', () => {
    expect(normalizeCode('DDON-ABCD-EFGH-JKM0')).toBeNull()
    expect(normalizeCode('DDON-ABCD-EFGH-JKMI')).toBeNull()
    expect(normalizeCode('DDON-ABCD-EFGH-JK#M')).toBeNull()
  })
})

describe('hashCode', () => {
  it('SHA-256 十六进制，规范化后相同的输入摘要相同', async () => {
    const a = normalizeCode('ddon-abcd-efgh-jkmn')
    const b = normalizeCode('DDON ABCD EFGH JKMN')
    expect(a).not.toBeNull()
    const ha = await hashCode(a ?? '')
    expect(ha).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashCode(b ?? '')).toBe(ha)
  })

  it('已知向量', async () => {
    // echo -n abc | sha256sum
    expect(await hashCode('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})

describe('codePrefix', () => {
  it('取前缀和第一组', () => {
    expect(codePrefix('DDONAB23EFGHJKMN')).toBe('DDON-AB23')
  })
})
