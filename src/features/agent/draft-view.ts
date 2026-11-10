import { checkinSummary, intensityLabel, mealLabel } from '@/features/checkin/format'
import type { Checkin } from '@/features/checkin/schemas'
import type { FieldDef } from '@/features/goal/schemas'
import type { Verdict } from '@/features/referee/schemas'
import { formatDateTime, formatDuration } from '@/lib/time'
import type { DraftField, DraftItem, DraftSnapshot, DraftVerdict } from './schemas'

/*
 * 打卡草稿卡上显示什么（Agent 草稿工具在服务端调用，纯函数，带单测）：
 * 只读字段、饮食可编辑条目、裁判结论预览、改前改后的一句话快照。
 */

export function verdictPreview(v: Verdict): DraftVerdict {
  const mealsLogged = typeof v.metrics.mealsLogged === 'number' ? v.metrics.mealsLogged : undefined
  const mealsRequired =
    typeof v.metrics.mealsRequired === 'number' ? v.metrics.mealsRequired : undefined
  return {
    isValid: v.isValid,
    ...(v.settlement ? { settlement: v.settlement } : {}),
    ...(mealsLogged !== undefined ? { mealsLogged } : {}),
    ...(mealsRequired !== undefined ? { mealsRequired } : {}),
    score: v.score,
    scoreMax: v.scoreMax,
    detail: v.detail,
    offline: v.offline,
    checks: v.checks.slice(0, 8).map((c) => ({ text: c.text, ok: c.ok })),
    advice: v.advice.slice(0, 3),
  }
}

export function snapshotOf(c: Checkin, fields?: readonly FieldDef[] | null): DraftSnapshot {
  return {
    summary: checkinSummary(c, fields),
    note: c.note,
    isValid: c.isValid,
    score: c.score,
  }
}

function customText(f: FieldDef | undefined, v: unknown): string {
  if (Array.isArray(v)) return v.join('、')
  if (typeof v === 'boolean') return v ? '是' : '否'
  if (typeof v === 'number' && f?.type === 'duration') return formatDuration(v)
  if (typeof v === 'number' && f?.type === 'number' && f.unit) return `${v} ${f.unit}`
  return String(v)
}

export interface DraftFieldsOptions {
  /** 饮食逐菜列出（改打卡卡片只读展示用；新增草稿的菜品走 draftItemsOf，可编辑） */
  dietItems?: boolean
  /** 末尾带上备注（改打卡卡片的快照里已经有备注时关掉） */
  note?: boolean
}

/** 只读字段 */
export function draftFieldsOf(
  c: Checkin,
  timeZone: string,
  fields?: readonly FieldDef[] | null,
  options: DraftFieldsOptions = {},
): DraftField[] {
  const { dietItems = false, note = true } = options
  const p = c.payload
  const out: DraftField[] = []
  switch (p.module) {
    case 'exercise': {
      const items = p.items ?? []
      if (items.length === 0) {
        out.push({ label: '运动', value: p.category })
        out.push({ label: '时长', value: formatDuration(c.durationSeconds ?? 0) })
        out.push({ label: '强度', value: intensityLabel[p.intensity] })
      }
      for (const it of items) {
        const amount =
          it.calc === 'distance'
            ? it.km
              ? ` · ${it.km} 公里`
              : ''
            : it.sets
              ? ` · ${it.sets} 组`
              : ''
        out.push({
          label: it.name,
          value: `${Math.round(it.minutes)} 分钟${amount}`,
          ...(it.kcal !== null ? { hint: `设备记录 ${it.kcal} 千卡` } : {}),
        })
      }
      if (c.burnKcal !== null) out.push({ label: '估算消耗', value: `约 ${c.burnKcal} 千卡` })
      break
    }
    case 'diet':
      out.push({
        label: '餐次',
        value: p.snackTime ? `${mealLabel[p.mealType]} ${p.snackTime}` : mealLabel[p.mealType],
      })
      if (dietItems) {
        for (const it of p.items) {
          out.push({
            label: it.name,
            value: it.kcal === null ? '— kcal' : `${it.kcal} kcal`,
            ...(it.portion ? { hint: it.portion } : {}),
          })
        }
      }
      break
    case 'sleep':
      out.push({ label: '入睡', value: formatDateTime(p.bedAt, timeZone) })
      out.push({ label: '起床', value: formatDateTime(p.wakeAt, timeZone) })
      out.push({ label: '时长', value: formatDuration(c.durationSeconds ?? 0) })
      out.push({ label: '质量', value: `${p.quality}/5` })
      break
    case 'study':
      out.push({ label: '内容', value: p.what })
      if (c.durationSeconds !== null) {
        out.push({ label: '专注', value: formatDuration(c.durationSeconds) })
      }
      for (const [i, point] of (p.points ?? []).entries()) {
        out.push({ label: `要点 ${i + 1}`, value: point })
      }
      break
    case 'custom': {
      const byKey = new Map((fields ?? []).map((f) => [f.key, f]))
      for (const [key, v] of Object.entries(p.values)) {
        const f = byKey.get(key)
        out.push({ label: f?.label ?? key, value: customText(f, v) })
      }
      break
    }
  }
  if (note && c.note) out.push({ label: '备注', value: c.note })
  return out
}

/** 饮食草稿的可编辑条目（前端临时 id） */
export function draftItemsOf(c: Checkin, seed = Date.now()): DraftItem[] | undefined {
  if (c.payload.module !== 'diet') return undefined
  const prefix = `draft-${seed.toString(36)}`
  return c.payload.items.map((it, i) => ({
    id: `${prefix}-${i}`,
    name: it.name,
    portion: it.portion,
    kcal: it.kcal,
  }))
}
