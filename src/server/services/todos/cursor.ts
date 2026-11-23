import 'server-only'

/*
 * 待办游标编解码（api-conventions.md 第 10 节）：
 * - TimeCursor：按 (timestamp DESC, id DESC) 翻页，用于已完成 / 已放弃 / 已归档 / 四象限 / 过程时间轴。
 * - OpenCursor：按 (sortOrder ASC, dueAt ASC NULLS LAST, createdAt ASC, id ASC) 翻页，用于分组内进行中与已过期。
 * 客户端不解析、不拼接不透明游标字符串。
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface TimeCursor {
  at: string
  id: string
}

export function encodeTimeCursor(c: TimeCursor): string {
  return Buffer.from(JSON.stringify({ t: c.at, i: c.id }), 'utf8').toString('base64url')
}

export function decodeTimeCursor(raw: string): TimeCursor | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const { t, d, i } = parsed as { t?: unknown; d?: unknown; i?: unknown }
  const ts = typeof t === 'string' ? t : typeof d === 'string' ? d : null
  if (ts === null || typeof i !== 'string' || !UUID_RE.test(i)) return null
  const time = new Date(ts)
  if (Number.isNaN(time.getTime())) return null
  return { at: time.toISOString(), id: i }
}

/** 向后兼容旧版已完成游标接口与测试 */
export interface DoneCursor {
  doneAt: string
  id: string
}

export function encodeDoneCursor(c: DoneCursor): string {
  return Buffer.from(JSON.stringify({ d: c.doneAt, i: c.id }), 'utf8').toString('base64url')
}

export function decodeDoneCursor(raw: string): DoneCursor | null {
  const decoded = decodeTimeCursor(raw)
  return decoded ? { doneAt: decoded.at, id: decoded.id } : null
}

export interface OpenCursor {
  sortOrder: number
  dueAt: string | null
  createdAt: string
  id: string
}

export function encodeOpenCursor(c: OpenCursor): string {
  return Buffer.from(
    JSON.stringify({ o: c.sortOrder, d: c.dueAt, c: c.createdAt, i: c.id }),
    'utf8',
  ).toString('base64url')
}

export function decodeOpenCursor(raw: string): OpenCursor | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const { o, d, c, i } = parsed as { o?: unknown; d?: unknown; c?: unknown; i?: unknown }
  if (
    typeof o !== 'number' ||
    !Number.isInteger(o) ||
    (d !== null && typeof d !== 'string') ||
    typeof c !== 'string' ||
    typeof i !== 'string' ||
    !UUID_RE.test(i)
  ) {
    return null
  }
  let dueIso: string | null = null
  if (d !== null) {
    const dt = new Date(d)
    if (Number.isNaN(dt.getTime())) return null
    dueIso = dt.toISOString()
  }
  const ct = new Date(c)
  if (Number.isNaN(ct.getTime())) return null
  return { sortOrder: o, dueAt: dueIso, createdAt: ct.toISOString(), id: i }
}
