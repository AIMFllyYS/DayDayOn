import type { IconName } from './icon'

/*
 * 色调（tone）是组件着色的唯一入口：板块色 + 状态色 + 中性色。
 * 类名必须写成完整字符串，Tailwind 才能扫描到，不要拼接 `bg-${tone}`。
 */
export type ModuleTone = 'exercise' | 'diet' | 'sleep' | 'study' | 'custom'
export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | ModuleTone

/** soft 底 + ink 字：徽章、图标底座、提示条 */
export const softToneClass: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-muted',
  primary: 'bg-primary-soft text-primary-ink',
  success: 'bg-success-soft text-success-ink',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger-ink',
  exercise: 'bg-exercise-soft text-exercise-ink',
  diet: 'bg-diet-soft text-diet-ink',
  sleep: 'bg-sleep-soft text-sleep-ink',
  study: 'bg-study-soft text-study-ink',
  custom: 'bg-custom-soft text-custom-ink',
}

/** 实色填充：进度条、圆环、小圆点 */
export const solidToneClass: Record<Tone, string> = {
  neutral: 'bg-border-strong',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  exercise: 'bg-exercise',
  diet: 'bg-diet',
  sleep: 'bg-sleep',
  study: 'bg-study',
  custom: 'bg-custom',
}

/** SVG 描边色（进度圆环） */
export const strokeToneClass: Record<Tone, string> = {
  neutral: 'stroke-border-strong',
  primary: 'stroke-primary',
  success: 'stroke-success',
  warning: 'stroke-warning',
  danger: 'stroke-danger',
  exercise: 'stroke-exercise',
  diet: 'stroke-diet',
  sleep: 'stroke-sleep',
  study: 'stroke-study',
  custom: 'stroke-custom',
}

/** 板块的中文名和图标：所有出现板块的地方都从这里取，保证一致 */
export const moduleMeta: Record<ModuleTone, { label: string; icon: IconName }> = {
  exercise: { label: '运动', icon: 'exercise' },
  diet: { label: '饮食', icon: 'diet' },
  sleep: { label: '睡眠', icon: 'sleep' },
  study: { label: '学习', icon: 'study' },
  custom: { label: '自定义', icon: 'custom' },
}

export const moduleTones = Object.keys(moduleMeta) as ModuleTone[]
