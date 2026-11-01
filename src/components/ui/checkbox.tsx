'use client'

import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './icon'

/*
 * 复选框（Base UI Checkbox）：勾选待办、同意条款、多选里的一项。
 * 立即生效的开关类设置用 Switch。
 * 整行（框 + 文字）都可点，行高至少 44px；放进 Field 时自动关联错误和 name。
 *
 *   <Checkbox checked={done} onCheckedChange={setDone}>背 20 个单词</Checkbox>
 *   <Checkbox checked={agree} onCheckedChange={setAgree} label="同意健康数据处理" />  // 无可见文字时
 */

interface CheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** 可见文字；不传时必须传 label 作为读屏名称 */
  children?: ReactNode
  label?: string
  /** 勾选后文字划线（待办） */
  strike?: boolean
  name?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

export function Checkbox({
  checked,
  onCheckedChange,
  children,
  label,
  strike = false,
  name,
  required,
  disabled,
  className,
}: CheckboxProps) {
  const box = (
    <BaseCheckbox.Root
      checked={checked}
      onCheckedChange={(c) => onCheckedChange(c)}
      name={name}
      required={required}
      disabled={disabled}
      aria-label={children ? undefined : label}
      className={
        'border-border-strong bg-surface flex size-6 shrink-0 items-center justify-center rounded-lg border-2 outline-none ' +
        'ease-spring transition-[background-color,border-color,transform] duration-(--dur-base) active:scale-90 ' +
        'data-checked:bg-primary data-checked:border-primary data-checked:text-on-primary ' +
        'focus-visible:ring-primary/40 aria-invalid:border-danger focus-visible:ring-4 data-disabled:opacity-50'
      }
    >
      <BaseCheckbox.Indicator className="ease-spring flex transition-[scale,opacity] duration-(--dur-base) data-ending-style:scale-50 data-ending-style:opacity-0 data-starting-style:scale-50 data-starting-style:opacity-0">
        <Icon name="check" size={16} strokeWidth={3} />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  )

  if (!children) {
    // 只有框：外层 44px 触控区
    return (
      <span className={cn('inline-flex size-11 items-center justify-center', className)}>
        {box}
      </span>
    )
  }

  return (
    <label
      className={cn(
        'text-body flex min-h-11 cursor-pointer items-center gap-3 py-1 select-none has-[[data-disabled]]:cursor-default has-[[data-disabled]]:opacity-50',
        className,
      )}
    >
      {box}
      <span
        className={cn(
          'min-w-0 flex-1 transition-colors duration-(--dur-base)',
          strike && checked && 'text-muted line-through',
        )}
      >
        {children}
      </span>
    </label>
  )
}
