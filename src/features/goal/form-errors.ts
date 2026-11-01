import * as z from 'zod'

/*
 * 目标表单的错误整理：z.flattenError 只按第一层键分组，自定义字段的错误需要落到具体哪一张字段卡片上。
 */

export type FieldErrors = Record<string, string[] | undefined>

export interface GoalFormErrors {
  /** 第一层：title / description / target / weekdays / plannedTime */
  top: FieldErrors
  /** fields 数组本身的错误（数量、标识重复） */
  fieldsForm?: string[]
  /** fields[i] 的错误 */
  fieldsByIndex?: Record<number, string[]>
}

export function goalFormErrors(error: z.ZodError): GoalFormErrors {
  const top: FieldErrors = {}
  const fieldsForm: string[] = []
  const fieldsByIndex: Record<number, string[]> = {}
  for (const issue of error.issues) {
    const [head, index] = issue.path
    if (head === 'fields') {
      if (typeof index === 'number') (fieldsByIndex[index] ??= []).push(issue.message)
      else fieldsForm.push(issue.message)
      continue
    }
    const key = typeof head === 'string' ? head : '_form'
    ;(top[key] ??= []).push(issue.message)
  }
  return {
    top,
    fieldsForm: fieldsForm.length > 0 ? fieldsForm : undefined,
    fieldsByIndex: Object.keys(fieldsByIndex).length > 0 ? fieldsByIndex : undefined,
  }
}

/**
 * 动态表单改动后去掉"值变了"的键的错误。
 * Field 收到 error 时 Base UI 把它判为无效，Form 提交前会拦下、不调 onFormSubmit，
 * 所以改过的字段必须先清掉错误，用户才能重新提交。没有剩余错误时返回 undefined。
 */
export function clearChangedErrors(
  errors: FieldErrors | undefined,
  prev: Readonly<Record<string, unknown>>,
  next: Readonly<Record<string, unknown>>,
): FieldErrors | undefined {
  if (!errors) return undefined
  const kept: FieldErrors = {}
  for (const [key, messages] of Object.entries(errors)) {
    if (messages && messages.length > 0 && Object.is(prev[key], next[key])) kept[key] = messages
  }
  return Object.keys(kept).length > 0 ? kept : undefined
}

/** 服务端 400 的 fields（已按第一层键分组）→ 同一形状 */
export function serverFormErrors(fields: Record<string, string[]> | undefined): GoalFormErrors {
  const { fields: fieldsErr, ...top } = fields ?? {}
  return { top, fieldsForm: fieldsErr }
}
