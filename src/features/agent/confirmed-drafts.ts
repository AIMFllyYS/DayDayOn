/*
 * Agent 草稿卡确认态持久化与确定性 UUID 幂等键：
 * 解决关闭悬浮弹窗、切换全屏 /agent、切换历史会话或刷新页面后草稿确认态丢失导致重复提交的隐患。
 * 纯客户端安全读/写（SSR / 隐私模式静默降级）。
 */

const STORAGE_KEY = 'daydayon:confirmed-drafts:v1'
const MAX_STORED = 200

const memoryConfirmed = new Set<string>()

function readStoredIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x): x is string => typeof x === 'string' && x.length > 0)
      .slice(-MAX_STORED)
  } catch {
    return []
  }
}

export function isDraftConfirmed(toolCallId: string | undefined): boolean {
  if (!toolCallId) return false
  if (memoryConfirmed.has(toolCallId)) return true
  const stored = readStoredIds()
  if (stored.includes(toolCallId)) {
    memoryConfirmed.add(toolCallId)
    return true
  }
  return false
}

export function markDraftConfirmed(toolCallId: string | undefined): void {
  if (!toolCallId) return
  memoryConfirmed.add(toolCallId)
  if (typeof window === 'undefined') return
  try {
    const existing = readStoredIds().filter((id) => id !== toolCallId)
    existing.push(toolCallId)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(-MAX_STORED)))
  } catch {
    // 隐私模式或存储满时静默退回内存态
  }
}

function fnv1a32(seed: number, input: string): number {
  let h = seed >>> 0
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * 基于 toolCallId 生成稳定的合规 UUID（RFC 4122 v4 形态），
 * 让同一草稿在不同挂载周期下发送相同 idempotency-key，彻底防止重复落库。
 */
export function stableIdempotencyKey(toolCallId: string): string {
  const p1 = fnv1a32(0x811c9dc5, `a:${toolCallId}`)
  const p2 = fnv1a32(0x9e3779b1, `b:${toolCallId}`)
  const p3 = fnv1a32(0x85ebca77, `c:${toolCallId}`)
  const p4 = fnv1a32(0xc2b2ae3d, `d:${toolCallId}`)

  const b = new Uint8Array(16)
  const parts = [p1, p2, p3, p4]
  parts.forEach((n, idx) => {
    b[idx * 4] = (n >>> 24) & 0xff
    b[idx * 4 + 1] = (n >>> 16) & 0xff
    b[idx * 4 + 2] = (n >>> 8) & 0xff
    b[idx * 4 + 3] = n & 0xff
  })
  // 设置 UUID version 4 与 variant RFC 4122 位，保证严格通过服务端 z.uuid() 校验
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80

  const hex = Array.from(b, (v) => v.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
