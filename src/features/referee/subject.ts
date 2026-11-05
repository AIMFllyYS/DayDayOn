import type { CreateCheckinInput } from '@/features/checkin/schemas'
import type { FieldDef } from '@/features/goal/schemas'
import { localTimeOf, secondsBetween } from '@/lib/time'
import { detectCalc } from './rules/exercise'
import type { JudgeInput, SubjectByModule } from './rules'

/*
 * 创建打卡的请求体 → 裁判函数的输入（subject）。前端预览、Agent 裁判、服务端入库三处共用，
 * 保证三处看到的是同一份数据。只做形状转换，不做校验（校验在 CreateCheckinSchema）。
 */

export interface SubjectContext {
  /** 用户时区：睡眠的入睡 / 起床本地时刻按它换算 */
  timeZone: string
  /** 自定义目标当前版本的字段定义；其余板块为 null */
  fields: readonly FieldDef[] | null
}

type Subject = {
  [M in keyof SubjectByModule]: { module: M; subject: SubjectByModule[M] }
}[keyof SubjectByModule]

export function subjectOf(input: CreateCheckinInput, ctx: SubjectContext): Subject {
  switch (input.module) {
    case 'diet':
      return {
        module: 'diet',
        subject: {
          mealType: input.mealType,
          items: input.items.map((i) => ({
            name: i.name,
            portion: i.portion ?? '',
            kcal: i.kcal,
          })),
        },
      }
    case 'exercise': {
      const items =
        input.items && input.items.length > 0
          ? input.items.map((i) => ({
              name: i.name,
              calc: i.calc,
              minutes: i.minutes,
              km: i.km ?? null,
              sets: i.sets ?? null,
              kcal: i.kcal ?? null,
            }))
          : [
              {
                name: input.category,
                calc: detectCalc(input.category) ?? ('distance' as const),
                minutes: input.durationSeconds / 60,
                km: null,
                sets: null,
                kcal: null,
              },
            ]
      return { module: 'exercise', subject: { items } }
    }
    case 'sleep':
      return {
        module: 'sleep',
        subject: {
          bedLocal: localTimeOf(input.bedAt, ctx.timeZone),
          wakeLocal: localTimeOf(input.wakeAt, ctx.timeZone),
          minutes: Math.round(secondsBetween(input.bedAt, input.wakeAt) / 60),
        },
      }
    case 'study':
      return {
        module: 'study',
        subject: {
          topic: input.what,
          minutes: input.durationSeconds === undefined ? null : input.durationSeconds / 60,
          points: input.points ?? [],
        },
      }
    case 'custom':
      return {
        module: 'custom',
        subject: {
          fields: (ctx.fields ?? []).map((f) => ({
            key: f.key,
            label: f.label,
            type: f.type,
            ...(f.type === 'number' && f.unit ? { unit: f.unit } : {}),
          })),
          values: input.values,
        },
      }
  }
}

/** subjectOf + 规则与事实 → judge() 的完整输入 */
export function judgeInputOf(
  input: CreateCheckinInput,
  ctx: SubjectContext & Omit<JudgeInput, 'module' | 'subject'>,
): JudgeInput {
  const { timeZone, fields, ...rest } = ctx
  return { ...subjectOf(input, { timeZone, fields }), ...rest } as JudgeInput
}
