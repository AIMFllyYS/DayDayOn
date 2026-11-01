/*
 * src/proxy.ts 的跳转规则（routing.md 第 2 节、ADR-0022）。纯函数，带单测。
 * 只按"会话 cookie 是否存在"判断，不校验会话；真正的校验在页面和接口里（auth.md 第 5 节）。
 */

/** 不需要登录的页面：落地页、登录、隐私说明、离线页、调试区 */
export const PUBLIC_PREFIXES = ['/welcome', '/login', '/privacy', '/offline', '/dev'] as const

/** 未登录时打开根路径 `/`，统一先看落地页（浏览器、已安装的 PWA、APK 壳都一样） */
export const WELCOME_PATH = '/welcome'

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * 返回要跳转去的站内地址；null 表示放行。
 * - 公开页面、已有会话 cookie：放行
 * - 未登录打开 `/`：去落地页
 * - 未登录打开其他页面（深链接）：去登录页，登录后回到原地址
 */
export function entryRedirect(
  pathname: string,
  search: string,
  hasSession: boolean,
): string | null {
  if (isPublicPath(pathname) || hasSession) return null
  if (pathname === '/') return WELCOME_PATH
  return `/login?${new URLSearchParams({ next: `${pathname}${search}` }).toString()}`
}
