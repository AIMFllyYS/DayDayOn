/*
 * 客户端 IP（api-conventions.md 第 8 节）：只取 Nginx 写入的 x-real-ip，不读 x-forwarded-for。
 * 本地开发没有这个头时记为 127.0.0.1。Hono 中间件与 Better Auth hooks 共用。
 */

export const LOCAL_IP = '127.0.0.1'

export function clientIp(headers: Headers | null | undefined): string {
  const raw = headers?.get('x-real-ip')?.trim()
  return raw && raw.length > 0 && raw.length <= 64 ? raw : LOCAL_IP
}
