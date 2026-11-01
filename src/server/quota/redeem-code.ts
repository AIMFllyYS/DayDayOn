import 'server-only'

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

/** 生成一个明文码（crypto 随机）。实现：P1 */
export function generateCode(): string {
  throw new Error('not implemented: P1')
}

/**
 * 规范化用户输入：转大写、去空白和横线，校验长度与字符表。
 * 返回不带横线的规范形式（如 'DDONABCD…'）；不合法返回 null。实现：P1
 */
export function normalizeCode(input: string): string | null {
  void input
  throw new Error('not implemented: P1')
}

/** 规范形式的 SHA-256 十六进制。实现：P1 */
export async function hashCode(normalized: string): Promise<string> {
  void normalized
  throw new Error('not implemented: P1')
}

/** 后台列表显示的前缀，如 'DDON-AB12'。实现：P1 */
export function codePrefix(normalized: string): string {
  void normalized
  throw new Error('not implemented: P1')
}
