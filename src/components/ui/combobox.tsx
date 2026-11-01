'use client'

import { Combobox as BaseCombobox } from '@base-ui/react/combobox'
import { useState } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './icon'
import { popupItemClass, popupSurfaceClass } from './popup-styles'

/*
 * 组合框（Base UI Combobox）：可输入过滤的选择，支持单选、多选（标签）和"新建"。
 * 选项很多或需要用户自己补充时用（运动类别、自定义标签）；固定几项用 Select。
 * 对外只用字符串 value；选项对象在内部组装，业务代码不接触 Base UI 部件。
 *
 * 推荐用法：页面首屏不需要时懒加载（ui-primitives.md 第 3 节）。
 *   <Combobox options={opts} value={v} onValueChange={setV} label="运动类型" />
 *   <Combobox multiple options={tags} value={selected} onValueChange={setSelected}
 *     creatable onCreate={(label) => { const id = addTag(label); return id }} />
 * creatable 时 onCreate 必须把新选项加进 options，并返回它的 value。
 */

export interface ComboboxOption {
  value: string
  label: string
}

interface Item extends ComboboxOption {
  /** 有值表示"新建"项，值为用户输入的文字 */
  create?: string
}

interface BaseProps {
  options: readonly ComboboxOption[]
  placeholder?: string
  /** 读屏名称；放在 Field 里时由 Field 的标签提供，可不传 */
  label?: string
  /** 过滤后没有结果时的提示 */
  emptyText?: string
  /** 允许把输入的文字新建为选项 */
  creatable?: boolean
  /** 新建：调用方把选项加进 options，返回新选项的 value */
  onCreate?: (label: string) => string
  name?: string
  disabled?: boolean
  required?: boolean
  id?: string
  className?: string
}

interface SingleProps extends BaseProps {
  multiple?: false
  value: string | null
  onValueChange: (value: string | null) => void
}

interface MultipleProps extends BaseProps {
  multiple: true
  value: readonly string[]
  onValueChange: (value: string[]) => void
}

export type ComboboxProps = SingleProps | MultipleProps

const CREATE_PREFIX = '\u0000create:'

const isEqual = (a: Item, b: Item) => a.value === b.value
const toLabel = (item: Item) => item.create ?? item.label
const toValue = (item: Item) => item.value

const groupClass =
  'border-border bg-surface flex min-h-12 w-full flex-wrap items-center gap-1.5 rounded-xl border py-1.5 pr-1 pl-3 ' +
  'transition-[border-color,box-shadow] duration-(--dur-fast) hover:border-border-strong ' +
  'focus-within:border-primary focus-within:ring-primary-soft focus-within:ring-4 ' +
  'has-[[aria-invalid=true]]:border-danger has-[[data-disabled]]:opacity-50'

const inputClass =
  'text-body text-foreground placeholder:text-subtle h-9 min-w-16 flex-1 bg-transparent outline-none'

