'use client'

import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, Input } from '@/components/ui/field'
import { NumberField } from '@/components/ui/number-field'
import { Select } from '@/components/ui/select'
import { FIELD_TYPE_LABEL, fieldOfType, nextFieldKey } from '../format'
import { FIELD_TYPES, GOAL_FIELDS_MAX, type FieldDef, type FieldType } from '../schemas'

interface FieldEditorProps {
  value: readonly FieldDef[]
  onValueChange: (value: FieldDef[]) => void
  /**
   * FieldDefsSchema 校验失败的错误：键是 z.flattenError 之后的路径，
   * 这里只取整体错误（formErrors）和按下标的错误（"0" / "0.label" 由调用方展平成数组下标）
   */
  errors?: { form?: string[]; byIndex?: Record<number, string[]> }
  idPrefix?: string
}

const TYPE_OPTIONS = FIELD_TYPES.map((t) => ({ value: t, label: FIELD_TYPE_LABEL[t] }))

/**
 * 自定义目标的字段编辑器（PRD 2.3）：最多 10 个字段，7 种类型。
 * 每个字段一张卡片：名称、类型、必填，再按类型补单位 / 范围 / 选项。
 * 字段标识（key）自动生成且不可改：旧打卡记录按它取值。
 */
export function FieldEditor({ value, onValueChange, errors, idPrefix = 'fe' }: FieldEditorProps) {
  function update(index: number, next: FieldDef) {
    onValueChange(value.map((f, i) => (i === index ? next : f)))
  }
  function remove(index: number) {
    onValueChange(value.filter((_, i) => i !== index))
  }
  function move(index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= value.length) return
    const next = [...value]
    const [item] = next.splice(index, 1)
    if (item) next.splice(target, 0, item)
    onValueChange(next)
  }
  function add() {
    onValueChange([
      ...value,
      { key: nextFieldKey(value), label: '', type: 'number', required: false, integer: false },
    ])
  }

  return (
    <div className="flex flex-col gap-3">
      {value.map((field, index) => (
        <FieldCard
          key={field.key}
          id={`${idPrefix}-${field.key}`}
          index={index}
          total={value.length}
          field={field}
          errors={errors?.byIndex?.[index]}
          onChange={(f) => update(index, f)}
          onRemove={() => remove(index)}
          onMove={(d) => move(index, d)}
        />
      ))}
      {errors?.form?.[0] && (
        <p role="alert" className="text-tiny text-danger-ink">
          {errors.form[0]}
        </p>
      )}
      <Button
        variant="soft"
        icon="plus"
        onClick={add}
        disabled={value.length >= GOAL_FIELDS_MAX}
        className="self-start"
      >
        {value.length >= GOAL_FIELDS_MAX ? `最多 ${GOAL_FIELDS_MAX} 个字段` : '加一个字段'}
      </Button>
    </div>
  )
}

interface FieldCardProps {
  id: string
  index: number
  total: number
  field: FieldDef
  errors?: string[]
  onChange: (field: FieldDef) => void
  onRemove: () => void
  onMove: (delta: -1 | 1) => void
}

function FieldCard({
  id,
  index,
  total,
  field,
  errors,
  onChange,
  onRemove,
  onMove,
}: FieldCardProps) {
  const base = { key: field.key, label: field.label, required: field.required }
  return (
    <Card variant="sunken" className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <span className="text-tiny text-muted flex-1 font-semibold">第 {index + 1} 个字段</span>
        <IconButton
          icon="chevron-down"
          label="上移"
          size="sm"
          className="rotate-180"
          disabled={index === 0}
          onClick={() => onMove(-1)}
        />
        <IconButton
          icon="chevron-down"
          label="下移"
          size="sm"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
        />
        <IconButton icon="trash" label="删除这个字段" size="sm" onClick={onRemove} />
      </div>
      <div className="grid gap-3 @md:grid-cols-[1fr_10rem]">
        <Field label="字段名" htmlFor={`${id}-label`} error={errors?.[0]}>
          <Input
            id={`${id}-label`}
            value={field.label}
            maxLength={20}
            placeholder="例如：喝了几杯水"
            aria-invalid={errors?.[0] ? true : undefined}
            onChange={(e) => onChange({ ...field, label: e.target.value })}
          />
        </Field>
        <Field label="类型" htmlFor={`${id}-type`}>
          <Select<FieldType>
            id={`${id}-type`}
            options={TYPE_OPTIONS}
            value={field.type}
            onValueChange={(t) => onChange(fieldOfType(t, base))}
          />
        </Field>
      </div>
      <TypeOptions id={id} field={field} onChange={onChange} />
      <Checkbox
        checked={field.required}
        onCheckedChange={(required) => onChange({ ...field, required })}
      >
        打卡时必填
      </Checkbox>
    </Card>
  )
}

