import 'server-only'

/*
 * 价格表与费用计算（ai-and-quota.md 第 4 节），纯函数，全程整数运算、向上取整到微元。
 * 价格表 F1 写定（高峰价），计算函数由 P1 实现并带单测。
 */

/** 微元 / 百万 tokens（一律高峰价） */
export const PRICE_MICROS_PER_MTOK = {
  inputHit: 40_000,
  inputMiss: 2_000_000,
  output: 8_000_000,
} as const

export interface TokenUsage {
  inputMissTokens: number
  inputHitTokens: number
  outputTokens: number
}

/** 实际费用：Σ(tokens × 单价) ÷ 1,000,000，向上取整。实现：P1 */
export function costMicros(usage: TokenUsage): number {
  void usage
  throw new Error('not implemented: P1')
}

/** 预占上限：预估输入 tokens × 未命中价 + maxOutputTokens × 输出价，向上取整。实现：P1 */
export function reserveMicros(estimatedInputTokens: number, maxOutputTokens: number): number {
  void estimatedInputTokens
  void maxOutputTokens
  throw new Error('not implemented: P1')
}