export function Combobox(props: ComboboxProps) {
  const { options, creatable, onCreate } = props
  const [query, setQuery] = useState('')

  const byValue = new Map(options.map((o) => [o.value, o]))
  const resolve = (v: string): Item => byValue.get(v) ?? { value: v, label: v }

  const trimmed = query.trim()
  const exists = options.some(
    (o) => o.label.trim().toLocaleLowerCase() === trimmed.toLocaleLowerCase(),
  )
  const items: Item[] =
    creatable && trimmed !== '' && !exists
      ? [...options, { value: CREATE_PREFIX + trimmed, label: trimmed, create: trimmed }]
      : [...options]

  /** 把"新建"项换成调用方新建的真实选项 */
  const materialize = (item: Item): string => {
    if (!item.create) return item.value
    return onCreate ? onCreate(item.create) : item.create
  }

  const shared = {
    items,
    isItemEqualToValue: isEqual,
    itemToStringLabel: toLabel,
    itemToStringValue: toValue,
    onInputValueChange: (v: string) => setQuery(v),
    autoHighlight: creatable,
    name: props.name,
    disabled: props.disabled,
    required: props.required,
    id: props.id,
  }

  if (props.multiple) {
    const selected = props.value.map(resolve)
    return (
      <BaseCombobox.Root<Item, true>
        {...shared}
        multiple
        value={selected}
        onValueChange={(next) => props.onValueChange(next.map(materialize))}
      >
        <BaseCombobox.InputGroup className={cn(groupClass, props.className)}>
          <BaseCombobox.Chips className="contents">
            {selected.map((item) => (
              <BaseCombobox.Chip
                key={item.value}
                aria-label={item.label}
                className="bg-primary-soft text-primary-ink text-caption data-highlighted:ring-primary flex h-8 items-center gap-0.5 rounded-full pr-0.5 pl-3 font-semibold outline-none data-highlighted:ring-2"
              >
                {item.label}
                <BaseCombobox.ChipRemove
                  aria-label={`移除 ${item.label}`}
                  className="hover:bg-primary/15 flex size-7 items-center justify-center rounded-full"
                >
                  <Icon name="x" size={14} />
                </BaseCombobox.ChipRemove>
              </BaseCombobox.Chip>
            ))}
            <BaseCombobox.Input
              aria-label={props.label}
              placeholder={selected.length > 0 ? '' : props.placeholder}
              className={inputClass}
            />
          </BaseCombobox.Chips>
          <TriggerButton />
        </BaseCombobox.InputGroup>
        <ComboboxPopup emptyText={props.emptyText} />
      </BaseCombobox.Root>
    )
  }

  const onSingleChange = props.onValueChange
  return (
    <BaseCombobox.Root<Item, false>
      {...shared}
      value={props.value === null ? null : resolve(props.value)}
      onValueChange={(next) => onSingleChange(next === null ? null : materialize(next))}
    >
      <BaseCombobox.InputGroup className={cn(groupClass, props.className)}>
        <BaseCombobox.Input
          aria-label={props.label}
          placeholder={props.placeholder}
          className={inputClass}
        />
        <BaseCombobox.Clear
          aria-label="清除"
          className="text-muted hover:bg-surface-sunken flex size-9 shrink-0 items-center justify-center rounded-full"
        >
          <Icon name="x" size={16} />
        </BaseCombobox.Clear>
        <TriggerButton />
      </BaseCombobox.InputGroup>
      <ComboboxPopup emptyText={props.emptyText} />
    </BaseCombobox.Root>
  )
}

function TriggerButton() {
  return (
    <BaseCombobox.Trigger
      aria-label="展开选项"
      className="text-muted hover:bg-surface-sunken flex size-9 shrink-0 items-center justify-center rounded-full"
    >
      <Icon
        name="chevron-down"
        size={18}
        className="ease-standard transition-transform duration-(--dur-base) in-data-popup-open:rotate-180"
      />
    </BaseCombobox.Trigger>
  )
}

function ComboboxPopup({ emptyText = '没有找到，换个词试试' }: { emptyText?: string }) {
  return (
    <BaseCombobox.Portal>
      <BaseCombobox.Positioner sideOffset={6} className="z-10">
        <BaseCombobox.Popup
          className={cn(
            popupSurfaceClass,
            'max-h-[min(var(--available-height),20rem)] w-(--anchor-width) overflow-y-auto overscroll-contain p-1.5',
          )}
        >
          <BaseCombobox.Empty className="text-caption text-muted px-3 py-2.5 empty:hidden">
            {emptyText}
          </BaseCombobox.Empty>
          <BaseCombobox.List>
            {(item: Item) => (
              <BaseCombobox.Item
                key={item.value}
                value={item}
                className={cn(popupItemClass, 'data-selected:font-semibold')}
              >
                {item.create ? (
                  <>
                    <Icon name="plus" size={18} className="text-primary-ink" />
                    <span className="min-w-0 flex-1">新建「{item.create}」</span>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1">{item.label}</span>
                    <BaseCombobox.ItemIndicator className="text-primary-ink">
                      <Icon name="check" size={18} />
                    </BaseCombobox.ItemIndicator>
                  </>
                )}
              </BaseCombobox.Item>
            )}
          </BaseCombobox.List>
        </BaseCombobox.Popup>
      </BaseCombobox.Positioner>
    </BaseCombobox.Portal>
  )
}
