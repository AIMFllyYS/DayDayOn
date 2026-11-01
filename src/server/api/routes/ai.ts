import 'server-only'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { bodyLimit } from 'hono/body-limit'
import { DietRecognitionFieldsSchema, DietRecognitionResultSchema } from '@/features/diet/schemas'
import { IMAGE_MAX_BYTES } from '@/server/ai/image'
import { recognizeDiet } from '@/server/services/diet-recognition'
import type { AppEnv } from '../app'
import { ApiError } from '../errors'
import { requireOnboarded, requireUser } from '../middleware/auth'
import { idempotency } from '../middleware/idempotency'
import { rateLimit } from '../middleware/rate-limit'
import { AUTH_ERRORS, errorResponses, IdempotencyHeadersSchema } from '../schemas'

/*
 * AI 识别（PRD 2.6、7.3）。实现：D6。不流式：201 JSON { draft, aiRunId }，走普通幂等重放。
 *   POST /ai/diet-recognitions  multipart（image + mealType? + note?），idempotency-key，body-limit 4 MB
 * 图片不记日志、不落盘：handler 只把 File 交给 service，service 在内存里转成内联 file part。
 */

/** multipart 头部与文本字段的余量；图片本身的 4 MB 上限由 imageToFilePart 精确校验 */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024

const tooLarge = new ApiError('PAYLOAD_TOO_LARGE', '请求体超过 4 MB')

const RecognitionFormSchema = DietRecognitionFieldsSchema.extend({
  // 文件本身由 imageToFilePart 校验（类型、文件头、大小），这里只声明给 OpenAPI
  image: z.unknown().openapi({ type: 'string', format: 'binary', description: 'JPEG，≤ 4 MB' }),
})

const recognizeRoute = createRoute({
  method: 'post',
  path: '/ai/diet-recognitions',
  summary: '饮食拍照识别（返回草稿，不入库）',
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

export const aiRoutes = new OpenAPIHono<AppEnv>().openapi(recognizeRoute, async (c) => {
  const { image, mealType, note } = c.req.valid('form')
  const result = await recognizeDiet({
    userId: c.get('user').id,
    ip: c.get('ip'),
    idempotencyKey: c.req.valid('header')['idempotency-key'],
    image,
    fields: { mealType, note },
  })
  return c.json(result, 201)
})
