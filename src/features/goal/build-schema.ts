import * as z from 'zod'
import type { FieldDef, FieldValue } from './schemas'

/*
 * 动态表单：字段定义 → zod schema（client-data-and-forms.md 第 6 节、PRD 2.4）。
 * 渲染（SchemaForm）和校验（前端提交、服务端创建打卡）共用这一份。
 * 值的形状：number / duration（秒）/ rating（1–5）是 number，text / single-select 是 string，
 * multi-select 是 string[]，boolean 是 boolean。未知键会被拒绝。
 */

function valueSchema(field: FieldDef): z.ZodType<FieldValue> {
  switch (field.type) {
    case 'number': {
      let s = z.number({ error: `${field.label}要填数字` })
      if (field.integer) s = s.int({ error: `${field.label}要填整数` })
      if (field.min !== undefined)
        s = s.min(field.min, { error: `${field.label}不能小于 ${field.min}` })
      if (field.max !== undefined)
        s = s.max(field.max, { error: `${field.label}不能大于 ${field.max}` })
      return s
    }
    case 'text': {
      const s = z.string({ error: `${field.label}要填文字` }).trim()
      return (field.required ? s.min(1, { error: `请填写${field.label}` }) : s).max(
        field.maxLength,
        {
          error: `${field.label}最多 ${field.maxLength} 个字`,
        },
      )
    }
    case 'single-select':
      return z.enum(field.options as [string, ...string[]], { error: `请选择${field.label}` })
    case 'multi-select': {
      const s = z
        .array(
          z.enum(field.options as [string, ...string[]], { error: `${field.label}的选项不存在` }),
        )
        .refine((v) => new Set(v).size === v.length, { error: `${field.label}的选项重复了` })
      return field.required
        ? s.refine((v) => v.length > 0, { error: `请至少选一项${field.label}` })
        : s
    }
    case 'boolean':
      return z.boolean({ error: `请选择${field.label}` })
    case 'duration':
      return z
        .number({ error: `${field.label}要填时长` })
        .int({ error: `${field.label}按整秒记录` })
        .min(0, { error: `${field.label}不能是负数` })
        .max(field.maxSeconds, { error: `${field.label}太长了` })
    case 'rating':
      return z
        .number({ error: `请给${field.label}打分` })
        .int()
        .min(1, { error: `${field.label}是 1–5 分` })
        .max(5, { error: `${field.label}是 1–5 分` })
  }
}

/** 由字段定义生成值对象的 schema。非必填字段可以省略或为 undefined */
export function buildSchema(
  fields: readonly FieldDef[],
): z.ZodType<Record<string, FieldValue | undefined>> {
  const shape: Record<string, z.ZodType<FieldValue | undefined>> = {}
  for (const field of fields) {
    const s = valueSchema(field)
    shape[field.key] = field.required ? s : s.optional()
  }
  return z.strictObject(shape)
}

const TRUE_STRINGS = new Set(['true', '1', 'yes', 'y', '是', '完成', '已完成', '打卡', '已打卡'])
const FALSE_STRINGS = new Set(['false', '0', 'no', 'n', '否', '未完成', '没完成'])

/**
 * 清洗并对齐自定义目标字段值（防 z.strictObject 因 AI 多输出未知键或 label 键名而静默拦截提交）：
 * 1. 仅保留 fields 中声明过的 field.key，剔除一切多余键；
 * 2. 支持从 field.label 映射值，或在单字段目标下按类型兜底提取；
 * 3. 当 fillRequiredDefaults 为 true（如智能识别预填）时，为缺失的必填字段补齐合法默认值。
 */
