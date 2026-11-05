import * as z from 'zod'
import {
  DietItemSchema,
  ExerciseItemSchema,
  MealTypeSchema,
  SleepAdvancedSchema,
  StudyPointsSchema,
  type Checkin,
  type CreateCheckinInput,
} from '@/features/checkin/schemas'
import { FieldValueSchema } from '@/features/goal/schemas'
import { detectCalc } from '@/features/referee/rules/exercise'
import { CitationSchema, FactsSchema } from '@/features/referee/schemas'
import { LocalTimeSchema, RatingValueSchema } from '@/features/shared/schemas'

/*
 * Agent 对话里「一条打卡的内容」（checkin-modules.md 第 8 节）。字段与打卡页整页稿一致，
 * 由 entryToCreateInput 换成普通创建打卡接口的请求体：新增和修改打卡共用这一份形状，
 * 保证对话里记的和打卡页记的是同一种数据，裁判也按同一套规则判。纯函数，带单测。
 */

export const ExerciseEntrySchema = z.object({
  module: z.literal('exercise'),
  items: z
    .array(ExerciseItemSchema)
    .min(1)
    .max(10)
    .describe(
      '每项运动：name 运动名；calc 计量方式 distance=时间+距离 / count=时间+组数；minutes 分钟；km、sets 按计量方式填，另一个填 null；kcal 只有手表 / App 给了才填',
    ),
})

export const DietEntrySchema = z.object({
  module: z.literal('diet'),
  mealType: MealTypeSchema,
  /** 加餐时间 HH:mm，只有加餐填 */
  snackTime: LocalTimeSchema.optional(),
  /** 照片识别来的填 photo */
  method: z.enum(['photo', 'manual']).default('manual'),
  items: z
    .array(DietItemSchema)
    .min(1)
    .max(20)
    .describe('每道菜：name、portion（如「一碗约 250 克」）、kcal 这一份的热量'),
})

export const SleepEntrySchema = z.object({
  module: z.literal('sleep'),
  bedAt: z.string().describe('入睡时刻，UTC ISO 8601（以 Z 结尾）'),
  wakeAt: z.string().describe('起床时刻，UTC ISO 8601（以 Z 结尾）'),
  quality: RatingValueSchema.describe('睡眠质量 1–5'),
  advanced: SleepAdvancedSchema.optional().describe('手环截图里有深睡、REM 等指标时才填'),
})

export const StudyEntrySchema = z.object({
  module: z.literal('study'),
  what: z.string().trim().min(1).max(60).describe('学了什么（主题）'),
  durationMinutes: z.number().int().min(1).max(1440).optional(),
  points: StudyPointsSchema.optional().describe('学到的要点，逐条'),
})

export const CustomEntrySchema = z.object({
  module: z.literal('custom'),
  values: z
    .record(z.string(), FieldValueSchema)
    .describe('键是 listGoals 返回的 fields[].key；时长字段填秒'),
})

export const CheckinEntrySchema = z.discriminatedUnion('module', [
  ExerciseEntrySchema,
  DietEntrySchema,
  SleepEntrySchema,
  StudyEntrySchema,
  CustomEntrySchema,
])
export type CheckinEntry = z.infer<typeof CheckinEntrySchema>

/** 裁判事实与附加信息（和打卡页 Agent 裁判交卷的格式一样） */
export const EntryRefereeSchema = z.object({
  facts: FactsSchema.optional().describe('按本板块事实格式填；module 必须和 entry 一致'),
  citations: z.array(CitationSchema).max(5).optional(),
  advice: z.array(z.string().trim().min(1).max(80)).max(2).optional(),
})
export type EntryReferee = z.infer<typeof EntryRefereeSchema>

export interface EntryContext {
  /** 自定义目标当前的字段版本 */
  fieldVersion: number | null
  note?: string | null
  isMakeup?: boolean
}

