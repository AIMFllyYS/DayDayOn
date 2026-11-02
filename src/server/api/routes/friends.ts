import 'server-only'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import * as z from 'zod'
import {
  FriendAcceptResultSchema,
  FriendDashboardSchema,
  FriendInviteCodeInputSchema,
  FriendInvitePreviewSchema,
  FriendInviteSchema,
  FriendListSchema,
} from '@/features/friend/schemas'
import { UserIdSchema } from '@/features/shared/schemas'
import { db } from '@/server/db/client'
import * as friendsService from '@/server/services/friends'
import type { AppEnv } from '../app'
import { requireOnboarded, requireUser } from '../middleware/auth'
import { AUTH_ERRORS, errorResponses } from '../schemas'

/*
 * 好友体系接口（ADR-0026）：
 *   GET    /friends                         获取本人与好友列表（附今日进度与连续打卡天数）
 *   POST   /friends/invite                  获取或生成 10 分钟有效的 6 位配对码
 *   POST   /friends/invite/preview          校验 6 位配对码并返回邀请人信息（用于居中二次确认弹窗）
 *   POST   /friends/accept                  确认接受好友邀请，双向建立好友关系
 *   GET    /friends/{friendUserId}/dashboard 获取指定好友的完整今日打卡仪表盘
 */

const json = <T extends z.ZodType>(schema: T) => ({ 'application/json': { schema } })

const FriendIdParamSchema = z.object({
  friendUserId: UserIdSchema,
})

const listFriendsRoute = createRoute({
  method: 'get',
  path: '/friends',
  tags: ['friend'],
  summary: '获取本人与好友列表',
  middleware: [requireUser, requireOnboarded] as const,
  responses: {
    200: { content: json(FriendListSchema), description: '本人与好友列表摘要' },
    ...errorResponses(...AUTH_ERRORS),
  },
})

const createInviteRoute = createRoute({
  method: 'post',
  path: '/friends/invite',
  tags: ['friend'],
  summary: '获取或生成 10 分钟有效的 6 位好友配对码',
  middleware: [requireUser, requireOnboarded] as const,
  responses: {
    200: { content: json(FriendInviteSchema), description: '6 位配对码与过期时间' },
    ...errorResponses(...AUTH_ERRORS),
  },
})

const previewInviteRoute = createRoute({
  method: 'post',
  path: '/friends/invite/preview',
  tags: ['friend'],
  summary: '校验 6 位配对码并返回邀请人头像与昵称',
  middleware: [requireUser, requireOnboarded] as const,
  request: {
    body: { content: json(FriendInviteCodeInputSchema), required: true },
  },
  responses: {
    200: { content: json(FriendInvitePreviewSchema), description: '邀请人信息预览' },
    ...errorResponses(
      ...AUTH_ERRORS,
      'VALIDATION_FAILED',
      'FRIEND_INVITE_INVALID',
      'FRIEND_SELF_INVITE',
      'FRIEND_ALREADY_EXISTS',
      'USER_NOT_FOUND',
    ),
  },
})

const acceptInviteRoute = createRoute({
  method: 'post',
  path: '/friends/accept',
  tags: ['friend'],
  summary: '确认接受好友邀请',
  middleware: [requireUser, requireOnboarded] as const,
  request: {
    body: { content: json(FriendInviteCodeInputSchema), required: true },
  },
  responses: {
    200: { content: json(FriendAcceptResultSchema), description: '已成为好友' },
    ...errorResponses(
      ...AUTH_ERRORS,
      'VALIDATION_FAILED',
      'FRIEND_INVITE_INVALID',
      'FRIEND_SELF_INVITE',
      'FRIEND_ALREADY_EXISTS',
    ),
  },
})

const friendDashboardRoute = createRoute({
  method: 'get',
  path: '/friends/{friendUserId}/dashboard',
  tags: ['friend'],
  summary: '获取指定好友的完整今日打卡仪表盘',
  middleware: [requireUser, requireOnboarded] as const,
  request: {
    params: FriendIdParamSchema,
  },
  responses: {
    200: { content: json(FriendDashboardSchema), description: '好友信息与完整今日打卡仪表盘' },
    ...errorResponses(...AUTH_ERRORS, 'FRIEND_NOT_FOUND', 'USER_NOT_FOUND'),
  },
})

export const friendRoutes = new OpenAPIHono<AppEnv>()
  .openapi(listFriendsRoute, async (c) => {
    const data = await friendsService.listFriends(db, c.get('user').id, new Date())
    return c.json(data, 200)
  })
  .openapi(createInviteRoute, async (c) => {
    const data = await friendsService.getOrCreateInviteCode(db, c.get('user').id, new Date())
    return c.json(data, 200)
  })
  .openapi(previewInviteRoute, async (c) => {
    const { code } = c.req.valid('json')
    const data = await friendsService.previewInviteCode(db, c.get('user').id, code, new Date())
    return c.json(data, 200)
  })
  .openapi(acceptInviteRoute, async (c) => {
    const { code } = c.req.valid('json')
    const data = await friendsService.acceptInviteCode(db, c.get('user').id, code, new Date())
    return c.json(data, 200)
  })
  .openapi(friendDashboardRoute, async (c) => {
    const { friendUserId } = c.req.valid('param')
    const data = await friendsService.getFriendDashboard(
      db,
      c.get('user').id,
      friendUserId,
      new Date(),
    )
    return c.json(data, 200)
  })
