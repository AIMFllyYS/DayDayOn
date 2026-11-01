import 'server-only'
import type { LanguageModel } from 'ai'

/*
 * 唯一的模型实例（ai-and-quota.md 第 2 节）。签名 F1，实现 P1。
 * 只用 deepseek-flash，写死在这里，经 createDeepSeek({ apiKey })('deepseek-flash') 创建；
 * 禁止字符串模型 id（会走 Vercel AI Gateway）。
 */

export const MODEL_ID = 'deepseek-flash' as const

/** 是否配置了 DEEPSEEK_API_KEY；没有时识别接口返回 503 AI_PAUSED（PRD 风险表）。实现：P1 */
export function isAiConfigured(): boolean {
  throw new Error('not implemented: P1')
}

/**
 * 取模型实例（懒创建，读 env.DEEPSEEK_API_KEY）。测试里由 runAi 的 model 参数注入 MockLanguageModelV4。
 * 实现：P1
 */
export function getFlashModel(): LanguageModel {
  throw new Error('not implemented: P1')
}

/** providerOptions.deepseek.userId：用户 id 的 SHA-256 十六进制（只允许 [a-zA-Z0-9_-]）。实现：P1 */
export async function hashedUserId(userId: string): Promise<string> {
  void userId
  throw new Error('not implemented: P1')
}