/** 对话里的打卡内容 → 创建打卡请求体（origin = agent；校验交给 CreateCheckinSchema） */
export function entryToCreateInput(
  entry: CheckinEntry,
  ctx: EntryContext,
  referee: EntryReferee = {},
): CreateCheckinInput {
  const base = {
    isMakeup: ctx.isMakeup ?? false,
    ...(ctx.note !== undefined ? { note: ctx.note } : {}),
    source: 'manual' as const,
    origin: 'agent' as const,
    ...(referee.facts ? { facts: referee.facts } : {}),
    ...(referee.citations && referee.citations.length > 0 ? { citations: referee.citations } : {}),
    ...(referee.advice && referee.advice.length > 0 ? { advice: referee.advice } : {}),
  }
  switch (entry.module) {
    case 'exercise': {
      const minutes = entry.items.reduce((s, i) => s + i.minutes, 0)
      return {
        ...base,
        module: 'exercise',
        category: entry.items[0]!.name.trim().slice(0, 10),
        intensity: 'moderate',
        durationSeconds: Math.max(60, Math.min(36_000, Math.round(minutes * 60))),
        items: entry.items.map((i) => ({
          ...i,
          km: i.calc === 'distance' ? (i.km ?? null) : null,
          sets: i.calc === 'count' ? (i.sets ?? null) : null,
        })),
      }
    }
    case 'diet':
      return {
        ...base,
        module: 'diet',
        method: entry.method,
        mealType: entry.mealType,
        items: entry.items,
        ...(entry.mealType === 'snack' && entry.snackTime ? { snackTime: entry.snackTime } : {}),
      }
    case 'sleep': {
      const bed = new Date(entry.bedAt)
      const wake = new Date(entry.wakeAt)
      return {
        ...base,
        module: 'sleep',
        bedAt: Number.isNaN(bed.getTime()) ? entry.bedAt : bed.toISOString(),
        wakeAt: Number.isNaN(wake.getTime()) ? entry.wakeAt : wake.toISOString(),
        quality: entry.quality,
        ...(entry.advanced ? { advanced: entry.advanced } : {}),
      }
    }
    case 'study':
      return {
        ...base,
        module: 'study',
        what: entry.what,
        ...(entry.durationMinutes !== undefined
          ? { durationSeconds: entry.durationMinutes * 60 }
          : {}),
        ...(entry.points && entry.points.length > 0 ? { points: entry.points } : {}),
      }
    case 'custom':
      return {
        ...base,
        module: 'custom',
        fieldVersion: ctx.fieldVersion ?? 0,
        values: entry.values,
      }
  }
}

/**
 * 已存的打卡 → 对话里的打卡内容。Agent 改打卡时先拿到这一份，改其中几项后原样交回
 * draftUpdateCheckin，不用自己拼整份请求体。
 */
export function checkinToEntry(c: Pick<Checkin, 'payload' | 'durationSeconds'>): CheckinEntry {
  const p = c.payload
  switch (p.module) {
    case 'exercise': {
      const items =
        p.items && p.items.length > 0
          ? p.items
          : [
              ExerciseItemSchema.parse({
                name: p.category,
                calc: detectCalc(p.category) ?? 'distance',
                minutes: Math.max(1, Math.round((c.durationSeconds ?? 60) / 60)),
              }),
            ]
      return { module: 'exercise', items }
    }
    case 'diet':
      return {
        module: 'diet',
        mealType: p.mealType,
        method: p.method,
        items: p.items,
        ...(p.snackTime ? { snackTime: p.snackTime } : {}),
      }
    case 'sleep':
      return {
        module: 'sleep',
        bedAt: p.bedAt,
        wakeAt: p.wakeAt,
        quality: p.quality,
        ...(p.advanced ? { advanced: p.advanced } : {}),
      }
    case 'study':
      return {
        module: 'study',
        what: p.what,
        ...(c.durationSeconds !== null
          ? { durationMinutes: Math.max(1, Math.round(c.durationSeconds / 60)) }
          : {}),
        ...(p.points && p.points.length > 0 ? { points: p.points } : {}),
      }
    case 'custom':
      return { module: 'custom', values: p.values }
  }
}

/**
 * 事实和内容对得上吗（返回问题描述，对得上返回 null）。对不上时交给模型重填，
 * 不要让一份错位的事实把分数算歪。
 */
export function factsMismatch(entry: CheckinEntry, referee: EntryReferee): string | null {
  const facts = referee.facts
  if (!facts) return null
  if (facts.module !== entry.module)
    return `facts.module 是 ${facts.module}，内容是 ${entry.module}`
  if (
    facts.module === 'diet' &&
    entry.module === 'diet' &&
    facts.dishes.length !== entry.items.length
  ) {
    return `facts.dishes 有 ${facts.dishes.length} 道，items 有 ${entry.items.length} 道，要一一对应`
  }
  if (
    facts.module === 'exercise' &&
    entry.module === 'exercise' &&
    facts.items.length !== entry.items.length
  ) {
    return `facts.items 有 ${facts.items.length} 项，entry.items 有 ${entry.items.length} 项，要一一对应`
  }
  return null
}
