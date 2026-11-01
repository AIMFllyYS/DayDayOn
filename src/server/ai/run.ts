import 'server-only'
import type { LanguageModel, ModelMessage } from 'ai'
import type * as z from 'zod'
import type { AiPurpose } from '@/features/quota/schemas'

/*
 * 所有 AI 调用的唯一入口（ai-and-quota.md 第 3 节）。签名 F1，实现 P1（MockLanguageModelV4 测三条路径）。
 * 流程：检查（封号、暂停、日上限、并发与频率）→ 预占 → 调用 → 结算或释放 → 写 ai_runs。
 * 不记录 prompt 正文、用户输入、模型输出和图片。
 */

/** prompts/<purpose>.ts 导出的定义（ai-and-quota.md 第 7 节）。D6 写具体 prompt */
export interface PromptDef<P extends AiPurpose, S extends z.ZodType> {
  id: P
  /** 改 prompt 必须加一 */
  version: number
  /** 中文；不放用户数据 */
  system: string
  /** 输出 schema：模型输出先过它校验，失败算识别失败 */
  schema: S
  /** 预占上限的依据，必填 */
  maxOutputTokens: number
  /** 必须显式声明；结构化识别用 disabled */
  thinking: { type: 'enabled' | 'disabled' }
  /** 预估输入 tokens（含图片），用于预占 */
  estimatedInputTokens: number
  /** 超时（毫秒），默认 30 秒 */
  timeoutMs?: number
}

export interface RunAiInput<P extends AiPurpose, S extends z.ZodType> {
  prompt: PromptDef<P, S>
  userId: string
  ip: string
  /** 请求的 idempotency-key：预占与结算共用 */
  idempotencyKey: string
  /** user message（图片作为 file part 放在这里） */
  messages: ModelMessage[]
  /** 测试注入；默认 getFlashModel() */
  model?: LanguageModel
  now?: Date
}

export type RunAiResult<S extends z.ZodType> =
  | { ok: true; aiRunId: string; output: z.infer<S>; costMicros: number }
  /** 校验失败或超时：已产生的费用照常结算；调用方映射为 422 AI_RECOGNITION_FAILED（带 aiRunId） */
  | {
      ok: false
      aiRunId: string
      reason: 'invalid-output' | 'timeout' | 'failed'
      costMicros: number
    }

/**
 * 执行一次 AI 调用。检查不通过时抛 ApiError：403 ACCOUNT_BANNED、503 AI_PAUSED、
 * 429 RATE_LIMITED、402 QUOTA_INSUFFICIENT（不调用模型、不写 ai_runs）。实现：P1
 */
export async function runAi<P extends AiPurpose, S extends z.ZodType>(
  input: RunAiInput<P, S>,
): Promise<RunAiResult<S>> {
  void input
  throw new Error('not implemented: P1')
}
