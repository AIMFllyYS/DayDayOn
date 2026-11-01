import { describe, expect, it } from 'vitest'
import { costMicros, PRICE_MICROS_PER_MTOK, reserveMicros, usageFromSdk } from './pricing'

describe('costMicros', () => {
  it('零用量为 0', () => {
    expect(costMicros({ inputMissTokens: 0, inputHitTokens: 0, outputTokens: 0 })).toBe(0)
  })

  it('各类 tokens 分别按单价计费', () => {
    // 1M 未命中 = 2 元；1M 命中 = 0.04 元；1M 输出 = 8 元
    expect(costMicros({ inputMissTokens: 1_000_000, inputHitTokens: 0, outputTokens: 0 })).toBe(
      PRICE_MICROS_PER_MTOK.inputMiss,
    )
    expect(costMicros({ inputMissTokens: 0, inputHitTokens: 1_000_000, outputTokens: 0 })).toBe(
      PRICE_MICROS_PER_MTOK.inputHit,
    )
    expect(costMicros({ inputMissTokens: 0, inputHitTokens: 0, outputTokens: 1_000_000 })).toBe(
      PRICE_MICROS_PER_MTOK.output,
    )
  })

  it('ADR-0002 的估算：1.5k 输入 + 0.5k 输出约 0.007 元', () => {
    // 1500 × 2 + 500 × 8 = 3000 + 4000 = 7000 微元
    expect(costMicros({ inputMissTokens: 1500, inputHitTokens: 0, outputTokens: 500 })).toBe(7000)
  })

  it('不足 1 微元向上取整', () => {
    // 1 个命中 token = 0.04 微元 → 1
    expect(costMicros({ inputMissTokens: 0, inputHitTokens: 1, outputTokens: 0 })).toBe(1)
    // 26 个命中 token = 1.04 微元 → 2
    expect(costMicros({ inputMissTokens: 0, inputHitTokens: 26, outputTokens: 0 })).toBe(2)
    // 25 个命中 token = 1 微元，整除不进位
    expect(costMicros({ inputMissTokens: 0, inputHitTokens: 25, outputTokens: 0 })).toBe(1)
  })

  it('混合用量整体取整一次，而不是逐项取整', () => {
    // 1 命中 (0.04) + 1 未命中 (2) + 1 输出 (8) = 10.04 → 11
    expect(costMicros({ inputMissTokens: 1, inputHitTokens: 1, outputTokens: 1 })).toBe(11)
  })

  it('大用量不丢精度', () => {
    expect(
      costMicros({ inputMissTokens: 123_456_789, inputHitTokens: 0, outputTokens: 987_654_321 }),
    ).toBe(123_456_789 * 2 + 987_654_321 * 8)
  })

  it('负数与非有限值按 0 处理', () => {
    expect(costMicros({ inputMissTokens: -5, inputHitTokens: Number.NaN, outputTokens: 0 })).toBe(0)
  })
})

describe('reserveMicros', () => {
  it('按未命中价 + 最大输出价预占', () => {
    // 2000 × 2 + 800 × 8 = 10400
    expect(reserveMicros(2000, 800)).toBe(10_400)
  })

  it('预占不小于同样 tokens 的实际费用', () => {
    const reserved = reserveMicros(1500, 800)
    const actual = costMicros({ inputMissTokens: 1000, inputHitTokens: 500, outputTokens: 800 })
    expect(reserved).toBeGreaterThanOrEqual(actual)
  })
})

describe('usageFromSdk', () => {
  it('读取 AI SDK 7 的分层 usage', () => {
    expect(
      usageFromSdk({
        inputTokens: 1200,
        inputTokenDetails: { noCacheTokens: 1000, cacheReadTokens: 200 },
        outputTokens: 300,
      }),
    ).toEqual({ inputMissTokens: 1000, inputHitTokens: 200, outputTokens: 300 })
  })

  it('缺 noCacheTokens 时用总数减命中推算', () => {
    expect(
      usageFromSdk({
        inputTokens: 1200,
        inputTokenDetails: { noCacheTokens: undefined, cacheReadTokens: 200 },
        outputTokens: undefined,
      }),
    ).toEqual({ inputMissTokens: 1000, inputHitTokens: 200, outputTokens: 0 })
  })

  it('完全没有用量时为 0', () => {
    expect(usageFromSdk({ inputTokens: undefined, outputTokens: undefined })).toEqual({
      inputMissTokens: 0,
      inputHitTokens: 0,
      outputTokens: 0,
    })
  })
})
