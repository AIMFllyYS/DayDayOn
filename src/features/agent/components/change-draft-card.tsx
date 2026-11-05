'use client'

import { Badge, IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { moduleMeta, type ModuleTone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
import type { DraftField, DraftSnapshot, DraftVerdict } from '../schemas'
import { VerdictStrip } from './verdict-strip'

/*
 * 改打卡 / 删打卡的草稿卡（checkin-modules.md 第 8 节）：Agent 只能动今天和昨天的打卡，
 * 卡片上写清楚改哪天的哪条、为什么改、改前改后有什么不同；用户点确认后才调修改 / 删除接口。
 */

export interface ChangeDraftCardProps {
  mode: 'update' | 'delete'
  module: ModuleTone
  /** 目标名 */
  title: string
  /** 「今天」「昨天 11月4日」 */
  dateLabel: string
  reason: string
  before: DraftSnapshot
  /** 修改后的样子（删除没有） */
  after?: DraftSnapshot
  /** 修改后的内容明细 */
  fields?: readonly DraftField[]
  verdict?: DraftVerdict
  confirming?: boolean
  confirmed?: boolean
  errorText?: string
  onConfirm?: () => void
  className?: string
}

function stateText(s: DraftSnapshot): string {
  const valid = s.isValid ? '达标' : '未达标'
  return s.score === null ? valid : `${valid} · ${s.score.toFixed(1)} 分`
}

function SnapshotRow({
  label,
  snap,
  struck = false,
}: {
  label: string
  snap: DraftSnapshot
  struck?: boolean
}) {
  return (
    <div className="py-2.5">
      <p className="text-tiny text-muted">{label}</p>
      <p className={cn('text-caption mt-0.5 break-words', struck && 'text-muted line-through')}>
        {snap.summary}
      </p>
      {snap.note && <p className="text-tiny text-muted mt-0.5 break-words">备注：{snap.note}</p>}
      <p className={cn('text-tiny mt-0.5', snap.isValid ? 'text-success-ink' : 'text-warning-ink')}>
        {stateText(snap)}
      </p>
    </div>
  )
}

export function ChangeDraftCard({
  mode,
  module,
  title,
  dateLabel,
  reason,
  before,
  after,
  fields = [],
  verdict,
  confirming = false,
  confirmed = false,
  errorText,
  onConfirm,
  className,
}: ChangeDraftCardProps) {
  const meta = moduleMeta[module]
  const isDelete = mode === 'delete'
  const doneText = isDelete ? '已删除' : '已修改'
  return (
    <div className={cn('bg-surface shadow-card rounded-xl p-3.5 md:rounded-2xl md:p-4', className)}>
      <div className="mb-3 flex items-center gap-2.5">
        <IconTile icon={meta.icon} tone={module} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{title}</p>
          <p className="text-tiny text-muted">{dateLabel}的打卡</p>
        </div>
        <Badge
          tone={confirmed ? 'success' : isDelete ? 'danger' : 'primary'}
          icon={confirmed ? 'check' : isDelete ? 'trash' : 'edit'}
        >
          {confirmed ? doneText : isDelete ? '删除草稿' : '修改草稿'}
        </Badge>
      </div>

      <div className="bg-surface-sunken divide-border divide-y divide-dashed rounded-xl px-3">
        <SnapshotRow label={isDelete ? '要删除的记录' : '改前'} snap={before} struck={isDelete} />
        {after && <SnapshotRow label="改后" snap={after} />}
        {fields.length > 0 && (
          <dl className="py-1">
            {fields.map((f, i) => (
              <div
                key={`${i}-${f.label}`}
                className="flex items-baseline justify-between gap-3 py-1"
              >
                <dt className="text-tiny text-muted min-w-0">{f.label}</dt>
                <dd className="text-caption shrink-0 text-right font-semibold tabular-nums">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <div className="flex items-start gap-1.5 py-2.5">
          <Icon name="pen" size={14} className="text-muted mt-0.5 shrink-0" />
          <p className="text-tiny text-muted break-words">原因：{reason}</p>
        </div>
      </div>

      {verdict && <VerdictStrip verdict={verdict} className="mt-3" />}

      <p className="text-tiny text-muted mt-3">
        {isDelete
          ? '删除后当天进度和连续天数会重新计算；这条记录的留痕会保留。'
          : '确认后按新内容重新判定，进度跟着变；改动会留痕。'}
      </p>

      {errorText && (
        <p
          role="alert"
          className="bg-danger-soft text-tiny text-danger-ink mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
        >
          <Icon name="alert" size={14} />
          {errorText}
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
        {confirmed ? doneText : isDelete ? '确认删除' : '确认修改'}
      </Button>
    </div>
  )
}
