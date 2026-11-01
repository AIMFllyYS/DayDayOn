'use client'

import { useId, useState } from 'react'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'
import { NumberField } from '@/components/ui/number-field'
import { ProgressBar } from '@/components/ui/progress'
import { moduleMeta, type ModuleTone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
import { draftItemsTotal, emptyDraftItem, type DraftItem, type DraftItemErrors } from '../draft'

export type { DraftItem, DraftItemErrors } from '../draft'

export interface DraftField {
  label: string
  value: string
  /** 字段级说明，例如"按一碗约 250g 估算" */
  hint?: string
}

interface AiDraftCardProps {
  module: ModuleTone
  title: string
  /** 只读字段（睡眠、运动等演示）；传了 items 时不用 */
  fields?: readonly DraftField[]
  /**
   * 可逐项编辑的条目（饮食草稿）：名称、份量、热量可改，可删可加（PRD 2.6）。
   * 传了就渲染条目列表并自动算合计；"修改"按钮切换编辑态。受控：改动经 onItemsChange 回传。
   */
  items?: readonly DraftItem[]
  onItemsChange?: (items: DraftItem[]) => void
  /** 条目的校验错误（调用方用接口同一份 zod schema 算出），按条目 id 索引 */
  itemErrors?: Readonly<Record<string, DraftItemErrors>>
  /** 最多几条（饮食 20 条） */
  maxItems?: number
  /** 0–1 的置信度 */
  confidence: number
  onConfirm?: () => void
  /** 只读模式的"修改"；items 模式下"修改"切换编辑态，同时也会调用它 */
  onEdit?: () => void
  onManual?: () => void
  /** 确认提交中：主按钮转圈、禁止编辑 */
  confirming?: boolean
  /** 热量、睡眠类结果要显示"估算，非医疗建议"（架构基线 5.2 第 7 条） */
  estimate?: boolean
  className?: string
}

// 低于 0.6 提示用户核对；这个阈值和后端降级规则保持一致（features/diet/schemas.ts 的 LOW_CONFIDENCE）
const LOW_CONFIDENCE = 0.6

function confidenceLabel(c: number): string {
  if (c >= 0.85) return '把握很大'
  if (c >= LOW_CONFIDENCE) return '把握一般'
  return '把握不大'
}

/**
 * AI 草稿卡：AI 的识别结果先作为草稿，用户确认或修改后才入库（架构基线 5.2 第 2 条）。
 * 主按钮永远是"确认记录"，不提供"自动保存"。
 */
export function AiDraftCard({
  module,
  title,
  fields = [],
  items,
  onItemsChange,
  itemErrors,
  maxItems = 20,
  confidence,
  onConfirm,
  onEdit,
  onManual,
  confirming = false,
  estimate = false,
  className,
}: AiDraftCardProps) {
  const meta = moduleMeta[module]
  const low = confidence < LOW_CONFIDENCE
  const [editing, setEditing] = useState(false)
  const hasErrors = itemErrors !== undefined && Object.keys(itemErrors).length > 0
  // 有校验错误时自动进入编辑态，标红的输入框才看得到
  const showEditor = items !== undefined && (editing || hasErrors)

  function toggleEdit() {
    if (items !== undefined) setEditing((v) => !v)
    onEdit?.()
  }

  return (
    <div className={cn('bg-surface shadow-card rounded-2xl p-4', className)}>
      <div className="mb-3 flex items-center gap-2.5">
        <IconTile icon={meta.icon} tone={module} size="sm" />
        <p className="min-w-0 flex-1 truncate font-semibold">{title}</p>
        <Badge tone="primary" icon="custom">
          AI 草稿
        </Badge>
      </div>

      {items === undefined ? (
        <ReadonlyFields fields={fields} />
      ) : showEditor ? (
        <ItemEditor
          items={items}
          errors={itemErrors}
          maxItems={maxItems}
          disabled={confirming}
          onChange={(next) => onItemsChange?.(next)}
        />
      ) : (
        <ReadonlyFields fields={itemsAsFields(items)} />
      )}

      <div className="mt-3 flex items-center gap-3">
        <ProgressBar
          value={confidence * 100}
          tone={low ? 'warning' : 'success'}
          size="sm"
          label="识别把握度"
          className="flex-1"
        />
        <span
          className={cn('text-tiny font-semibold', low ? 'text-warning-ink' : 'text-success-ink')}
        >
          {confidenceLabel(confidence)}
        </span>
      </div>

      {low && (
        <p className="bg-warning-soft text-tiny text-warning-ink mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5">
          <Icon name="alert" size={14} />
          识别把握不大，建议核对数值，或改为手动填写
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          icon="check"
          onClick={onConfirm}
          loading={confirming}
          disabled={items !== undefined && items.length === 0}
          className="flex-1"
        >
          确认记录
        </Button>
        <Button
          variant="secondary"
          icon={showEditor ? 'check' : 'edit'}
          onClick={toggleEdit}
          disabled={confirming || (showEditor && hasErrors)}
        >
          {showEditor ? '改好了' : '修改'}
        </Button>
        {low && onManual && (
          <Button variant="ghost" onClick={onManual} disabled={confirming}>
            手动填写
          </Button>
        )}
      </div>

      {estimate && <p className="text-tiny text-muted mt-3 text-center">估算结果，非医疗建议</p>}
    </div>
  )
}

function ReadonlyFields({ fields }: { fields: readonly DraftField[] }) {
  return (
    <dl className="divide-border bg-surface-sunken divide-y divide-dashed rounded-xl px-3">
      {fields.map((f, i) => (
        <div key={`${i}-${f.label}`} className="flex items-baseline justify-between gap-3 py-2.5">
          <dt className="text-caption text-muted min-w-0">
            {f.label}
            {f.hint && <span className="text-tiny block">{f.hint}</span>}
          </dt>
          <dd className="font-display shrink-0 text-right font-semibold tabular-nums">{f.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function kcalText(kcal: number | null): string {
  return kcal === null ? '— kcal' : `${kcal} kcal`
}

function itemsAsFields(items: readonly DraftItem[]): DraftField[] {
  const rows: DraftField[] = items.map((i) => ({
    label: i.name || '未命名',
    value: kcalText(i.kcal),
    hint: [i.portion, i.hint].filter(Boolean).join(' · ') || undefined,
  }))
  rows.push({ label: '合计', value: `${draftItemsTotal(items)} kcal` })
  return rows
}

function ItemEditor({
  items,
  errors,
  maxItems,
  disabled,
  onChange,
}: {
  items: readonly DraftItem[]
  errors?: Readonly<Record<string, DraftItemErrors>>
  maxItems: number
  disabled: boolean
  onChange: (items: DraftItem[]) => void
}) {
  const baseId = useId()
  const update = (id: string, patch: Partial<DraftItem>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {items.map((item, index) => {
          const e = errors?.[item.id]
          const prefix = `${baseId}-${index}`
          return (
            <li key={item.id} className="bg-surface-sunken animate-fade-in rounded-xl p-3">
              <div className="flex items-start gap-2">
                <Field
                  label={`第 ${index + 1} 样`}
                  htmlFor={`${prefix}-name`}
                  error={e?.name}
                  hint={item.hint}
                  className="min-w-0 flex-1"
                >
                  <Input
                    id={`${prefix}-name`}
                    value={item.name}
                    maxLength={30}
                    placeholder="例如：番茄炒蛋"
                    disabled={disabled}
                    onChange={(ev) => update(item.id, { name: ev.target.value })}
                  />
                </Field>
                <IconButton
                  icon="trash"
                  label={`删除${item.name || `第 ${index + 1} 样`}`}
                  disabled={disabled || items.length <= 1}
                  onClick={() => onChange(items.filter((i) => i.id !== item.id))}
                  className="mt-6"
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Field label="份量" htmlFor={`${prefix}-portion`} error={e?.portion}>
                  <Input
                    id={`${prefix}-portion`}
                    value={item.portion}
                    maxLength={30}
                    placeholder="约 200 克"
                    disabled={disabled}
                    onChange={(ev) => update(item.id, { portion: ev.target.value })}
                  />
                </Field>
                <Field label="热量" htmlFor={`${prefix}-kcal`} error={e?.kcal}>
                  <NumberField
                    id={`${prefix}-kcal`}
                    value={item.kcal}
                    onValueChange={(kcal) =>
                      update(item.id, { kcal: kcal === null ? null : Math.round(kcal) })
                    }
                    min={0}
                    max={5000}
                    step={10}
                    unit="kcal"
                    disabled={disabled}
                  />
                </Field>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          icon="plus"
          disabled={disabled || items.length >= maxItems}
          onClick={() => onChange([...items, emptyDraftItem()])}
        >
          加一样
        </Button>
        <span className="text-caption text-muted">
          合计{' '}
          <span className="font-display text-foreground font-semibold tabular-nums">
            {draftItemsTotal(items)} kcal
          </span>
        </span>
      </div>
    </div>
  )
}