/** 类型相关的设置：数字的单位与范围、选项列表、文字长度、时长上限 */
function TypeOptions({
  id,
  field,
  onChange,
}: {
  id: string
  field: FieldDef
  onChange: (field: FieldDef) => void
}) {
  switch (field.type) {
    case 'number':
      return (
        <div className="grid grid-cols-1 gap-3 @md:grid-cols-3">
          <Field label="单位" htmlFor={`${id}-unit`} aside="可选">
            <Input
              id={`${id}-unit`}
              value={field.unit ?? ''}
              maxLength={8}
              placeholder="杯、页、km"
              onChange={(e) => onChange({ ...field, unit: e.target.value || undefined })}
            />
          </Field>
          <Field label="最小" htmlFor={`${id}-min`} aside="可选">
            <NumberField
              id={`${id}-min`}
              value={field.min ?? null}
              onValueChange={(min) => onChange({ ...field, min: min ?? undefined })}
            />
          </Field>
          <Field label="最大" htmlFor={`${id}-max`} aside="可选">
            <NumberField
              id={`${id}-max`}
              value={field.max ?? null}
              onValueChange={(max) => onChange({ ...field, max: max ?? undefined })}
            />
          </Field>
          <Checkbox
            checked={field.integer}
            onCheckedChange={(integer) => onChange({ ...field, integer })}
            className="@md:col-span-3"
          >
            只能填整数
          </Checkbox>
        </div>
      )
    case 'text':
      return (
        <Field label="最多几个字" htmlFor={`${id}-len`}>
          <NumberField
            id={`${id}-len`}
            value={field.maxLength}
            min={1}
            max={500}
            step={10}
            onValueChange={(n) => onChange({ ...field, maxLength: n ?? 100 })}
          />
        </Field>
      )
    case 'single-select':
    case 'multi-select':
      return (
        <OptionsEditor
          id={id}
          options={field.options}
          onChange={(options) => onChange({ ...field, options })}
        />
      )
    case 'duration':
      return (
        <Field label="最长" htmlFor={`${id}-maxdur`} hint="打卡时按分钟填">
          <NumberField
            id={`${id}-maxdur`}
            value={Math.round(field.maxSeconds / 60)}
            min={1}
            max={1440}
            step={10}
            unit="分钟"
            onValueChange={(m) =>
              onChange({ ...field, maxSeconds: Math.max(60, (m ?? 1440) * 60) })
            }
          />
        </Field>
      )
    case 'boolean':
    case 'rating':
      return null
  }
}

const OPTIONS_MAX = 20

function OptionsEditor({
  id,
  options,
  onChange,
}: {
  id: string
  options: readonly string[]
  onChange: (options: string[]) => void
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-caption mb-1.5 font-semibold">选项</legend>
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            id={`${id}-opt-${i}`}
            aria-label={`选项 ${i + 1}`}
            value={o}
            maxLength={20}
            onChange={(e) => onChange(options.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <IconButton
            icon="x"
            label={`删除选项 ${i + 1}`}
            disabled={options.length <= 2}
            onClick={() => onChange(options.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        icon="plus"
        className="self-start"
        disabled={options.length >= OPTIONS_MAX}
        onClick={() => onChange([...options, `选项${options.length + 1}`])}
      >
        加一个选项
      </Button>
    </fieldset>
  )
}
