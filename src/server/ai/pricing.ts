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

// tsconfig target 是 ES2017，不能写 bigint 字面量（1n），用 BigInt() 构造
const ZERO = BigInt(0)
const ONE = BigInt(1)
const MTOK = BigInt(1_000_000)

/** 非负整数 tokens；undefined / 负数 / 小数一律按 0 或向下取整处理，避免脏数据把账算乱 */
function tokens(n: number | undefined): bigint {
  if (n === undefined || !Number.isFinite(n) || n <= 0) return ZERO
  return BigInt(Math.floor(n))
}

/** ⌈numerator / MTOK⌉，numerator ≥ 0。用 bigint 避免 tokens × 单价超出安全整数 */
function ceilDivMtok(numerator: bigint): number {
  return Number((numerator + MTOK - ONE) / MTOK)
}

/** 实际费用：Σ(tokens × 单价) ÷ 1,000,000，向上取整 */
export function costMicros(usage: TokenUsage): number {
  const total =
    tokens(usage.inputMissTokens) * BigInt(PRICE_MICROS_PER_MTOK.inputMiss) +
    tokens(usage.inputHitTokens) * BigInt(PRICE_MICROS_PER_MTOK.inputHit) +
    tokens(usage.outputTokens) * BigInt(PRICE_MICROS_PER_MTOK.output)
  return ceilDivMtok(total)
}

/** 预占上限：预估输入 tokens × 未命中价 + maxOutputTokens × 输出价，向上取整 */
export function reserveMicros(estimatedInputTokens: number, maxOutputTokens: number): number {
  return costMicros({
    inputMissTokens: estimatedInputTokens,
    inputHitTokens: 0,
    outputTokens: maxOutputTokens,
  })
}

/**
 * AI SDK 7 的 LanguageModelUsage → TokenUsage。
 * inputTokenDetails.noCacheTokens 缺失时用 inputTokens - cacheReadTokens 推出（按未命中计，不会低估）。
 */
export function usageFromSdk(usage: {
  inputTokens: number | undefined
  inputTokenDetails?: {
    noCacheTokens: number | undefined
    cacheReadTokens: number | undefined
  }
  outputTokens: number | undefined
}): TokenUsage {
  const hit = usage.inputTokenDetails?.cacheReadTokens ?? 0
  const miss = usage.inputTokenDetails?.noCacheTokens ?? Math.max(0, (usage.inputTokens ?? 0) - hit)
  return {
    inputMissTokens: Math.max(0, miss),
    inputHitTokens: Math.max(0, hit),
    outputTokens: Math.max(0, usage.outputTokens ?? 0),
  }
}
