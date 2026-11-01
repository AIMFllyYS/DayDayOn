'use client'

import { Field as BaseField } from '@base-ui/react/field'
import { Input as BaseInput } from '@base-ui/react/input'
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/*
 * 表单字段（Base UI Field，client-data-and-forms.md 第 6 节）。导出与原生版本一致：Field、Input、Textarea。
 * - Field 自动把标签、提示、错误和控件关联起来（aria-labelledby / aria-describedby / aria-invalid）。
 * - 错误来源三选一，按优先级：`error` 属性 → 外层 <Form errors> 里与 `name` 同名的服务端错误 → 控件的原生校验。
 *   错误出现时替换提示，不同时显示；字段改动后 Form 的服务端错误自动清除。
 * - 里面可以放 Input / Textarea，也可以放 Select、Combobox、NumberField、OTPField、Checkbox（都会接入同一个 Field）。
 *
 *   <Form errors={fieldErrors} onFormSubmit={submit}>
 *     <Field label="昵称" htmlFor="nick" name="nickname" hint="朋友看到的名字">
 *       <Input id="nick" required maxLength={12} />
 *     </Field>
 *   </Form>
 */

// 输入框字号固定 16px：iOS Safari 小于 16px 会在聚焦时自动放大页面
const controlClass =
  'w-full rounded-xl border border-border bg-surface px-4 text-body text-foreground ' +
  'placeholder:text-subtle transition-[border-color,box-shadow] duration-(--dur-fast) ' +
  'hover:border-border-strong focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary-soft ' +
  'aria-invalid:border-danger aria-invalid:focus:ring-danger-soft disabled:opacity-50'

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'defaultValue'> & {
  defaultValue?: string | number
}

export function Input({ className, ...rest }: InputProps) {
  return <BaseInput className={cn(controlClass, 'h-12', className)} {...rest} />
}

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'defaultValue'> & {
  defaultValue?: string
}

export function Textarea({ className, ...rest }: TextareaProps) {
  return (
    <BaseField.Control
      render={<textarea />}
      className={cn(controlClass, 'min-h-24 resize-y py-3', className)}
      {...(rest as Record<string, unknown>)}
    />
  )
}

interface FieldProps {
  label: string
  /** 关联控件的 id */
  htmlFor: string
  hint?: string
  /** 客户端错误文案；传入时字段标记为无效 */
  error?: string
  /** 字段名：与 <Form errors> 的键对应，服务端返回的 fields 错误按它显示；Form 提交时也按它取值 */
  name?: string
  /** 右侧附加信息，例如"可选"、字数统计 */
  aside?: ReactNode
  disabled?: boolean
  children: ReactNode
  className?: string
}

/** 表单字段：标签 + 控件 + 提示 / 错误。错误文案替换提示，不同时显示 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  name,
  aside,
  disabled,
  children,
  className,
}: FieldProps) {
  return (
    <BaseField.Root
      name={name}
      invalid={error ? true : undefined}
      disabled={disabled}
      className={cn('group/field flex flex-col gap-1.5', className)}
    >
      <div className="flex items-baseline justify-between gap-2">
        <BaseField.Label htmlFor={htmlFor} className="text-caption font-semibold">
          {label}
        </BaseField.Label>
        {aside && <span className="text-tiny text-muted">{aside}</span>}
      </div>
      {children}
      {error ? (
        <BaseField.Error match role="alert" className={errorClass}>
          {error}
        </BaseField.Error>
      ) : (
        <BaseField.Error role="alert" className={errorClass} />
      )}
      {hint && (
        <BaseField.Description className="text-tiny text-muted group-data-invalid/field:hidden">
          {hint}
        </BaseField.Description>
      )}
    </BaseField.Root>
  )
}

const errorClass =
  'text-tiny text-danger-ink transition-opacity duration-(--dur-fast) data-starting-style:opacity-0 data-ending-style:opacity-0'
