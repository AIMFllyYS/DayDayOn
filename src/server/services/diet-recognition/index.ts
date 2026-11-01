import 'server-only'
import type { DietRecognitionFields, DietRecognitionResult } from '@/features/diet/schemas'
import { ApiError } from '@/server/api/errors'
import { imageToFilePart } from '@/server/ai/image'
import { isAiConfigured } from '@/server/ai/model'
import { dietRecognitionPrompt } from '@/server/ai/prompts/diet-recognition'
import { runAi, type RunAiInput } from '@/server/ai/run'
import { normalizeDraft, recognitionUserText } from './draft'

/*
 * 饮食拍照识别（PRD 2.6、7.3，ai-and-quota.md 第 3、5、6 节）。实现：D6。
 * 图片只在内存里：校验后作为内联 file part 交给 runAi，不写磁盘、不进日志、不进数据库。
 * 识别结果只是草稿，这里什么业务表都不写；用户确认后前端调创建打卡接口（source: 'ai'、aiRunId）。
 */

export interface RecognizeDietInput {
  userId: string
  ip: string
  /** 请求的 idempotency-key：预占与结算共用 */
  idempotencyKey: string
  /** multipart 字段 image（未校验） */
  image: unknown
  fields: DietRecognitionFields
  /** 测试注入 MockLanguageModelV4 */
  model?: RunAiInput<'diet-recognition', typeof dietRecognitionPrompt.schema>['model']
  now?: Date
}

/**
 * 识别一张餐食照片 → 201 { draft, aiRunId }。
 * - 没有 DEEPSEEK_API_KEY：503 AI_PAUSED（不读图片、不预占）；
 * - 图片不合法：400 VALIDATION_FAILED / 413 PAYLOAD_TOO_LARGE（imageToFilePart）；
 * - 模型输出校验失败、超时或调用失败：422 AI_RECOGNITION_FAILED（带 aiRunId，已产生的费用照常结算）；
 * - 其余检查（封号、暂停、日上限、并发、额度）由 runAi 抛出。
 */
export async function recognizeDiet(input: RecognizeDietInput): Promise<DietRecognitionResult> {
  if (!isAiConfigured()) throw new ApiError('AI_PAUSED', 'DEEPSEEK_API_KEY 未配置')

  const filePart = await imageToFilePart(input.image)
  const result = await runAi({
    prompt: dietRecognitionPrompt,
    userId: input.userId,
    ip: input.ip,
    idempotencyKey: input.idempotencyKey,
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: recognitionUserText(input.fields) }, filePart],
      },
    ],
    model: input.model,
    now: input.now,
  })

  if (!result.ok) {
    throw new ApiError('AI_RECOGNITION_FAILED', `识别失败：${result.reason}`, {
      aiRunId: result.aiRunId,
    })
  }
  return { draft: normalizeDraft(result.output), aiRunId: result.aiRunId }
}
