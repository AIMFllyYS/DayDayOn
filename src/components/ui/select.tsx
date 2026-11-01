'use client'

import { Select as BaseSelect } from '@base-ui/react/select'
import { cn } from '@/lib/cn'
import { Icon } from './icon'
import { popupItemClass, popupSurfaceClass, triggerBoxClass } from './popup-styles'

/*
 * 下拉选择（Base UI Select）：固定的几个选项里选一个，例如餐次、强度、时区。
 * 选项少于 4 个且一眼能看全时用 SegmentedControl；需要搜索或新建时用 Combobox。
 * 放进 Field 时自动关联标签、错误和 name（Form 提交时按 name 取值）。
 *
 * 推荐用法：页面首屏不需要时懒加载（ui-primitives.md 第 3 节）。
 *   <Select label="餐次" options={MEAL_OPTIONS} value={meal} onValueChange={setMeal} />
 */

export interface SelectOption<V extends string> {
  value: V
  label: string
  disabled?: boolean
}

interface SelectProps<V extends string> {
  options: readonly SelectOption<V>[]
  value: V | null
  onValueChange: (value: V) => void
  placeholder?: string
  /** 读屏名称；放在 Field 里时由 Field 的标签提供，可不传 */
  label?: string
  name?: string
  disabled?: boolean
  required?: boolean
  id?: string
  className?: string
}

export function Select<V extends string>({
  options,
  value,
  onValueChange,
  placeholder = '请选择',
  label,
  name,
  disabled,
  required,
  id,
  className,
}: SelectProps<V>) {
  const hasWidth = className ? /\b(w-|max-w-|min-w-)/.test(className) : false
  const hasHeight = className ? /\bh-/.test(className) : false

  return (
    <BaseSelect.Root<V>
      items={options}
      value={value}
      onValueChange={(v) => {
        if (v !== null) onValueChange(v)
      }}
      name={name}
      disabled={disabled}
      required={required}
      id={id}
    >
      <BaseSelect.Trigger
        aria-label={label}
        className={cn(triggerBoxClass, !hasWidth && 'w-full', !hasHeight && 'h-12', className)}
      >
        <BaseSelect.Value
          placeholder={placeholder}
          className="data-placeholder:text-subtle min-w-0 flex-1 truncate"
        />
        <BaseSelect.Icon className="text-muted ease-standard transition-transform duration-(--dur-base) in-data-popup-open:rotate-180">
          <Icon name="chevron-down" size={18} />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={6} alignItemWithTrigger={false} className="z-10">
          <BaseSelect.Popup
            className={cn(
              popupSurfaceClass,
              'max-h-[min(var(--available-height),20rem)] min-w-(--anchor-width) overflow-y-auto overscroll-contain p-1.5',
            )}
          >
            <BaseSelect.List>
              {options.map((o) => (
                <BaseSelect.Item
                  key={o.value}
                  value={o.value}
                  disabled={o.disabled}
                  className={cn(popupItemClass, 'data-selected:font-semibold')}
                >
                  <BaseSelect.ItemText className="min-w-0 flex-1">{o.label}</BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator className="text-primary-ink">
                    <Icon name="check" size={18} />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  )
}
