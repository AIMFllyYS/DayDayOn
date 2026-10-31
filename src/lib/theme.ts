import { useSyncExternalStore } from 'react'

/*
 * 主题色：用户可选的品牌主色。色值在 globals.css 的 [data-theme] 块里，这里只有 id 和名称。
 * 只换主色这一组（按钮、当前态、开关、焦点环），板块色和状态色不随主题变（ui-design-system.md 第 2 节）。
 *
 * 现在偏好只存在本机 localStorage；接入账号后改为存到用户设置，并在根布局里提前写好 data-theme，避免闪一下默认色。
 */
export const themes = [
  { id: 'caramel', label: '奶茶焦糖', note: '默认：暖、稳，像一杯热奶茶' },
  { id: 'terracotta', label: '陶土红', note: '有精神，但不刺眼' },
  { id: 'matcha', label: '抹茶绿', note: '安静、清爽' },
  { id: 'haze', label: '雾霾蓝', note: '冷静，适合学习党' },
  { id: 'berry', label: '莓果紫', note: '柔和、甜一点' },
] as const

export type ThemeId = (typeof themes)[number]['id']

export const defaultTheme: ThemeId = 'caramel'

const STORAGE_KEY = 'daydayon:theme:v1'
const listeners = new Set<() => void>()

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && themes.some((t) => t.id === v)
}

function readTheme(): ThemeId {
  const v = document.documentElement.dataset.theme
  return isThemeId(v) ? v : defaultTheme
}

export function setTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id
  try {
    window.localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // 隐私模式或禁用存储时只在本次会话生效
  }
  listeners.forEach((l) => l())
}

/** 页面加载后恢复上次选的主题 */
export function restoreTheme() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (isThemeId(saved) && saved !== readTheme()) setTheme(saved)
  } catch {
    // 读不到就用默认主题
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 当前主题；服务端渲染时返回默认主题 */
export function useTheme(): ThemeId {
  return useSyncExternalStore(subscribe, readTheme, () => defaultTheme)
}
