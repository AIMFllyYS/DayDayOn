import type { InputHTMLAttributes } from 'react'
import { Field, Input } from './field'

type NativeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'id' | 'step'
>

interface TimeFieldProps extends NativeInputProps {
  label: string
  id: string
  /** HH:mm；空字符串表示未填 */
  value: string
  onValueChange: (value: string) => void
  /** 分钟步长，默认 1 分钟（原生 step 单位是秒） */
  stepMinutes?: number
  hint?: string
  error?: string
  aside?: string
  className?: string
}

/** 时间输入：原生 time 外套 Field（ADR-0007）。提醒时间、计划时间都用它 */
export function TimeField({
  label,
  id,
  value,
  onValueChange,
  stepMinutes = 1,
  hint,
  error,
  aside,
  className,
  ...rest
}: TimeFieldProps) {
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} aside={aside} className={className}>
      <Input
        id={id}
        type="time"
        value={value}
        step={stepMinutes * 60}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onValueChange(e.target.value)}
        className="tabular-nums"
        {...rest}
      />
    </Field>
  )
}
