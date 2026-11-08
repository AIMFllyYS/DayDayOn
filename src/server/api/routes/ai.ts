import 'server-only'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { bodyLimit } from 'hono/body-limit'
import {
  SmartRecognitionFieldsSchema,
  SmartRecognitionResultSchema,
} from '@/features/checkin/smart-schemas'
import { DietRecognitionFieldsSchema, DietRecognitionResultSchema } from '@/features/diet/schemas'
import { IMAGE_MAX_BYTES } from '@/server/ai/image'
import { recognizeDiet } from '@/server/services/diet-recognition'
import { recognizeSmart } from '@/server/services/smart-recognition'
import type { AppEnv } from '../app'
import { ApiError } from '../errors'
import { requireOnboarded, requireUser } from '../middleware/auth'
import { idempotency } from '../middleware/idempotency'
import { rateLimit } from '../middleware/rate-limit'
import { AUTH_ERRORS, errorResponses, IdempotencyHeadersSchema } from '../schemas'

/*
 * AI 识别（PRD 2.6、7.3）。实现：D6 + 全板块智能识别扩展。不流式：201 JSON { draft, aiRunId }，走普通幂等重放。
 *   POST /ai/diet-recognitions   multipart（image + mealType? + note?），idempotency-key，body-limit 4 MB
 *   POST /ai/smart-recognitions  multipart（image? + textContent? + hintModule? + goalId? + note?），idempotency-key，body-limit 4 MB
 * 图片不记日志、不落盘：handler 只把 File 交给 service，service 在内存里转成内联 file part。
 */

/** multipart 头部与文本字段的余量；图片本身的 4 MB 上限由 imageToFilePart 精确校验 */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024

const tooLarge = new ApiError('PAYLOAD_TOO_LARGE', '请求体超过 4 MB')

const RecognitionFormSchema = DietRecognitionFieldsSchema.extend({
  // 文件本身由 imageToFilePart 校验（类型、文件头、大小），这里只声明给 OpenAPI
  image: z
    .unknown()
    .openapi({ type: 'string', format: 'binary', description: '首张 JPEG，≤ 4 MB' }),
  image2: z
    .unknown()
    .optional()
    .openapi({ type: 'string', format: 'binary', description: '可选第 2 张 JPEG，≤ 4 MB' }),
})

const SmartRecognitionFormSchema = SmartRecognitionFieldsSchema.extend({
  image: z
    .unknown()
    .optional()
    .openapi({ type: 'string', format: 'binary', description: '可选首张 JPEG 图片，≤ 4 MB' }),
  image2: z
    .unknown()
    .optional()
    .openapi({ type: 'string', format: 'binary', description: '可选第 2 张 JPEG 图片，≤ 4 MB' }),
})

const recognizeRoute = createRoute({
  method: 'post',
  path: '/ai/diet-recognitions',
  summary: '饮食拍照识别（最多支持 2 张照片，返回草稿，不入库）',
  middleware: [
    requireUser,
    requireOnboarded,
    bodyLimit({
      maxSize: IMAGE_MAX_BYTES + MULTIPART_OVERHEAD_BYTES,
      onError: (c) => c.json(tooLarge.toBody(), tooLarge.status),
    }),
    // 短窗口防连点；每小时次数与并发由 runAi 按全站配置判断
    rateLimit({ rule: { name: 'ai-recognition-minute', windowSeconds: 60, max: 6 }, by: 'user' }),
    idempotency(),
  ] as const,
  request: {
    headers: IdempotencyHeadersSchema,
    body: {
      content: { 'multipart/form-data': { schema: RecognitionFormSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: DietRecognitionResultSchema } },
      description: '识别草稿；confidence < 0.6 时前端提示核对',
    },
    ...errorResponses(
      ...AUTH_ERRORS,
      'VALIDATION_FAILED',
      'QUOTA_INSUFFICIENT',
      'IDEMPOTENCY_KEY_REUSED',
      'REQUEST_IN_PROGRESS',
      'PAYLOAD_TOO_LARGE',
      'AI_RECOGNITION_FAILED',
      'RATE_LIMITED',
      'AI_PAUSED',
    ),
  },
})

const smartRecognizeRoute = createRoute({
  method: 'post',
  path: '/ai/smart-recognitions',
  summary: '全板块智能打卡识别（支持最多 2 张图片或 TXT/HTML 文本附件，自动判别板块并返回草稿）',
  middleware: [
    requireUser,
    requireOnboarded,
    bodyLimit({
      maxSize: IMAGE_MAX_BYTES + MULTIPART_OVERHEAD_BYTES,
      onError: (c) => c.json(tooLarge.toBody(), tooLarge.status),
    }),
    rateLimit({ rule: { name: 'ai-recognition-minute', windowSeconds: 60, max: 6 }, by: 'user' }),
    idempotency(),
  ] as const,
  request: {
    headers: IdempotencyHeadersSchema,
    body: {
      content: { 'multipart/form-data': { schema: SmartRecognitionFormSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: SmartRecognitionResultSchema } },
      description: '全板块智能识别草稿；包含判别出的板块 detectedModule 与对应板块预填数据',
    },
    ...errorResponses(
      ...AUTH_ERRORS,
      'VALIDATION_FAILED',
      'QUOTA_INSUFFICIENT',
      'IDEMPOTENCY_KEY_REUSED',
      'REQUEST_IN_PROGRESS',
      'PAYLOAD_TOO_LARGE',
      'AI_RECOGNITION_FAILED',
      'RATE_LIMITED',
      'AI_PAUSED',
    ),
  },
})

export const aiRoutes = new OpenAPIHono<AppEnv>()
  .openapi(recognizeRoute, async (c) => {
    const { image, image2, mealType, note } = c.req.valid('form')
    const result = await recognizeDiet({
      userId: c.get('user').id,
      ip: c.get('ip'),
      idempotencyKey: c.req.valid('header')['idempotency-key'],
      image,
      image2,
      fields: { mealType, note },
    })
    return c.json(result, 201)
  })
  .openapi(smartRecognizeRoute, async (c) => {
    const { image, image2, hintModule, goalId, textContent, note } = c.req.valid('form')
    const result = await recognizeSmart({
      userId: c.get('user').id,
      ip: c.get('ip'),
      idempotencyKey: c.req.valid('header')['idempotency-key'],
      image,
      image2,
      fields: { hintModule, goalId, textContent, note },
    })
    return c.json(result, 201)
  })
