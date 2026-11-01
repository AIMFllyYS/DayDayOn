import { formatDuration } from '@/lib/time'
import type { FieldDef, FieldType, Target } from './schemas'

/*
 * 目标的界面层换算与文案（api-conventions.md 第 5 节：接口用秒，界面按分钟输入）。
 * 纯函数，前端共用，带单测。
 */

const WEEKDAY_NAMES = ['一', '二', '三', '四', '五', '六', '日'] as const

/** 星期选项：ISO 1 = 周一 … 7 = 周日 */
export const WEEKDAY_OPTIONS = WEEKDAY_NAMES.map((name, i) => ({ value: i + 1, label: name }))

/** 秒 → 分钟（界面输入用，四舍五入到整分钟） */
export function secondsToMinutes(seconds: number): number {
  return Math.round(seconds / 60)
}

/** 分钟 → 秒（提交前换算） */
export function minutesToSeconds(minutes: number): number {
  return Math.round(minutes * 60)
}

/** "每天 30分钟"里的目标量部分 */
export function formatTarget(target: Target): string {
  return target.kind === 'duration' ? formatDuration(target.value) : `${target.value} 次`
}

/** 计划星期：每天 / 工作日 / 周末 / 周一、三、五 */
export function formatWeekdays(weekdays: readonly number[]): string {
  const days = [...new Set(weekdays)].sort((a, b) => a - b)
  const key = days.join('')
  if (key === '1234567') return '每天'
  if (key === '12345') return '工作日'
  if (key === '67') return '周末'
  return `周${days.map((d) => WEEKDAY_NAMES[d - 1] ?? '').join('、')}`
}

/** 列表行的副标题：每天 · 30分钟 · 07:30 */
export function formatGoalPlan(goal: {
  target: Target
  weekdays: readonly number[]
  plannedTime: string | null
}): string {
  return [formatWeekdays(goal.weekdays), formatTarget(goal.target), goal.plannedTime]
    .filter(Boolean)
    .join(' · ')
}

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  number: '数字',
  text: '文字',
  'single-select': '单选',
  'multi-select': '多选',
  boolean: '是 / 否',
  duration: '时长',
  rating: '评分',
}

/**
 * 新字段的标识：f1、f2…，取现有最大序号 + 1。
 * 标识一旦生成就不再改，旧打卡记录按它取值；删除字段后序号也不复用。
 */
export function nextFieldKey(fields: readonly Pick<FieldDef, 'key'>[]): string {
  let max = 0
  for (const f of fields) {
    const m = /^f(\d+)$/.exec(f.key)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `f${max + 1}`
}

/** 切换字段类型时生成该类型的默认定义（保留标识、名称、是否必填） */
export function fieldOfType(
  type: FieldType,
  base: { key: string; label: string; required: boolean },
): FieldDef {
  switch (type) {
    case 'number':
      return { ...base, type, integer: false }
    case 'text':
      return { ...base, type, maxLength: 100 }
    case 'single-select':
    case 'multi-select':
      return { ...base, type, options: ['选项一', '选项二'] }
    case 'duration':
      return { ...base, type, maxSeconds: 86_400 }
    case 'boolean':
    case 'rating':
      return { ...base, type }
  }
}
