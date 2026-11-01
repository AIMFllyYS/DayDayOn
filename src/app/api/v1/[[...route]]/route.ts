import { app } from '@/server/api/app'

// 只把请求转给 Hono，不写任何逻辑（api-conventions.md 第 2 节）。读取了 request，不会被预渲染
const handler = (request: Request) => app.fetch(request)

export { handler as DELETE, handler as GET, handler as PATCH, handler as POST, handler as PUT }
