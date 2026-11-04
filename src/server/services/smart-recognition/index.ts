import 'server-only'
import type {
  SmartRecognitionFields,
  SmartRecognitionResult,
} from '@/features/checkin/smart-schemas'
import { ApiError } from '@/server/api/errors'
import { imageToFilePart } from '@/server/ai/image'
import { isAiConfigured } from '@/server/ai/model'
import { smartRecognitionPrompt } from '@/server/ai/prompts/smart-recognition'
import { runAi, type RunAiInput } from '@/server/ai/run'
import { db } from '@/server/db/client'
import { listGoals } from '@/server/services/goals'
import { buildSmartUserText, normalizeSmartDraft, type SmartGoalBrief } from './draft'

/*
 * 全板块智能识别服务（智能拍照 + 智能上传图片/纯文本）：
 *   POST /api/v1/ai/smart-recognitions → 201 { draft, aiRunId }。
 *
 * 隐私与安全红线（ADR-0002、ai-and-quota.md 第 5 节）：
 * - 图片只在内存中经 imageToFilePart 校验并作为内联 file part 传给模型，绝不写磁盘、不进数据库、不进日志；
 * - 识别结果仅作为前端草稿返回，不写入任何业务打卡表，待用户确认或微调后再调用创建打卡接口（source: 'ai'、aiRunId）。
 */

export interface RecognizeSmartInput {
  userId: string
  ip: string
  idempotencyKey: string
  /** multipart 字段 image（可选：当上传文本附件时可不传图片） */
  image?: unknown
  fields: SmartRecognitionFields
  /** 测试注入 */
  goalsOverride?: readonly SmartGoalBrief[]
  model?: RunAiInput<'smart-recognition', typeof smartRecognitionPrompt.schema>['model']
  now?: Date
}

function hasUploadedFile(image: unknown): boolean {
  if (image === undefined || image === null || image === '') return false
  if (image instanceof Blob) return image.size > 0
  return true
}

export async function recognizeSmart(input: RecognizeSmartInput): Promise<SmartRecognitionResult> {
  if (!isAiConfigured()) throw new ApiError('AI_PAUSED', 'DEEPSEEK_API_KEY 未配置')

  const hasImage = hasUploadedFile(input.image)
  const hasText = Boolean(input.fields.textContent && input.fields.textContent.trim().length > 0)

  if (!hasImage && !hasText) {
    throw new ApiError('VALIDATION_FAILED', '请上传图片或文本附件内容', {
      fields: { image: ['请上传图片或文本附件内容'] },
    })
  }

  const filePart = hasImage ? await imageToFilePart(input.image) : null

  const goals: readonly SmartGoalBrief[] =
    input.goalsOverride ??
    (await listGoals(db, input.userId, { status: 'active' })).items.map((g) => ({
      id: g.id,
      module: g.module,
      title: g.title,
      fields: g.fields,
    }))

  const userText = buildSmartUserText({
    fields: input.fields,
    goals,
    hasImage,
  })

  const result = await runAi({
    prompt: smartRecognitionPrompt,
    userId: input.userId,
    ip: input.ip,
    idempotencyKey: input.idempotencyKey,
    messages: [
      {
        role: 'user',
        content: filePart
          ? [{ type: 'text', text: userText }, filePart]
          : [{ type: 'text', text: userText }],
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

  return {
    draft: normalizeSmartDraft(result.output, {
      hintModule: input.fields.hintModule,
      goalId: input.fields.goalId,
      goals,
    }),
    aiRunId: result.aiRunId,
  }
}
