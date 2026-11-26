import { describe, expect, it } from 'vitest'
import {
  DAILY_QUOTES,
  DONE_QUOTES,
  RETURN_COOLDOWN_MS,
  drawNextQuote,
  quoteBucketFor,
  shouldRefreshOnReturn,
  type QuoteDeckState,
} from './quotes'

describe('主页治愈语录库与无重复洗牌器', () => {
  it('日常语录库达到 90 条且无重复，长短句兼顾，不含感叹号堆叠与 Unicode Emoji', () => {
    expect(DAILY_QUOTES.length).toBeGreaterThanOrEqual(90)
    expect(new Set(DAILY_QUOTES).size).toBe(DAILY_QUOTES.length)
    expect(DONE_QUOTES.length).toBeGreaterThanOrEqual(10)
    expect(new Set(DONE_QUOTES).size).toBe(DONE_QUOTES.length)

    const all = [...DAILY_QUOTES, ...DONE_QUOTES]
    const emojiRe = /\p{Extended_Pictographic}/u
    for (const q of all) {
      expect(q.trim().length).toBeGreaterThanOrEqual(8)
      expect(q).not.toMatch(/[!！]{2,}/)
      expect(emojiRe.test(q)).toBe(false)
    }

    const shortCount = DAILY_QUOTES.filter((q) => q.length <= 16).length
    const longCount = DAILY_QUOTES.filter((q) => q.length >= 28).length
    expect(shortCount).toBeGreaterThanOrEqual(10)
    expect(longCount).toBeGreaterThanOrEqual(20)
  })

  it('Fisher-Yates 洗牌队列在一整轮内覆盖全部语录且不重复，新轮首句不与上轮末句撞车', () => {
    const pool = ['句一', '句二', '句三', '句四', '句五']
    let seed = 0.13
    const deterministicRand = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }

    let state: QuoteDeckState | undefined
    const round1: string[] = []
    for (let i = 0; i < pool.length; i++) {
      const res = drawNextQuote(pool, state, deterministicRand)
      round1.push(res.quote)
      state = res.nextState
    }
    expect(new Set(round1).size).toBe(pool.length)

    // 下一轮强制随机返回 0（尝试抽到相同位置）也绝不能和上轮最后一句重复
    const firstOfRound2 = drawNextQuote(pool, state, () => 0)
    expect(firstOfRound2.quote).not.toBe(round1.at(-1))
  })

  it('损坏的本地存储状态能安全自愈并重新洗牌', () => {
    const pool = ['A', 'B', 'C']
    const res = drawNextQuote(pool, { deck: [99], cursor: -5, lastIdx: null }, () => 0.5)
    expect(pool).toContain(res.quote)
    expect(res.nextState.deck).toHaveLength(3)
    expect(res.nextState.cursor).toBe(1)
  })

  it('后台切回冷却严格按 30 秒边界判定', () => {
    expect(shouldRefreshOnReturn(null, 100_000)).toBe(false)
    expect(shouldRefreshOnReturn(100_000, 100_000 + RETURN_COOLDOWN_MS - 1)).toBe(false)
    expect(shouldRefreshOnReturn(100_000, 100_000 + RETURN_COOLDOWN_MS)).toBe(true)
  })

  it('按今日完成度区分 daily 与 done 桶', () => {
    expect(quoteBucketFor({ done: 0, planned: 3 })).toBe('daily')
    expect(quoteBucketFor({ done: 2, planned: 3 })).toBe('daily')
    expect(quoteBucketFor({ done: 0, planned: 0 })).toBe('daily')
    expect(quoteBucketFor({ done: 3, planned: 3 })).toBe('done')
  })
})
