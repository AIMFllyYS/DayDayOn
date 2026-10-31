import { Badge, IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { ProgressBar } from '@/components/ui/progress'
import { moduleMeta, type ModuleTone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'

export interface DraftField {
  label: string
  value: string
  /** 字段级说明，例如"按一碗约 250g 估算" */
  hint?: string
}

interface AiDraftCardProps {
  module: ModuleTone
  title: string
  fields: readonly DraftField[]
  /** 0–1 的置信度 */
  confidence: number
  onConfirm?: () => void
  onEdit?: () => void
  onManual?: () => void
  /** 热量、睡眠类结果要显示"估算，非医疗建议"（架构基线 5.2 第 7 条） */
  estimate?: boolean
  className?: string
}

// 低于 0.6 提示用户核对；这个阈值和后端降级规则保持一致，改动时两边一起改
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
  fields,
  confidence,
  onConfirm,
  onEdit,
  onManual,
  estimate = false,
  className,
}: AiDraftCardProps) {
  const meta = moduleMeta[module]
  const low = confidence < LOW_CONFIDENCE
  return (
    <div className={cn('bg-surface shadow-card rounded-2xl p-4', className)}>
      <div className="mb-3 flex items-center gap-2.5">
        <IconTile icon={meta.icon} tone={module} size="sm" />
        <p className="min-w-0 flex-1 truncate font-semibold">{title}</p>
        <Badge tone="primary" icon="custom">
          AI 草稿
        </Badge>
      </div>

      <dl className="divide-border bg-surface-sunken divide-y divide-dashed rounded-xl px-3">
        {fields.map((f) => (
          <div key={f.label} className="flex items-baseline justify-between gap-3 py-2.5">
            <dt className="text-caption text-muted">{f.label}</dt>
            <dd className="text-right">
              <span className="font-display font-semibold">{f.value}</span>
              {f.hint && <span className="text-tiny text-muted block">{f.hint}</span>}
            </dd>
          </div>
        ))}
      </dl>

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
        <Button icon="check" onClick={onConfirm} className="flex-1">
          确认记录
        </Button>
        <Button variant="secondary" icon="edit" onClick={onEdit}>
          修改
        </Button>
        {low && (
          <Button variant="ghost" onClick={onManual}>
            手动填写
          </Button>
        )}
      </div>

      {estimate && <p className="text-tiny text-muted mt-3 text-center">估算结果，非医疗建议</p>}
    </div>
  )
}
