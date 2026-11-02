import 'server-only'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import * as z from 'zod'
import {
  PetInteractInputSchema,
  PetInteractResultSchema,
  PetInteractionsStatusSchema,
} from '@/features/friend/schemas'
import { UserIdSchema } from '@/features/shared/schemas'
import { db } from '@/server/db/client'
import * as petInteractionsService from '@/server/services/pet-interactions'
import type { AppEnv } from '../app'
import { requireOnboarded, requireUser } from '../middleware/auth'
import { AUTH_ERRORS, errorResponses } from '../schemas'

const json = <T extends z.ZodType>(schema: T) => ({ 'application/json': { schema } })

const FriendIdParamSchema = z.object({
  friendUserId: UserIdSchema,
})

const getInteractionsStatusRoute = createRoute({
  method: 'get',
  path: '/friends/{friendUserId}/interactions',
  tags: ['friend', 'pet'],
  summary: '获取指定好友的宠物互动额度、剩余冷却与提醒打卡资格',
  middleware: [requireUser, requireOnboarded] as const,
  request: {
    params: FriendIdParamSchema,
  },
  responses: {
    200: { content: json(PetInteractionsStatusSchema), description: '宠物互动状态与额度' },
    ...errorResponses(...AUTH_ERRORS, 'FRIEND_NOT_FOUND', 'USER_NOT_FOUND', 'VALIDATION_FAILED'),
  },
})

const interactPetRoute = createRoute({
  method: 'post',
  path: '/friends/{friendUserId}/interact',
  tags: ['friend', 'pet'],
  summary: '对好友小窝宠物执行互动（戳戳、投喂、提醒打卡）',
  middleware: [requireUser, requireOnboarded] as const,
  request: {
    params: FriendIdParamSchema,
    body: { content: json(PetInteractInputSchema), required: true },
  },
  responses: {
    200: { content: json(PetInteractResultSchema), description: '互动执行成功' },
    ...errorResponses(
      ...AUTH_ERRORS,
      'VALIDATION_FAILED',
      'FRIEND_NOT_FOUND',
      'USER_NOT_FOUND',
      'INTERACTION_COOLDOWN',
      'INTERACTION_DAILY_LIMIT_EXCEEDED',
      'REMIND_NOT_APPLICABLE',
    ),
  },
})

export const petInteractionRoutes = new OpenAPIHono<AppEnv>()
  .openapi(getInteractionsStatusRoute, async (c) => {
    const { friendUserId } = c.req.valid('param')
    const data = await petInteractionsService.getPetInteractionsStatus(
      db,
      c.get('user').id,
      friendUserId,
      new Date(),
    )
    return c.json(data, 200)
  })
  .openapi(interactPetRoute, async (c) => {
    const { friendUserId } = c.req.valid('param')
    const input = c.req.valid('json')
    const data = await petInteractionsService.interactWithFriendPet(
      db,
      c.get('user').id,
      friendUserId,
      input,
      new Date(),
    )
    return c.json(data, 200)
  })
