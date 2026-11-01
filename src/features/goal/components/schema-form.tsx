'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Field, Input, Textarea } from '@/components/ui/field'
import { NumberField } from '@/components/ui/number-field'
import { Rating, type RatingValue } from '@/components/ui/rating'
import { Select } from '@/components/ui/select'
import type { FieldDef, FieldValue, FieldValues } from '@/features/goal/schemas'
import { cn } from '@/lib/cn'
import { minutesToSeconds, secondsToMinutes } from '../format'

export interface SchemaFormProps {
  /** 当前版本的字段定义 */
  fields: readonly FieldDef[]
  /** 受控值：key → 值（number / string / string[] / boolean） */
  value: FieldValues
  onChange: (next: FieldValues) => void
  /** z.flattenError(buildSchema(fields).safeParse(value).error).fieldErrors，或接口 400 的 fields */
  errors?: Record<string, string[] | undefined>
  /** 控件 id 的前缀：同一页有多个表单时避免重复 */
  idPrefix?: string
}

/**
 * 按字段定义渲染动态表单（PRD 2.4 自定义板块）。校验由调用方用 buildSchema(fields) 做。
 * props F1 定；实现 D2；D3 的自定义打卡表单使用。
 * 值的形状与 buildSchema 一致：时长存秒（界面按分钟输入），评分 1–5；清空的字段写 undefined。
 */
export function SchemaForm({ fields, value, onChange, errors, idPrefix = 'sf' }: SchemaFormProps) {
  function set(key: string, v: FieldValue | undefined) {
    onChange({ ...value, [key]: v })
  }

  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => {
        const id = `${idPrefix}-${field.key}`
        const error = errors?.[field.key]?.[0]
        return (
          <Field
            key={field.key}
            label={field.label}
            htmlFor={id}
            name={field.key}
            error={error}
            aside={field.required ? undefined : '可选'}
          >
            <FieldControl
              id={id}
              field={field}
              value={value[field.key]}
              invalid={error !== undefined}
              onChange={(v) => set(field.key, v)}
            />
          </Field>
        )
      })}
    </div>
  )
}

interface ControlProps {
  id: string
  field: FieldDef
  value: FieldValue | undefined
  invalid: boolean
  onChange: (value: FieldValue | undefined) => void
}

const BOOL_OPTIONS = [
  { value: 'yes', label: '是' },
  { value: 'no', label: '否' },
] as const

/**
 * 平铺的单选：和 SegmentedControl 不同，允许"还没选"（SegmentedControl 总会高亮一项，
 * 会让没回答的必填字段看起来已经选了）。radiogroup 语义，44px 触控区。
 */
function ChoiceChips<V extends string>({
  id,
  label,
  options,
  value,
  invalid,
  onValueChange,
}: {
  id: string
  label: string
  options: readonly { value: V; label: string }[]
  value: V | null
  invalid: boolean
  onValueChange: (value: V) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            id={i === 0 ? id : undefined}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onValueChange(o.value)}
            className={cn(
              'text-caption ease-spring h-11 min-w-16 rounded-full px-4 font-semibold',
              'transition-[transform,background-color,color] duration-(--dur-fast) active:scale-[0.96]',
              on
                ? 'bg-custom-soft text-custom-ink ring-custom ring-2'
                : 'bg-surface-sunken text-muted hover:text-foreground',
              invalid && !on && 'ring-danger-soft ring-2',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function FieldControl({ id, field, value, invalid, onChange }: ControlProps) {
  switch (field.type) {
    case 'number':
      return (
        <NumberField
          id={id}
          value={typeof value === 'number' ? value : null}
          onValueChange={(n) => onChange(n ?? undefined)}
          min={field.min}
          max={field.max}
          step={field.integer ? 1 : 0.1}
          unit={field.unit}
          format={{ maximumFractionDigits: field.integer ? 0 : 2 }}
        />
      )
    case 'text': {
      const text = typeof value === 'string' ? value : ''
      const long = field.maxLength > 40
      const props = {
        id,
        value: text,
        maxLength: field.maxLength,
        'aria-invalid': invalid || undefined,
        onChange: (e: { target: { value: string } }) =>
          onChange(e.target.value === '' ? undefined : e.target.value),
      }
      return long ? <Textarea {...props} /> : <Input {...props} />
    }
    case 'single-select':
      // 选项少时平铺，多时用下拉
      return field.options.length <= 4 ? (
        <ChoiceChips
          id={id}
          label={field.label}
          options={field.options.map((o) => ({ value: o, label: o }))}
          value={typeof value === 'string' ? value : null}
          invalid={invalid}
          onValueChange={(v) => onChange(v)}
        />
      ) : (
        <Select
          id={id}
          options={field.options.map((o) => ({ value: o, label: o }))}
          value={typeof value === 'string' ? value : null}
          onValueChange={(v) => onChange(v)}
        />
      )
    case 'multi-select': {
      const selected = Array.isArray(value) ? value : []
      return (
        <div id={id} role="group" className="flex flex-col">
          {field.options.map((o) => (
            <Checkbox
              key={o}
              checked={selected.includes(o)}
              onCheckedChange={(c) => {
                // 保持选项定义里的顺序
                const next = field.options.filter((x) => (x === o ? c : selected.includes(x)))
                onChange(next.length > 0 ? next : undefined)
              }}
            >
              {o}
            </Checkbox>
          ))}
        </div>
      )
    }
    case 'boolean':
      return (
        <ChoiceChips
          id={id}
          label={field.label}
          options={BOOL_OPTIONS}
          value={value === true ? 'yes' : value === false ? 'no' : null}
          invalid={invalid}
          onValueChange={(v) => onChange(v === 'yes')}
        />
      )
    case 'duration':
      return (
        <NumberField
          id={id}
          value={typeof value === 'number' ? secondsToMinutes(value) : null}
          onValueChange={(m) => onChange(m === null ? undefined : minutesToSeconds(m))}
          min={0}
          max={secondsToMinutes(field.maxSeconds)}
          step={5}
          unit="分钟"
          format={{ maximumFractionDigits: 0 }}
        />
      )
    case 'rating':
      return (
        <Rating
          label={field.label}
          tone="custom"
          value={typeof value === 'number' ? (value as RatingValue) : null}
          onValueChange={(v) => onChange(v)}
        />
      )
  }
}
