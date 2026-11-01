import 'server-only'

/*
 * 已完成待办的游标（api-conventions.md 第 10 节）：按 (doneAt desc, id desc) 翻页。
 * 不透明字符串 = base64url(JSON { d: doneAt ISO, i: id })；客户端不解析、不拼。
 */

export interface DoneCursor {
  doneAt: string
  id: string
}

export function encodeDoneCursor(c: DoneCursor): string {
  return Buffer.from(JSON.stringify({ d: c.doneAt, i: c.id }), 'utf8').toString('base64url')
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 解析失败返回 null（调用方转成 400 VALIDATION_FAILED） */
export function decodeDoneCursor(raw: string): DoneCursor | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const { d, i } = parsed as { d?: unknown; i?: unknown }
  if (typeof d !== 'string' || typeof i !== 'string' || !UUID_RE.test(i)) return null
  const time = new Date(d)
  if (Number.isNaN(time.getTime())) return null
  return { doneAt: time.toISOString(), id: i }
}
