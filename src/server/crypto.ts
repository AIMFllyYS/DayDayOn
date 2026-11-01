import 'server-only'

/*
 * 服务端共用的摘要工具（P1）。只用 Web Crypto（Node 24 全局 crypto），不引入依赖。
 */

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** UTF-8 字符串的 SHA-256 十六进制摘要 */
export async function sha256Hex(input: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)))
}

/** HMAC-SHA-256 十六进制摘要（注销记录的邮箱摘要：没有密钥就不能用邮箱字典反查） */
export async function hmacSha256Hex(secret: string, input: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(input)))
}

/** 字节的 SHA-256 十六进制摘要（幂等摘要里的 multipart 请求体） */
export async function sha256HexBytes(input: ArrayBuffer): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', input))
}
