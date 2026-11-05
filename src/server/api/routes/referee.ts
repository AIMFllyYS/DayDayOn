import 'server-only'
import { Hono } from 'hono'
import * as z from 'zod'
import { CreateCheckinSchema } from '@/features/checkin/schemas'
import { GoalIdParamSchema } from '@/features/goal/schemas'
import { startReferee } from '@/server/services/referee'
import type { AppEnv } from '../app'
import { requireOnboarded, requireUser } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'

/*
 * Agent 裁判接口（checkin-modules.md 第 4 节）。
 *   POST /goals/{goalId}/referee   流式（UI message stream）：预占额度 → 裁判 Agent → 结算；不写业务表
 * 请求体：{ checkin: 创建打卡的请求体, idempotencyKey }。
 * 和 Agent 对话一样不走幂等中间件（流式响应体无法缓存）；重复的 idempotencyKey 在额度层被拒绝。
 */

const RefereeRequestSchema = z.object({
  checkin: CreateCheckinSchema,
  idempotencyKey: z.uuid(),
})

export const refereeRoutes = new Hono<AppEnv>().post(
  '/goals/:goalId/referee',
  requireUser,
  requireOnboarded,
  rateLimit({ rule: { name: 'referee-minute', windowSeconds: 60, max: 8 }, by: 'user' }),
  async (c) => {
    const params = GoalIdParamSchema.safeParse({ goalId: c.req.param('goalId') })
    const raw: unknown = await c.req.json().catch(() => null)
    const parsed = RefereeRequestSchema.safeParse(raw)
    if (!params.success || !parsed.success) {
      return c.json(
        {
          code: 'VALIDATION_FAILED',
          detail: '请求体校验失败',
          fields: parsed.success
            ? { goalId: ['目标 id 格式不对'] }
            : (z.flattenError(parsed.error).fieldErrors as Record<string, string[]>),
        },
        400,
      )
    }
    return startReferee({
      userId: c.get('user').id,
      ip: c.get('ip'),
      idempotencyKey: parsed.data.idempotencyKey,
      goalId: params.data.goalId,
      checkin: parsed.data.checkin,
    })
  },
)
