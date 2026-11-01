import 'server-only'
import { OpenAPIHono } from '@hono/zod-openapi'
import type { AppEnv } from '../app'

/*
 * 领域路由（空壳，F1）。实现：D6。路径写完整路径，app.ts 统一挂在根上（PRD 7.5）。
 * 每个接口用 createRoute 定义，写全 request / responses（errorResponses(...)），
 * 领域路由默认 middleware: [requireUser, requireOnboarded] as const（另有说明的除外）。
 *
 *   POST   /ai/diet-recognitions  multipart（image + DietRecognitionFieldsSchema），idempotency-key，hono/body-limit 4MB
 *                                 → 201 DietRecognitionResultSchema；402 / 413 / 422 AI_RECOGNITION_FAILED / 429 / 503 AI_PAUSED
 */
export const aiRoutes = new OpenAPIHono<AppEnv>()
