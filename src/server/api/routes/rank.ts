import 'server-only'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { FeedSchema, RankBoardSchema, RankQuerySchema } from '@/features/rank/schemas'
import { db } from '@/server/db/client'
import { getRankBoard, getRankFeed } from '@/server/services/rank'
import type { AppEnv } from '../app'
import { requireOnboarded, requireUser } from '../middleware/auth'
import { AUTH_ERRORS, errorResponses } from '../schemas'

/*
 * 排行榜与榜单动态（PRD 2.8 第 5 项、2.9、7.2）。D4。
 * 只返回昵称、头像、打卡天数、连续天数、板块和时间；体重、饮食、睡眠的数值一律不出现。
 *
 *   GET    /rank               ?range=week|month → RankBoardSchema（非法值 400）
 *   GET    /rank/feed          FeedSchema
 */

const getBoard = createRoute({
  method: 'get',
  path: '/rank',
  tags: ['rank'],
  summary: '排行榜 + 我的位置',
  middleware: [requireUser, requireOnboarded] as const,
  request: { query: RankQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: RankBoardSchema } },
      description: '北京时间本周 / 本月的上榜用户，最多 50 名',
    },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED'),
  },
})

const getFeed = createRoute({
  method: 'get',
  path: '/rank/feed',
  tags: ['rank'],
  summary: '榜单动态',
  middleware: [requireUser, requireOnboarded] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: FeedSchema } },
      description: '已上榜用户最近 24 小时的打卡事件，最多 10 条',
    },
    ...errorResponses(...AUTH_ERRORS),
  },
})

export const rankRoutes = new OpenAPIHono<AppEnv>()
  .openapi(getBoard, async (c) => {
    const { range } = c.req.valid('query')
    const board = await getRankBoard(db, c.get('user').id, range, new Date())
    return c.json(board, 200)
  })
  .openapi(getFeed, async (c) => {
    const feed = await getRankFeed(db, new Date())
    return c.json(feed, 200)
  })
