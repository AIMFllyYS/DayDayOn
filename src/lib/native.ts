/*
 * 运行环境识别（ADR-0022）：浏览器、已安装的 PWA、自家 APK 壳。前后端通用的纯函数。
 * APK 壳在 WebView 的 User-Agent 末尾追加 `DayDayOnApp/<版本号>`，网页靠它识别自己跑在壳里。
 * 以后原生桥接（Kotlin 组件）的入口也放在这里，业务代码不直接读 UA 或 window 上的桥对象。
 */

/** APK 壳追加在 User-Agent 里的标识，Kotlin 侧必须保持一致 */
export const NATIVE_UA_TOKEN = 'DayDayOnApp/'

export function isNativeShellUA(userAgent: string): boolean {
  return userAgent.includes(NATIVE_UA_TOKEN)
}

export type ClientPlatform = 'native' | 'standalone' | 'android' | 'ios' | 'desktop'

/** 由 UA 和是否以独立窗口运行判断平台；APK 壳优先，其次是已安装的 PWA */
export function detectPlatform(userAgent: string, standalone: boolean): ClientPlatform {
  if (isNativeShellUA(userAgent)) return 'native'
  if (standalone) return 'standalone'
  if (/Android/i.test(userAgent)) return 'android'
  // iPadOS 13 起默认用桌面 UA，靠触控点数区分不了，这里只认 iPhone / iPad / iPod
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios'
  return 'desktop'
}

/** 浏览器里取当前平台；只在客户端调用 */
export function currentPlatform(): ClientPlatform {
  const nav = window.navigator as Navigator & { standalone?: boolean }
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
  return detectPlatform(nav.userAgent, standalone)
}
