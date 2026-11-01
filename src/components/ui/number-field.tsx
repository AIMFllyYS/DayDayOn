'use client'

import { NumberField as BaseNumberField } from '@base-ui/react/number-field'
import { useCallback } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './icon'

/*
 * 数字输入（Base UI NumberField）：精确数值，例如体重、时长、次数、身高。
 * 两侧 44px 的 −/+ 按钮，长按连续加减；方向键 ±step，Shift+方向键 ±largeStep；
 * 手机弹出数字键盘。值为空时回调 null（"没填"和 0 不一样）。
 * 放进 Field 时自动关联标签和错误。
 *
 *   <Field label="体重" htmlFor="w"><NumberField id="w" value={kg} onValueChange={setKg}
 *     min={20} max={300} step={0.1} unit="kg" format={{ maximumFractionDigits: 1 }} /></Field>
 */

interface NumberFieldProps {
  value: number | null
  onValueChange: (value: number | null) => void
  min?: number
  max?: number
  step?: number
  largeStep?: number
  /** 输入框右侧的单位，例如 kg、分钟 */
  unit?: string
  format?: Intl.NumberFormatOptions
  placeholder?: string
  /** 不在 Field 里时必须传 */
  ariaLabel?: string
  id?: string
  name?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

const stepperClass =
  'text-foreground hover:bg-surface-sunken active:bg-border flex size-11 shrink-0 items-center justify-center rounded-full ' +
  'transition-colors duration-(--dur-fast) select-none data-disabled:opacity-40 data-disabled:pointer-events-none'

export function NumberField({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  largeStep,
  unit,
  format,
  placeholder,
  ariaLabel,
  id,
  name,
  required,
  disabled,
  className,
}: NumberFieldProps) {
  /*
   * Base UI 把 min / step 写到隐藏的原生 <input type="number"> 上，浏览器从 min 起算步长做 stepMismatch 校验：
   * min=1、step=5 时 30 分钟会被判"无效值"，表单提交不了（lessons/base-ui.md）。
   * step 在这里只是 −/+ 按钮的步进量，取值校验交给 zod，所以把原生步长校验关掉。
   * 依赖 step：step 变化时 React 先改写属性，再重新执行本回调。
   */
  const disableNativeStep = useCallback(
    (input: HTMLInputElement | null) => {
      if (input && step) input.step = 'any'
    },
    [step],
  )
  return (
    <BaseNumberField.Root
      id={id}
      name={name}
      value={value}
      onValueChange={(v) => onValueChange(v)}
      min={min}
      max={max}
      step={step}
      inputRef={disableNativeStep}
      largeStep={largeStep}
      format={format}
      required={required}
      disabled={disabled}
      locale="zh-CN"
      className={cn('w-full', className)}
    >
      <BaseNumberField.Group
        className={
          'border-border bg-surface flex h-12 items-center rounded-xl border px-0.5 ' +
          'hover:border-border-strong transition-[border-color,box-shadow] duration-(--dur-fast) ' +
          'focus-within:border-primary focus-within:ring-primary-soft focus-within:ring-4 ' +
          'has-[[aria-invalid=true]]:border-danger has-[[data-disabled]]:opacity-50'
        }
      >
        <BaseNumberField.Decrement aria-label="减少" className={stepperClass}>
          {/* 图标集里没有减号（icon.tsx 不归本模块），用同粗细的短横代替 */}
          <span aria-hidden className="h-0.5 w-3 rounded-full bg-current" />
        </BaseNumberField.Decrement>
        <div className="flex min-w-0 flex-1 items-baseline justify-center gap-1">
          <BaseNumberField.Input
            aria-label={ariaLabel}
            placeholder={placeholder}
            className="text-subhead text-foreground placeholder:text-subtle w-full min-w-0 bg-transparent text-center font-semibold tabular-nums outline-none"
          />
          {unit && <span className="text-caption text-muted shrink-0 pr-1">{unit}</span>}
        </div>
        <BaseNumberField.Increment aria-label="增加" className={stepperClass}>
          <Icon name="plus" size={18} />
        </BaseNumberField.Increment>
      </BaseNumberField.Group>
    </BaseNumberField.Root>
  )
}
