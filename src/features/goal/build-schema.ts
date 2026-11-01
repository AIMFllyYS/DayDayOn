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
