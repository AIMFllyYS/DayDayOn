import 'server-only'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { AppUpdateQuerySchema, AppUpdateSchema } from '@/features/app-update/schemas'
import { checkAppUpdate } from '@/server/services/app-update'
import type { AppEnv } from '../app'
import { rateLimit } from '../middleware/rate-limit'
import { errorResponses } from '../schemas'

/*
 * 检查更新（download/README.md）。不需要登录：将来的原生客户端在登录前也要能检查。
 *
 *   GET    /app/update?web=0.1.3&shell=0.1.0    AppUpdateSchema
 */

const getUpdate = createRoute({
  method: 'get',
  path: '/app/update',
  tags: ['app'],
  summary: '检查更新：对比页面版本、壳版本与服务器上的版本清单',
  // 公开接口：按 IP 限流，防止被拿来刷
  middleware: [
    rateLimit({ rule: { name: 'app-update-minute', windowSeconds: 60, max: 30 }, by: 'ip' }),
  ] as const,
  request: { query: AppUpdateQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: AppUpdateSchema } },
      description:
        'kind = none / reload / install，附比当前版本新的更新日志（Markdown）与安装包地址',
    },
    ...errorResponses('VALIDATION_FAILED', 'RATE_LIMITED'),
  },
})

export const appRoutes = new OpenAPIHono<AppEnv>().openapi(getUpdate, async (c) => {
  const q = c.req.valid('query')
  const data = await checkAppUpdate({ web: q.web, ...(q.shell ? { shell: q.shell } : {}) })
  c.header('Cache-Control', 'no-store')
  return c.json(data, 200)
})
