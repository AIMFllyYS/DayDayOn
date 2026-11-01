'use client'

import { OTPField as BaseOTPField } from '@base-ui/react/otp-field'
import { cn } from '@/lib/cn'

/*
 * 验证码输入（Base UI OTPField）：登录邮箱验证码，默认 6 位数字。
 * 支持整段粘贴、短信 / 邮件验证码自动填充（autocomplete="one-time-code"）、退格回到上一格。
 * 填满时回调 onComplete，登录页可以直接提交；放进 Field 时自动关联标签和错误。
 *
 *   <Field label="6 位验证码" htmlFor="otp" error={err}>
 *     <OTPField id="otp" value={code} onValueChange={setCode} onComplete={submit} />
 *   </Field>
 */

interface OTPFieldProps {
  value: string
  onValueChange: (value: string) => void
  onComplete?: (value: string) => void
  length?: number
  id?: string
  name?: string
  disabled?: boolean
  /** 不在 Field 里时必须传 */
  ariaLabel?: string
  className?: string
}

export function OTPField({
  value,
  onValueChange,
  onComplete,
  length = 6,
  id,
  name,
  disabled,
  ariaLabel,
  className,
}: OTPFieldProps) {
  return (
    <BaseOTPField.Root
      id={id}
      name={name}
      length={length}
      value={value}
      onValueChange={(v) => onValueChange(v)}
      onValueComplete={onComplete ? (v) => onComplete(v) : undefined}
      disabled={disabled}
      validationType="numeric"
      aria-label={ariaLabel}
      className={cn('flex gap-2', className)}
    >
      {Array.from({ length }, (_, i) => (
        <BaseOTPField.Input
          key={i}
          aria-label={i === 0 ? undefined : `第 ${i + 1} 位，共 ${length} 位`}
          className={
            'border-border bg-surface text-title text-foreground h-14 w-full max-w-12 min-w-0 rounded-xl border text-center font-bold tabular-nums ' +
            'transition-[border-color,box-shadow] duration-(--dur-fast) ' +
            'focus:border-primary focus:ring-primary-soft focus:ring-4 focus:outline-none ' +
            'data-filled:border-border-strong aria-invalid:border-danger data-invalid:border-danger data-disabled:opacity-50'
          }
        />
      ))}
    </BaseOTPField.Root>
  )
}
