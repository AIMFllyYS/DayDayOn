import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

// 输入框字号固定 16px：iOS Safari 小于 16px 会在聚焦时自动放大页面
const controlClass =
  'w-full rounded-xl border border-border bg-surface px-4 text-body text-foreground ' +
  'placeholder:text-subtle transition-[border-color,box-shadow] duration-(--dur-fast) ' +
  'hover:border-border-strong focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary-soft ' +
  'aria-invalid:border-danger aria-invalid:focus:ring-danger-soft disabled:opacity-50'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, 'h-12', className)} {...rest} />
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClass, 'min-h-24 resize-y py-3', className)} {...rest} />
}

interface FieldProps {
  label: string
  /** 关联控件的 id */
  htmlFor: string
  hint?: string
  error?: string
  /** 右侧附加信息，例如"可选"、字数统计 */
  aside?: ReactNode
  children: ReactNode
  className?: string
}

/** 表单字段：标签 + 控件 + 提示 / 错误。错误文案替换提示，不同时显示 */
export function Field({ label, htmlFor, hint, error, aside, children, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-caption font-semibold">
          {label}
        </label>
        {aside && <span className="text-tiny text-muted">{aside}</span>}
      </div>
      {children}
      {error ? (
        <p role="alert" className="text-tiny text-danger-ink">
          {error}
        </p>
      ) : (
        hint && <p className="text-tiny text-muted">{hint}</p>
      )}
    </div>
  )
}
