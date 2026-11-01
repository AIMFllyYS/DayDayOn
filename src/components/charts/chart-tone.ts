import type { Tone } from '@/components/ui/tone'

/*
 * 图表里 SVG 的填充色。描边色复用 tone.ts 的 strokeToneClass。
 * 类名写完整字符串，Tailwind 才扫描得到。
 */
export const fillToneClass: Record<Tone, string> = {
  neutral: 'fill-border-strong',
  primary: 'fill-primary',
  success: 'fill-success',
  warning: 'fill-warning',
  danger: 'fill-danger',
  exercise: 'fill-exercise',
  diet: 'fill-diet',
  sleep: 'fill-sleep',
  study: 'fill-study',
  custom: 'fill-custom',
}

/** 数值的默认显示：最多一位小数 */
export function defaultFormat(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}
