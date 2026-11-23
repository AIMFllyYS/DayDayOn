import type { PaletteColor, PosterFonts, PosterPalette } from './types'

/* 调色板与字体栈：运行时从 globals.css 的 token 读取（跟随主题色），读不到时退回默认奶茶焦糖。 */

export const DEFAULT_PALETTE: PosterPalette = {
  background: '#fff8f0',
  surface: '#fffdf9',
  surfaceSunken: '#f8eee2',
  foreground: '#4a3f35',
  muted: '#7a6a5b',
  subtle: '#a8998a',
  border: '#eadccb',
  borderStrong: '#dcc8b2',
  primary: { base: '#93603f', soft: '#f3e2cf', ink: '#6b3f26' },
  tones: {
    primary: { base: '#93603f', soft: '#f3e2cf', ink: '#6b3f26' },
    exercise: { base: '#7cc9a6', soft: '#e1f4ea', ink: '#2c6a50' },
    diet: { base: '#f5c95e', soft: '#fdf2d2', ink: '#7a5608' },
    sleep: { base: '#a99de6', soft: '#ece8fb', ink: '#4a3f8c' },
    study: { base: '#86bde8', soft: '#e1eefa', ink: '#24578a' },
    custom: { base: '#f2a0b8', soft: '#fce6ed', ink: '#8c3553' },
    success: { base: '#4fae7f', soft: '#def3e7', ink: '#23663f' },
    warning: { base: '#e8a33d', soft: '#fcefd6', ink: '#7d5208' },
    danger: { base: '#e06464', soft: '#fde3e1', ink: '#9b2d2d' },
    neutral: { base: '#a8998a', soft: '#f8eee2', ink: '#7a6a5b' },
  },
}

export function readPaletteFromDom(): PosterPalette {
  if (typeof window === 'undefined' || typeof document === 'undefined') return DEFAULT_PALETTE
  const cs = window.getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback
  const primary: PaletteColor = {
    base: v('--primary', DEFAULT_PALETTE.primary.base),
    soft: v('--primary-soft', DEFAULT_PALETTE.primary.soft),
    ink: v('--primary-ink', DEFAULT_PALETTE.primary.ink),
  }
  return {
    background: v('--background', DEFAULT_PALETTE.background),
    surface: v('--surface', DEFAULT_PALETTE.surface),
    surfaceSunken: v('--surface-sunken', DEFAULT_PALETTE.surfaceSunken),
    foreground: v('--foreground', DEFAULT_PALETTE.foreground),
    muted: v('--muted', DEFAULT_PALETTE.muted),
    subtle: v('--subtle', DEFAULT_PALETTE.subtle),
    border: v('--border', DEFAULT_PALETTE.border),
    borderStrong: v('--border-strong', DEFAULT_PALETTE.borderStrong),
    primary,
    tones: { ...DEFAULT_PALETTE.tones, primary },
  }
}

export function getFontStacks(): PosterFonts {
  const fallbackSans =
    "'PingFang SC', 'HarmonyOS Sans SC', 'MiSans', 'Microsoft YaHei', system-ui, sans-serif"
  if (typeof window === 'undefined') return { sans: fallbackSans, display: fallbackSans }
  const sans = window.getComputedStyle(document.body).fontFamily || fallbackSans
  const display =
    window.getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim() ||
    sans
  return { sans, display }
}

/** #rrggbb + 透明度 → rgba()；非 6 位十六进制（如主题返回 oklch）时用 color-mix 兜底 */
export function alpha(color: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim())
  if (!m) return `color-mix(in srgb, ${color} ${Math.round(a * 100)}%, transparent)`
  const n = parseInt(m[1]!, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
