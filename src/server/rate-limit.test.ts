import { describe, expect, it } from 'vitest'
import { counterKey, judge, windowOf } from './rate-limit'

describe('windowOf', () => {
  it('窗口起点按窗口长度对齐', () => {
    const w = windowOf({ windowSeconds: 3600 }, new Date('2026-10-31T08:42:10Z'))
    expect(w.start.toISOString()).toBe('2026-10-31T08:00:00.000Z')
    expect(w.end.toISOString()).toBe('2026-10-31T09:00:00.000Z')
    expect(w.retryAfterSeconds).toBe(17 * 60 + 50)
  })

  it('正好在窗口起点时属于新窗口，Retry-After 为整个窗口', () => {
    const w = windowOf({ windowSeconds: 60 }, new Date('2026-10-31T08:00:00Z'))
    expect(w.start.toISOString()).toBe('2026-10-31T08:00:00.000Z')
    expect(w.retryAfterSeconds).toBe(60)
  })

  it('Retry-After 至少 1 秒', () => {
    const w = windowOf({ windowSeconds: 60 }, new Date('2026-10-31T08:00:59.900Z'))
    expect(w.retryAfterSeconds).toBe(1)
  })
})

describe('counterKey', () => {
  it('形如 规则名:主体:窗口起点秒', () => {
    expect(counterKey({ name: 'otp-email' }, 'a@qq.com', new Date('2026-10-31T08:00:00Z'))).toBe(
      'otp-email:a@qq.com:1793433600',
    )
  })
})

describe('judge', () => {
  it('计数不超过上限时放行', () => {
    expect(judge({ max: 5 }, 5, 30)).toEqual({ ok: true, count: 5, retryAfterSeconds: 0 })
  })

  it('超过上限时拒绝并带 Retry-After', () => {
    expect(judge({ max: 5 }, 6, 30)).toEqual({ ok: false, count: 6, retryAfterSeconds: 30 })
  })
})
