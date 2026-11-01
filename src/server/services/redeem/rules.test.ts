import { describe, expect, it } from 'vitest'
import { classifyUnavailable, redeemLockState } from './rules'

const now = new Date('2026-11-01T12:00:00.000Z')
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000)

describe('redeemLockState', () => {
  it('失败次数少于阈值：不锁', () => {
    expect(redeemLockState([minutesAgo(1), minutesAgo(2)], 5, now)).toEqual({ locked: false })
  })

  it('一小时内失败达到阈值：锁到第 N 新的那次滑出窗口', () => {
    const failures = [1, 5, 10, 20, 40].map(minutesAgo)
    // 第 5 新的是 40 分钟前 → 还要 20 分钟
    expect(redeemLockState(failures, 5, now)).toEqual({ locked: true, retryAfterSeconds: 1200 })
  })

  it('超过一小时的失败不算', () => {
    const failures = [1, 5, 10, 20, 61].map(minutesAgo)
    expect(redeemLockState(failures, 5, now)).toEqual({ locked: false })
  })

  it('Retry-After 至少 1 秒', () => {
    const failures = [new Date(now.getTime() - 3_599_999)]
    expect(redeemLockState(failures, 1, now)).toEqual({ locked: true, retryAfterSeconds: 1 })
  })
})

describe('classifyUnavailable', () => {
  it('已兑换 → used；不存在、作废 → invalid（不区分，防探测）', () => {
    expect(classifyUnavailable('redeemed')).toBe('used')
    expect(classifyUnavailable('void')).toBe('invalid')
    expect(classifyUnavailable(null)).toBe('invalid')
  })
})
