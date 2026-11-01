import { type NextRequest, NextResponse } from 'next/server'
import { entryRedirect } from '@/lib/entry-redirect'
import { getSessionCookie } from '@/server/auth/cookie'

/*
 * 提前跳转（auth.md 第 5 节、ADR-0022）：只看会话 cookie 是否存在，不校验会话。
 * 这不是安全检查，真正的校验在页面（requireUser）和接口（requireUser 中间件）里。
 * 规则在 src/lib/entry-redirect.ts：未登录打开 / 去落地页 /welcome，打开其他页面去 /login?next=…
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const target = entryRedirect(pathname, search, getSessionCookie(request) !== null)
  if (target === null) return NextResponse.next()
  return NextResponse.redirect(new URL(target, request.url))
}

export const config = {
  matcher: [
    // 排除接口（自己返回 401）、Next 静态资源与 public 下的文件（带扩展名的路径）
    // icon / apple-icon 是 app/icon.tsx、app/apple-icon.tsx 生成的图标，地址可能不带扩展名
    '/((?!api/|_next/|icons/|icon|apple-icon|manifest.webmanifest|sw.js|.*\\.[a-zA-Z0-9]+$).*)',
  ],
}
