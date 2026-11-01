'use client'

import { useEffect } from 'react'
import type { Me } from '@/features/me/schemas'
import { apiFetch, keys, useQuery } from '@/lib/api'
import { rememberSplashMascot } from '@/lib/splash'
import { isThemeId, setTheme } from '@/lib/theme'

/**
 * 登录后把账号里的主题同步到本机（PRD 7.1）：首帧由根布局的内联脚本按 localStorage 着色，
 * 这里在 GET /me 返回后调 setTheme()，换设备登录也能用上自己的主题；顺带把形象记到本机给开屏用。
 * query key 与 D1 的 me 查询共用 keys.me.detail()，响应形状同为 MeSchema，两边命中同一份缓存。
 */
export function ThemeSync() {
  const { data } = useQuery({
    queryKey: keys.me.detail(),
    queryFn: () => apiFetch<Me>('/me'),
  })
  const theme = data?.preferences.theme
  const mascot = data?.preferences.mascot
  useEffect(() => {
    if (isThemeId(theme)) setTheme(theme)
  }, [theme])
  // 记住形象，下次开屏用同一只（ADR-0022）
  useEffect(() => {
    if (mascot) rememberSplashMascot(mascot)
  }, [mascot])
  return null
}
