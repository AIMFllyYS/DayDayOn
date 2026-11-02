import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/server/auth/auth'
import { handleCaptchaRequest } from '@/server/auth/captcha'

// Better Auth 处理器（auth.md 第 1 节）：/api/auth/* 的登录、会话、管理员操作，以及自托管人机验证 /api/auth/captcha
const handler = toNextJsHandler(auth)

function isCaptchaPath(request: Request): boolean {
  const { pathname } = new URL(request.url)
  return pathname === '/api/auth/captcha' || pathname === '/api/auth/captcha/'
}

export async function GET(request: Request): Promise<Response> {
  if (isCaptchaPath(request)) return handleCaptchaRequest(request)
  return handler.GET(request)
}

export async function POST(request: Request): Promise<Response> {
  if (isCaptchaPath(request)) return handleCaptchaRequest(request)
  return handler.POST(request)
}
