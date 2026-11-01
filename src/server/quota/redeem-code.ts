import 'server-only'
import { sha256Hex } from '@/server/crypto'

/*
 * 兑换码的唯一实现（PRD 7.3）。签名 F1，实现 P1（带单测）；D6、D7 只调用。
 * 字符表去掉易混字符；格式 DDON-XXXX-XXXX-XXXX；库里只存 SHA-256。
 */

export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const CODE_PREFIX = 'DDON'
/** DDON 之后的随机字符数（三组各 4 个） */
export const CODE_BODY_LENGTH = 12
/** 面值 10 元 */
export const CODE_VALUE_MICROS = 10_000_000

const GROUP = 4

/** 生成一个明文码（crypto 随机，拒绝采样避免取模偏差） */
export function generateCode(): string {
  const n = CODE_ALPHABET.length
  // 256 以内 n 的最大整数倍；超过它的字节丢弃重抽
  const limit = 256 - (256 % n)
  const chars: string[] = []
  while (chars.length < CODE_BODY_LENGTH) {
    const buf = crypto.getRandomValues(new Uint8Array(CODE_BODY_LENGTH * 2))
    for (const byte of buf) {
      if (byte >= limit) continue
      chars.push(CODE_ALPHABET.charAt(byte % n))
      if (chars.length === CODE_BODY_LENGTH) break
    }
  }
  const groups: string[] = []
  for (let i = 0; i < CODE_BODY_LENGTH; i += GROUP) groups.push(chars.slice(i, i + GROUP).join(''))
  return [CODE_PREFIX, ...groups].join('-')
}

/**
 * 规范化用户输入：转大写、去空白和横线，校验长度与字符表。
 * 返回不带横线的规范形式（如 'DDONABCD…'）；不合法返回 null。
 */
export function normalizeCode(input: string): string | null {
  const compact = input.toUpperCase().replace(/[\s\-‐-―－]/g, '')
  if (compact.length !== CODE_PREFIX.length + CODE_BODY_LENGTH) return null
  if (!compact.startsWith(CODE_PREFIX)) return null
  const body = compact.slice(CODE_PREFIX.length)
  for (const ch of body) if (!CODE_ALPHABET.includes(ch)) return null
  return compact
}

/** 规范形式的 SHA-256 十六进制 */
export async function hashCode(normalized: string): Promise<string> {
  return sha256Hex(normalized)
}

/** 后台列表显示的前缀，如 'DDON-AB12' */
export function codePrefix(normalized: string): string {
  return `${CODE_PREFIX}-${normalized.slice(CODE_PREFIX.length, CODE_PREFIX.length + GROUP)}`
}