export function sanitizeCustomValues(
  fields: readonly FieldDef[],
  rawValues: Record<string, unknown> | undefined | null,
  options?: { fillRequiredDefaults?: boolean },
): Record<string, FieldValue> {
  const raw = rawValues ?? {}
  const fillDefaults = options?.fillRequiredDefaults ?? false
  const out: Record<string, FieldValue> = {}

  for (const field of fields) {
    let cand: unknown = raw[field.key] !== undefined ? raw[field.key] : raw[field.label]

    if (cand === undefined && fields.length === 1) {
      const firstDefined = Object.values(raw).find((v) => v !== undefined && v !== null)
      if (firstDefined !== undefined) cand = firstDefined
    }

    switch (field.type) {
      case 'boolean': {
        if (typeof cand === 'boolean') {
          out[field.key] = cand
        } else if (typeof cand === 'string') {
          const s = cand.trim().toLowerCase()
          if (TRUE_STRINGS.has(s)) out[field.key] = true
          else if (FALSE_STRINGS.has(s)) out[field.key] = false
          else if (fillDefaults && field.required) out[field.key] = true
        } else if (typeof cand === 'number') {
          out[field.key] = cand !== 0
        } else if (fillDefaults && field.required) {
          out[field.key] = true
        }
        break
      }
      case 'number': {
        const num =
          typeof cand === 'number'
            ? cand
            : typeof cand === 'string' && cand.trim() !== ''
              ? Number(cand)
              : Number.NaN
        if (Number.isFinite(num)) {
          let v = field.integer ? Math.round(num) : num
          if (field.min !== undefined && v < field.min) v = field.min
          if (field.max !== undefined && v > field.max) v = field.max
          out[field.key] = v
        } else if (fillDefaults && field.required) {
          let v = field.min !== undefined ? Math.max(1, field.min) : 1
          if (field.max !== undefined && v > field.max) v = field.max
          out[field.key] = field.integer ? Math.round(v) : v
        }
        break
      }
      case 'duration': {
        const num =
          typeof cand === 'number'
            ? cand
            : typeof cand === 'string' && cand.trim() !== ''
              ? Number(cand)
              : Number.NaN
        if (Number.isFinite(num)) {
          out[field.key] = Math.max(0, Math.min(field.maxSeconds, Math.round(num)))
        } else if (fillDefaults && field.required) {
          out[field.key] = Math.min(1800, field.maxSeconds)
        }
        break
      }
      case 'rating': {
        const num =
          typeof cand === 'number'
            ? cand
            : typeof cand === 'string' && cand.trim() !== ''
              ? Number(cand)
              : Number.NaN
        if (Number.isFinite(num)) {
          out[field.key] = Math.max(1, Math.min(5, Math.round(num)))
        } else if (fillDefaults && field.required) {
          out[field.key] = 4
        }
        break
      }
      case 'text': {
        if (typeof cand === 'string' && cand.trim().length > 0) {
          out[field.key] = cand.trim().slice(0, field.maxLength)
        } else if (typeof cand === 'number' || typeof cand === 'boolean') {
          out[field.key] = String(cand).slice(0, field.maxLength)
        } else if (fillDefaults && field.required) {
          out[field.key] = '已完成'.slice(0, field.maxLength)
        }
        break
      }
      case 'single-select': {
        if (typeof cand === 'string' && field.options.includes(cand)) {
          out[field.key] = cand
        } else if (fillDefaults && field.required && field.options.length > 0) {
          out[field.key] = field.options[0]!
        }
        break
      }
      case 'multi-select': {
        if (Array.isArray(cand)) {
          const valid = [
            ...new Set(
              cand.filter((x): x is string => typeof x === 'string' && field.options.includes(x)),
            ),
          ]
          if (valid.length > 0 || !field.required) {
            out[field.key] = valid
          } else if (fillDefaults && field.options.length > 0) {
            out[field.key] = [field.options[0]!]
          }
        } else if (typeof cand === 'string' && field.options.includes(cand)) {
          out[field.key] = [cand]
        } else if (fillDefaults && field.required && field.options.length > 0) {
          out[field.key] = [field.options[0]!]
        }
        break
      }
    }
  }

  return out
}
