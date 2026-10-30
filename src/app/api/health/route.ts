import { connection } from 'next/server'

// 部署健康检查：必须在请求时执行，不能被预渲染成静态响应
export async function GET() {
  await connection()
  return Response.json(
    {
      ok: true,
      commit: process.env.APP_COMMIT_SHA ?? null,
      time: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
