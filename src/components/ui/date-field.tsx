import type { InputHTMLAttributes } from 'react'
import { Field, Input } from './field'

/*
 * 日期 / 时间输入只用原生控件（ADR-0007）：手机上弹系统滚轮或日历。
 * 值是本地字符串（YYYY-MM-DD、YYYY-MM-DDTHH:mm），转成时刻交给 src/lib/time 的 combineLocal()。
 */

type NativeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'id' | 'min' | 'max'
>

interface DateFieldProps extends NativeInputProps {
  label: string
  id: string
  /** YYYY-MM-DD；空字符串表示未选择 */
  value: string
  onValueChange: (value: string) => void
  /** YYYY-MM-DD，例如补卡只能选到昨天 */
  min?: string
  max?: string
  /** 待办 DDL 这类"日期 + 时间"用 datetime-local，值为 YYYY-MM-DDTHH:mm */
  withTime?: boolean
  hint?: string
  error?: string
  aside?: string
  className?: string
}

/** 日期输入：原生 date / datetime-local 外套 Field */
export function DateField({
  label,
  id,
  value,
  onValueChange,
  min,
  max,
  withTime = false,
  hint,
  error,
  aside,
  className,
  ...rest
}: DateFieldProps) {
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} aside={aside} className={className}>
      <Input
        id={id}
        type={withTime ? 'datetime-local' : 'date'}
        value={value}
        min={min}
        max={max}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onValueChange(e.target.value)}
        className="tabular-nums"
        {...rest}
      />
    </Field>
  )
}
