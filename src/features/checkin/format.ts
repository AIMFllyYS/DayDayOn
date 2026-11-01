import type { Checkin, GoalProgress, Intensity, MealType } from '@/features/checkin/schemas'
import type { FieldDef, Target } from '@/features/goal/schemas'
import { formatDuration } from '@/lib/time'

/*
 * 打卡的界面文案（单位换算只在界面层做：秒 → 分钟 / 小时，api-conventions.md 第 5 节）。纯函数，带单测。
 */

export const intensityLabel: Record<Intensity, string> = {
  easy: '轻松',
  moderate: '适中',
  hard: '吃力',
}

export const mealLabel: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
}

/** 目标量："每天 30分钟" / "每天 3 次" */
export function targetText(target: Target): string {
  return target.kind === 'duration'
    ? `每天 ${formatDuration(target.value)}`
    : `每天 ${target.value} 次`
}

/** 进度："32分钟 / 30分钟"、"1 / 3 次" */
export function progressText(kind: Target['kind'], p: GoalProgress): string {
  return kind === 'duration'
    ? `${formatDuration(p.value)} / ${formatDuration(p.target)}`
    : `${p.value} / ${p.target} 次`
}

/** 打卡弹层一行的状态文字 */
export function rowStatusText(kind: Target['kind'], p: GoalProgress): string {
  if (p.done) return `已完成 · ${progressText(kind, p)}`
  if (p.value === 0) return '今天还没记'
  return progressText(kind, p)
}

function customValueText(field: FieldDef | undefined, value: unknown): string {
  if (Array.isArray(value)) return value.join('、')
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'number' && field?.type === 'duration') return formatDuration(value)
  if (typeof value === 'number' && field?.type === 'rating') return `${value} 分`
  if (typeof value === 'number' && field?.type === 'number' && field.unit)
    return `${value} ${field.unit}`
  return String(value)
}

/** 历史列表的一句话摘要；自定义打卡按当时的字段版本取字段名 */
export function checkinSummary(c: Checkin, fields?: readonly FieldDef[] | null): string {
  const p = c.payload
  switch (p.module) {
    case 'exercise': {
      const kcal = c.burnKcal === null ? '' : ` · 约 ${c.burnKcal} 千卡`
      return `${p.category} ${formatDuration(c.durationSeconds ?? 0)} · ${intensityLabel[p.intensity]}${kcal}`
    }
    case 'diet': {
      const names = p.items.map((i) => i.name).join('、')
      const kcal = c.intakeKcal === null ? '' : ` · ${c.intakeKcal} 千卡`
      return `${mealLabel[p.mealType]}：${names}${kcal}`
    }
    case 'sleep':
      return `睡了 ${formatDuration(c.durationSeconds ?? 0)} · 质量 ${p.quality} 分`
    case 'study':
      return c.durationSeconds === null
        ? p.what
        : `${p.what} · ${formatDuration(c.durationSeconds)}`
    case 'custom': {
      const byKey = new Map((fields ?? []).map((f) => [f.key, f]))
      const parts = Object.entries(p.values).map(([key, v]) => {
        const f = byKey.get(key)
        return `${f?.label ?? key} ${customValueText(f, v)}`
      })
      return parts.length === 0 ? '记了一笔' : parts.join(' · ')
    }
  }
}

/** 千克一位小数 ↔ 克 */
export function kgToGrams(kg: number): number {
  return Math.round(kg * 10) * 100
}

export function gramsToKg(grams: number): number {
  return Math.round(grams / 100) / 10
}
