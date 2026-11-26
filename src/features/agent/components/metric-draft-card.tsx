'use client'

import { Badge, IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icon, type IconName } from '@/components/ui/icon'
import type { Tone } from '@/components/ui/tone'
import type { MetricKind } from '@/features/metric/schemas'
import { cn } from '@/lib/cn'
import { formatLocalDateLabel } from '@/lib/time'

/*
 * 每日指标（体重 / 心情 / 步数）的 Agent 草稿卡：
 * 统一承载今日与昨日的新建、覆盖修改（改前→改后对比）、删除（危险态警示）。
 * 确认后才调普通 /api/v1 接口写入或删除，草稿本身不落库。
 */

const METRIC_META: Record<MetricKind, { label: string; icon: IconName; tone: Tone }> = {
  weight: { label: '体重', icon: 'chart', tone: 'primary' },
  mood: { label: '心情', icon: 'heart', tone: 'custom' },
  steps: { label: '步数', icon: 'footprints', tone: 'exercise' },
}

export interface MetricDraftCardProps {
  mode: 'create' | 'update' | 'delete'
  metric: MetricKind
  targetDay: 'today' | 'yesterday'
  localDate: string
  /** 改前 / 要删除的原记录文本；新建为 null */
  beforeLabel?: string | null
  /** 新建或改后的目标值文本；删除为 undefined */
  afterLabel?: string
  reason?: string
  confirming?: boolean
  confirmed?: boolean
  errorText?: string
  onConfirm?: () => void
  className?: string
}

export function MetricDraftCard({
  mode,
  metric,
  targetDay,
  localDate,
  beforeLabel = null,
  afterLabel,
  reason,
  confirming = false,
  confirmed = false,
  errorText,
  onConfirm,
  className,
}: MetricDraftCardProps) {
  const meta = METRIC_META[metric]
  const isDelete = mode === 'delete'
  const isUpdate = mode === 'update'
  const dateText = formatLocalDateLabel(localDate)
  const dayPrefix = targetDay === 'yesterday' ? '昨日' : '今日'
  const doneText = isDelete ? '已删除' : isUpdate ? '已修改' : '已记录'
  const titleText = isDelete
    ? `删除${dayPrefix}${meta.label}`
    : isUpdate
      ? `修改${dayPrefix}${meta.label}`
      : `记录${dayPrefix}${meta.label}`

  return (
    <div className={cn('bg-surface shadow-card rounded-xl p-3.5 md:rounded-2xl md:p-4', className)}>
      <div className="mb-3 flex items-center gap-2.5">
        <IconTile icon={meta.icon} tone={isDelete ? 'danger' : meta.tone} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{titleText}</p>
          <p className="text-tiny text-muted">
            {dayPrefix} · {dateText}
          </p>
        </div>
        <Badge
          tone={confirmed ? 'success' : isDelete ? 'danger' : isUpdate ? 'warning' : 'primary'}
          icon={confirmed ? 'check' : isDelete ? 'trash' : isUpdate ? 'edit' : 'custom'}
        >
          {confirmed ? doneText : isDelete ? '删除草稿' : isUpdate ? '覆盖修改' : 'AI 草稿'}
        </Badge>
      </div>

      <dl className="bg-surface-sunken divide-border divide-y divide-dashed rounded-xl px-3">
        {isDelete && beforeLabel && (
          <div className="flex items-baseline justify-between gap-3 py-2.5">
            <dt className="text-caption text-muted shrink-0">要删除的记录</dt>
            <dd className="font-display text-muted min-w-0 flex-1 text-right font-semibold tabular-nums line-through">
              {beforeLabel}
            </dd>
          </div>
        )}

        {isUpdate && beforeLabel && (
          <div className="flex items-baseline justify-between gap-3 py-2.5">
            <dt className="text-caption text-muted shrink-0">原记录</dt>
            <dd className="font-display text-muted min-w-0 flex-1 text-right font-semibold tabular-nums">
              {beforeLabel}
            </dd>
          </div>
        )}

        {!isDelete && afterLabel && (
          <div className="flex items-baseline justify-between gap-3 py-2.5">
            <dt className="text-caption text-muted shrink-0">{isUpdate ? '修改为' : meta.label}</dt>
            <dd className="font-display text-foreground min-w-0 flex-1 text-right font-semibold tabular-nums">
              {afterLabel}
            </dd>
          </div>
        )}

        {reason && (
          <div className="flex items-start gap-1.5 py-2.5">
            <Icon name="pen" size={14} className="text-muted mt-0.5 shrink-0" />
            <p className="text-tiny text-muted break-words">原因：{reason}</p>
          </div>
        )}
      </dl>

      {isUpdate && (
        <p className="text-tiny text-warning-ink mt-2.5">
          确认后将覆盖{dayPrefix}已有{meta.label}记录，走势图与详情统计同步更新。
        </p>
      )}
      {isDelete && (
        <p className="text-tiny text-muted mt-2.5">
          删除后将从走势图与详细记录中移除{dayPrefix}的{meta.label}数据。
        </p>
      )}

      {errorText && (
        <p
          role="alert"
          className="bg-danger-soft text-tiny text-danger-ink mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
        >
          <Icon name="alert" size={14} className="shrink-0" />
          <span className="min-w-0 break-words">{errorText}</span>
        </p>
      )}

      <Button
        icon={confirmed ? 'check' : isDelete ? 'trash' : 'check'}
        variant={isDelete ? 'danger' : 'primary'}
        className="mt-3 w-full"
        loading={confirming}
        disabled={confirmed}
        onClick={onConfirm}
      >
        {confirmed ? doneText : isDelete ? '确认删除' : isUpdate ? '确认修改' : '确认记录'}
      </Button>
    </div>
  )
}
