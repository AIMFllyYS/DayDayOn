import { type NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from '@/server/auth/cookie'

/*
 * 提前跳转登录页（auth.md 第 5 节）：只看会话 cookie 是否存在，不校验会话。
 * 这不是安全检查，真正的校验在页面（requireUser）和接口（requireUser 中间件）里。
 */

/** 不需要登录的页面（PRD 7.1：/privacy 在 (auth) 组，不要求登录） */
const PUBLIC_PREFIXES = ['/login', '/privacy', '/offline', '/dev']

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (isPublic(pathname)) return NextResponse.next()
  if (getSessionCookie(request)) return NextResponse.next()
  const url = new URL('/login', request.url)
  if (pathname !== '/') url.searchParams.set('next', `${pathname}${search}`)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    // 排除接口（自己返回 401）、Next 静态资源与 public 下的文件（带扩展名的路径）
    '/((?!api/|_next/|favicon.ico|manifest.webmanifest|sw.js|.*\\.[a-zA-Z0-9]+$).*)',
  ],
}
