import type { TodayGoal } from '@/features/checkin/schemas'
import { parseLocalDate } from '@/lib/time'

/*
 * 主页的显示换算（api-conventions.md 第 5 节：单位换算只在界面层做）。纯函数，前后端通用。
 */

/** 克 → '52.4'（千克一位小数） */
export function formatKg(grams: number): string {
  return (Math.round(grams / 100) / 10).toFixed(1)
}

/** 体重差值 → '−0.6' / '+0.4' / '0.0'（用真正的减号） */
export function formatKgDelta(grams: number): string {
  const tenths = Math.round(grams / 100)
  if (tenths === 0) return '0.0'
  const abs = (Math.abs(tenths) / 10).toFixed(1)
  return tenths < 0 ? `−${abs}` : `+${abs}`
}

/** 一位小数，整数不带 .0：7.2、8 */
function oneDecimal(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

/**
 * 今日进度的文字：'32 / 30 分钟'、'7.2 / 8 小时'、'2 / 3 餐'、'1 / 2 次'。
 * 时长类目标量达到 1 小时且是整点或半点时按小时显示（睡眠），其余按分钟。
 */
export function progressText(goal: Pick<TodayGoal, 'module' | 'target' | 'progress'>): string {
  const { value, target } = goal.progress
  if (goal.target.kind === 'duration') {
    if (target >= 3600 && target % 1800 === 0) {
      return `${oneDecimal(value / 3600)} / ${oneDecimal(target / 3600)} 小时`
    }
    return `${Math.floor(value / 60)} / ${Math.round(target / 60)} 分钟`
  }
  return `${value} / ${target} ${goal.module === 'diet' ? '餐' : '次'}`
}

/** 打卡日 → 印章下方的小字 '11.01' */
export function stampCaption(localDate: string): string {
  const { month, day } = parseLocalDate(localDate)
  return `${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`
}

/** 心情 1–5 的文字，与 Rating 组件的档位一致 */
const MOOD_LABELS = ['很糟', '不太好', '一般', '不错', '超棒'] as const
export function moodLabel(value: number): string {
  return MOOD_LABELS[value - 1] ?? '—'
}

/** 体重走势的读屏摘要：'近 30 天体重，从 53.0 到 52.4 千克' */
export function weightTrendLabel(gramsAsc: readonly number[]): string {
  const first = gramsAsc[0]
  const last = gramsAsc.at(-1)
  if (first === undefined || last === undefined) return '近 30 天还没有体重记录'
  if (gramsAsc.length === 1) return `近 30 天只记录了一次体重：${formatKg(last)} 千克`
  return `近 30 天体重，从 ${formatKg(first)} 到 ${formatKg(last)} 千克`
}

/** 完成度百分比（取整）；今天没有计划时为 null */
export function completionPercent(c: { done: number; planned: number }): number | null {
  if (c.planned <= 0) return null
  return Math.round((c.done / c.planned) * 100)
}

/** 总览卡的标题 */
export function summaryTitle(c: { done: number; planned: number }): string {
  if (c.planned === 0) return '今天没有安排，歇一歇也好'
  if (c.done >= c.planned) return '今天的目标都完成啦'
  if (c.done === 0) return '新的一天，从一小步开始'
  return '今天也在好好生活'
}
