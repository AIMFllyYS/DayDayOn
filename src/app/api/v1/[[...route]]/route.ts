import { app } from '@/server/api/app'

// 只把请求转给 Hono，不写业务逻辑（api-conventions.md 第 2 节）。读取了 request，不会被预渲染
const handler = async (request: Request): Promise<Response> => {
  // 开发环境的 OpenAPI 文档（api-conventions.md 第 4 节）。生产环境不注册，落到 Hono 的 404
  if (process.env.NODE_ENV !== 'production' && request.method === 'GET') {
    const { OPENAPI_DOC_PATH, buildOpenApiDocument } = await import('@/server/api/openapi')
    if (new URL(request.url).pathname === OPENAPI_DOC_PATH) {
      return Response.json(buildOpenApiDocument())
    }
  }
  return app.fetch(request)
}

export { handler as DELETE, handler as GET, handler as PATCH, handler as POST, handler as PUT }
