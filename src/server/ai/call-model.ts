import 'server-only'
import {
  APICallError,
  generateText,
  type LanguageModel,
  type LanguageModelUsage,
  type ModelMessage,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
} from 'ai'
import type * as z from 'zod'
import { type TokenUsage, usageFromSdk } from './pricing'

/*
 * runAi 的第 3 步"调用"（ai-and-quota.md 第 3 节）：不碰数据库，便于用 MockLanguageModelV4 测试。
 * 不抛错：成功、输出校验失败、超时、其他失败都折成一个结果，带上已产生的用量供结算。
 * 不记录 prompt 正文、用户输入、模型输出和图片；失败时只记脱敏错误类型、finishReason 或 HTTP 状态码。
 */

export const DEFAULT_TIMEOUT_MS = 45_000

export interface CallModelInput<S extends z.ZodType> {
  model: LanguageModel
  system: string
  schema: S
  maxOutputTokens: number
  thinking: { type: 'enabled' | 'disabled' }
  messages: ModelMessage[]
  /** providerOptions.deepseek.userId：用户 id 的 SHA-256 */
  userIdHash: string
  timeoutMs?: number
}

export type CallModelResult<S extends z.ZodType> =
  | { kind: 'ok'; output: z.infer<S>; usage: TokenUsage }
  | { kind: 'invalid-output' | 'timeout' | 'failed'; usage: TokenUsage }

const ZERO_USAGE: TokenUsage = { inputMissTokens: 0, inputHitTokens: 0, outputTokens: 0 }

function usageOf(u: LanguageModelUsage | undefined): TokenUsage {
  return u ? usageFromSdk(u) : ZERO_USAGE
}

function isTimeout(error: unknown): boolean {
  for (let e: unknown = error, depth = 0; e && depth < 5; depth++) {
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) return true
    e = e instanceof Error ? e.cause : undefined
  }
  return false
}

export async function callModel<S extends z.ZodType>(
  input: CallModelInput<S>,
): Promise<CallModelResult<S>> {
  try {
    const result = await generateText({
      model: input.model,
      instructions: input.system,
      messages: input.messages,
      output: Output.object({ schema: input.schema }),
      maxOutputTokens: input.maxOutputTokens,
      timeout: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      // 重试会重复计费且拉长等待；失败直接降级为手动填写
      maxRetries: 0,
      providerOptions: {
        deepseek: { thinking: input.thinking, userId: input.userIdHash },
      },
    })
    const usage = usageOf(result.totalUsage)
    // Output.object 已经校验过；再 safeParse 一次拿到精确类型
    const parsed = input.schema.safeParse(result.output)
    if (!parsed.success) return { kind: 'invalid-output', usage }
    return { kind: 'ok', output: parsed.data as z.infer<S>, usage }
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      console.error(
        '[ai] 结构化输出校验失败',
        `finishReason=${error.finishReason ?? 'unknown'}`,
        `cause=${error.cause instanceof Error ? error.cause.name : 'unknown'}`,
      )
      return { kind: 'invalid-output', usage: usageOf(error.usage) }
    }
    if (NoOutputGeneratedError.isInstance(error)) {
      console.error('[ai] 模型未返回有效输出')
      return { kind: 'invalid-output', usage: ZERO_USAGE }
    }
    if (isTimeout(error)) {
      console.error('[ai] 模型调用超时', `timeoutMs=${input.timeoutMs ?? DEFAULT_TIMEOUT_MS}`)
      return { kind: 'timeout', usage: ZERO_USAGE }
    }
    if (APICallError.isInstance(error)) {
      console.error('[ai] 模型调用失败', error.name, `status=${error.statusCode ?? 'unknown'}`)
      return { kind: 'failed', usage: ZERO_USAGE }
    }
    console.error('[ai] 模型调用失败', error instanceof Error ? error.name : typeof error)
    return { kind: 'failed', usage: ZERO_USAGE }
  }
}
