import { describe, expect, it } from 'vitest'
import * as z from 'zod'
import { isDraftConfirmed, markDraftConfirmed, stableIdempotencyKey } from './confirmed-drafts'

describe('confirmed-drafts: 确定性 UUID 幂等键与确认态记忆', () => {
  it('stableIdempotencyKey 稳定生成严格通过 z.uuid() 校验的 v4 UUID', () => {
    const k1 = stableIdempotencyKey('call_abc_123')
    const k2 = stableIdempotencyKey('call_abc_123')
    const k3 = stableIdempotencyKey('call_abc_456')

    expect(k1).toBe(k2)
    expect(k1).not.toBe(k3)
    expect(z.uuid().safeParse(k1).success).toBe(true)
    expect(z.uuid().safeParse(k3).success).toBe(true)
  })

  it('markDraftConfirmed / isDraftConfirmed 在纯 Node 环境（无 window）也能安全读写内存态', () => {
    const id = 'call_mem_test_1'
    expect(isDraftConfirmed(undefined)).toBe(false)
    expect(isDraftConfirmed(id)).toBe(false)
    markDraftConfirmed(id)
    expect(isDraftConfirmed(id)).toBe(true)
  })
})
