'use client'

import { Form as BaseForm } from '@base-ui/react/form'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/*
 * 表单（Base UI Form，client-data-and-forms.md 第 6 节）。不引入表单库。
 * - onFormSubmit 拿到 { [Field 的 name]: 值 } 对象（已自动 preventDefault）；提交前先跑各字段的原生校验，
 *   有无效字段时聚焦第一个并不调用 onFormSubmit。
 * - errors：客户端 zod 校验失败的 `z.flattenError(r.error).fieldErrors`，或服务端 400 VALIDATION_FAILED 的 `fields`，
 *   直接传进来；对应 name 的 Field 显示错误，用户改动该字段后自动清除。值为 undefined 的键会被忽略。
 *
 *   const [errors, setErrors] = useState<FormErrors>()
 *   <Form errors={errors} onFormSubmit={(values) => {
 *     const r = Schema.safeParse(values)
 *     if (!r.success) return setErrors(z.flattenError(r.error).fieldErrors)
 *     mutate(r.data, { onError: (e) => setErrors(e.fields) })
 *   }}>…</Form>
 */

export type FormErrors = Record<string, string | readonly string[] | undefined>
export type FormValues = Record<string, unknown>

interface FormProps {
  children: ReactNode
  onFormSubmit: (values: FormValues) => void
  errors?: FormErrors
  /** 什么时候校验：默认提交时，之后改动即校验 */
  validationMode?: 'onSubmit' | 'onBlur' | 'onChange'
  id?: string
  'aria-label'?: string
  className?: string
}

function cleanErrors(
  errors: FormErrors | undefined,
): Record<string, string | string[]> | undefined {
  if (!errors) return undefined
  const out: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(errors)) {
    if (value === undefined || value.length === 0) continue
    out[key] = typeof value === 'string' ? value : [...value]
  }
  return out
}

export function Form({
  children,
  onFormSubmit,
  errors,
  validationMode,
  id,
  className,
  ...rest
}: FormProps) {
  return (
    <BaseForm
      id={id}
      aria-label={rest['aria-label']}
      errors={cleanErrors(errors)}
      validationMode={validationMode}
      onFormSubmit={(values) => onFormSubmit(values)}
      className={cn('flex flex-col gap-4', className)}
    >
      {children}
    </BaseForm>
  )
}
