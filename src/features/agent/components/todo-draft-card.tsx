'use client'

import { useState } from 'react'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { TODO_PRIORITY_META } from '@/features/todo/rules'
import type { TodoPriority } from '@/features/todo/schemas'
import { cn } from '@/lib/cn'
import { BUSINESS_TIME_ZONE, formatDateTime } from '@/lib/time'
import type {
  DraftField,
  TodoDraft,
  TodoDraftSnapshot,
  TodoGroupDraft,
  TodoUpdateDraft,
} from '../schemas'

/*
 * 待办草稿系列纯展示组件（Playbook First，先在 /dev/playbook/agent 定稿再接入 DraftCard）：
 * - TodoDraftCard：新建待办草稿（支持长备注折叠展开、窄屏安全折行，不误用 font-display/shrink-0）
 * - TodoChangeDraftCard：编辑 / 完成 / 放弃 / 恢复（含归档）/ 删除待办草稿
 * - TodoGroupDraftCard：新建 / 重命名 / 删除自定义分组草稿
 */

const NOTE_COLLAPSE_THRESHOLD = 48

const LEGACY_PRIORITY_MAP: Record<string, TodoPriority> = {
  important: 'urgent-important',
  normal: 'not-important-not-urgent',
  'urgent-important': 'urgent-important',
  'important-not-urgent': 'important-not-urgent',
  'urgent-not-important': 'urgent-not-important',
  'not-important-not-urgent': 'not-important-not-urgent',
}

export function normalizeTodoPriority(raw: string): TodoPriority {
  return LEGACY_PRIORITY_MAP[raw] ?? 'not-important-not-urgent'
}

const STATUS_LABEL: Record<TodoDraftSnapshot['status'], string> = {
  open: '进行中',
  done: '已完成',
  abandoned: '已放弃',
}

function DetailRow({
  label,
  value,
  numeric = false,
}: {
  label: string
  value: string
  numeric?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt className="text-caption text-muted shrink-0">{label}</dt>
      <dd
        className={cn(
          'text-caption text-foreground min-w-0 flex-1 text-right font-semibold break-words',
          numeric && 'tabular-nums',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function ExpandableNoteRow({ note }: { note: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = note.length > NOTE_COLLAPSE_THRESHOLD
  const shown = isLong && !expanded ? `${note.slice(0, NOTE_COLLAPSE_THRESHOLD)}…` : note

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-caption text-muted shrink-0">备注</dt>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-tiny text-primary-ink hover:underline"
          >
            {expanded ? '收起' : `展开全文（${note.length} 字）`}
          </button>
        )}
      </div>
      <dd className="text-caption text-foreground mt-1 break-words whitespace-pre-wrap">{shown}</dd>
    </div>
  )
}

function ErrorAlert({ text }: { text: string }) {
  return (
    <p
      role="alert"
      className="bg-danger-soft text-tiny text-danger-ink mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
    >
      <Icon name="alert" size={14} className="shrink-0" />
      <span className="min-w-0 break-words">{text}</span>
    </p>
  )
}

// ---------------------------------------------------------------------------
// 1. 新建待办草稿卡
// ---------------------------------------------------------------------------

export interface TodoDraftCardProps {
  title: string
  note?: string | null
  dueAt: string | null
  priority: TodoDraft['priority']
  groupName?: string
  isNewGroup?: boolean
  tags?: readonly string[]
  timeZone?: string
  confirming?: boolean
  confirmed?: boolean
  errorText?: string
  onConfirm?: () => void
  className?: string
}

export function TodoDraftCard({
  title,
  note,
  dueAt,
  priority,
  groupName,
  isNewGroup,
  tags,
  timeZone = BUSINESS_TIME_ZONE,
  confirming = false,
  confirmed = false,
  errorText,
  onConfirm,
  className,
}: TodoDraftCardProps) {
  const normalizedPriority = normalizeTodoPriority(priority)
  const priorityLabel = TODO_PRIORITY_META[normalizedPriority].label

  return (
    <div className={cn('bg-surface shadow-card rounded-xl p-3.5 md:rounded-2xl md:p-4', className)}>
      <div className="mb-3 flex items-center gap-2.5">
        <IconTile icon="todo" tone="neutral" size="sm" />
        <p className="min-w-0 flex-1 truncate font-semibold">待办草稿</p>
        <Badge tone={confirmed ? 'success' : 'primary'} icon={confirmed ? 'check' : 'custom'}>
          {confirmed ? '已记录' : 'AI 草稿'}
        </Badge>
      </div>

      <dl className="bg-surface-sunken divide-border divide-y divide-dashed rounded-xl px-3">
        <DetailRow label="内容" value={title} />
        {groupName && (
          <DetailRow label="分组" value={isNewGroup ? `${groupName}（将新建）` : groupName} />
        )}
        <DetailRow label="截止" value={dueAt ? formatDateTime(dueAt, timeZone) : '不设'} numeric />
        <DetailRow label="优先级" value={priorityLabel} />
        {tags && tags.length > 0 && <DetailRow label="标签" value={tags.join(' · ')} />}
        {note && <ExpandableNoteRow note={note} />}
      </dl>

      {errorText && <ErrorAlert text={errorText} />}

      <Button
        icon="check"
        className="mt-4 w-full"
        loading={confirming}
        disabled={confirmed}
        onClick={onConfirm}
      >
        {confirmed ? '已记录' : '确认记录'}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 2. 修改 / 完成 / 放弃 / 恢复 / 删除待办草稿卡
// ---------------------------------------------------------------------------

export interface TodoChangeDraftCardProps {
  mode: 'update' | 'delete'
  action?: TodoUpdateDraft['action']
  reason: string
  before: TodoDraftSnapshot
  after?: TodoDraftSnapshot
  changes?: readonly DraftField[]
  timeZone?: string
  confirming?: boolean
  confirmed?: boolean
  errorText?: string
  onConfirm?: () => void
  className?: string
}

const UPDATE_ACTION_COPY: Record<
  TodoUpdateDraft['action'],
  {
    heading: string
    badge: string
    button: string
    done: string
    tone: 'primary' | 'success' | 'warning'
  }
> = {
  edit: {
    heading: '修改待办',
    badge: '修改草稿',
    button: '确认修改',
    done: '已修改',
    tone: 'primary',
  },
  complete: {
    heading: '完成待办',
    badge: '完成草稿',
    button: '确认完成',
    done: '已完成',
    tone: 'success',
  },
  abandon: {
    heading: '放弃待办',
    badge: '放弃草稿',
    button: '确认放弃',
    done: '已放弃',
    tone: 'warning',
  },
  reopen: {
    heading: '恢复待办',
    badge: '恢复草稿',
    button: '确认恢复',
    done: '已恢复',
    tone: 'primary',
  },
}

function TodoSnapshotRow({
  label,
  snap,
  timeZone,
  struck = false,
}: {
  label: string
  snap: TodoDraftSnapshot
  timeZone: string
  struck?: boolean
}) {
  const statusText = snap.isArchived ? '已归档' : STATUS_LABEL[snap.status]
  const metaParts = [
    snap.groupName,
    TODO_PRIORITY_META[snap.priority].label,
    snap.dueAt ? `截止 ${formatDateTime(snap.dueAt, timeZone)}` : '无截止时间',
    statusText,
  ]
  return (
    <div className="py-2.5">
      <p className="text-tiny text-muted">{label}</p>
      <p
        className={cn(
          'text-caption mt-0.5 font-semibold break-words',
          struck && 'text-muted line-through',
        )}
      >
        {snap.title}
      </p>
      <p className="text-tiny text-muted mt-0.5 break-words">{metaParts.join(' · ')}</p>
      {snap.tags.length > 0 && (
        <p className="text-tiny text-muted mt-0.5 break-words">标签：{snap.tags.join(' · ')}</p>
      )}
      {snap.abandonReason && (
        <p className="text-tiny text-warning-ink mt-0.5 break-words">
          放弃原因：{snap.abandonReason}
        </p>
      )}
    </div>
  )
}

export function TodoChangeDraftCard({
  mode,
  action = 'edit',
  reason,
  before,
  after,
  changes = [],
  timeZone = BUSINESS_TIME_ZONE,
  confirming = false,
  confirmed = false,
  errorText,
  onConfirm,
  className,
}: TodoChangeDraftCardProps) {
  const isDelete = mode === 'delete'
  const copy = UPDATE_ACTION_COPY[action]
  const doneText = isDelete ? '已删除' : copy.done

  return (
    <div className={cn('bg-surface shadow-card rounded-xl p-3.5 md:rounded-2xl md:p-4', className)}>
      <div className="mb-3 flex items-center gap-2.5">
        <IconTile
          icon={isDelete ? 'trash' : action === 'complete' ? 'check' : 'todo'}
          tone={isDelete ? 'danger' : copy.tone}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{isDelete ? '删除待办' : copy.heading}</p>
          <p className="text-tiny text-muted truncate">{before.groupName}</p>
        </div>
        <Badge
          tone={confirmed ? 'success' : isDelete ? 'danger' : copy.tone}
          icon={confirmed ? 'check' : isDelete ? 'trash' : 'edit'}
        >
          {confirmed ? doneText : isDelete ? '删除草稿' : copy.badge}
        </Badge>
      </div>

      <div className="bg-surface-sunken divide-border divide-y divide-dashed rounded-xl px-3">
        <TodoSnapshotRow
          label={isDelete ? '要删除的待办' : '变更前'}
          snap={before}
          timeZone={timeZone}
          struck={isDelete}
        />
        {!isDelete && after && <TodoSnapshotRow label="变更后" snap={after} timeZone={timeZone} />}
        {!isDelete && changes.length > 0 && (
          <dl className="divide-border/60 divide-y divide-dashed">
            {changes.map((c, idx) => (
              <DetailRow key={`${idx}-${c.label}`} label={c.label} value={c.value} />
            ))}
          </dl>
        )}
        <div className="flex items-start gap-1.5 py-2.5">
          <Icon name="pen" size={14} className="text-muted mt-0.5 shrink-0" />
          <p className="text-tiny text-muted min-w-0 flex-1 break-words">原因：{reason}</p>
        </div>
      </div>

      <p className="text-tiny text-muted mt-3">
        {isDelete
          ? '确认后将移除这条待办，过程时间轴会保留本次删除快照。'
          : action === 'reopen' && before.isArchived
            ? '确认后将从已归档恢复回进行中清单。'
            : '确认后立即更新待办清单并记入过程时间轴。'}
      </p>

      {errorText && <ErrorAlert text={errorText} />}

      <Button
        icon={confirmed ? 'check' : isDelete ? 'trash' : 'check'}
        variant={isDelete ? 'danger' : 'primary'}
        className="mt-3 w-full"
        loading={confirming}
        disabled={confirmed}
        onClick={onConfirm}
      >
        {confirmed ? doneText : isDelete ? '确认删除' : copy.button}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3. 待办分组管理草稿卡
// ---------------------------------------------------------------------------

export interface TodoGroupDraftCardProps {
  action: TodoGroupDraft['action']
  name: string
  newName?: string
  affectedTodoCount?: number
  reason?: string
  confirming?: boolean
  confirmed?: boolean
  errorText?: string
  onConfirm?: () => void
  className?: string
}

export function TodoGroupDraftCard({
  action,
  name,
  newName,
  affectedTodoCount = 0,
  reason,
  confirming = false,
  confirmed = false,
  errorText,
  onConfirm,
  className,
}: TodoGroupDraftCardProps) {
  const isDelete = action === 'delete'
  const heading =
    action === 'create' ? '新建待办分组' : action === 'rename' ? '重命名待办分组' : '删除待办分组'
  const doneText = action === 'create' ? '已新建' : action === 'rename' ? '已重命名' : '已删除'
  const buttonText =
    action === 'create' ? '确认新建分组' : action === 'rename' ? '确认重命名' : '确认删除分组'

  return (
    <div className={cn('bg-surface shadow-card rounded-xl p-3.5 md:rounded-2xl md:p-4', className)}>
      <div className="mb-3 flex items-center gap-2.5">
        <IconTile
          icon={isDelete ? 'trash' : 'folder'}
          tone={isDelete ? 'danger' : 'study'}
          size="sm"
        />
        <p className="min-w-0 flex-1 truncate font-semibold">{heading}</p>
        <Badge
          tone={confirmed ? 'success' : isDelete ? 'danger' : 'primary'}
          icon={confirmed ? 'check' : isDelete ? 'trash' : 'folder'}
        >
          {confirmed ? doneText : isDelete ? '删除草稿' : 'AI 草稿'}
        </Badge>
      </div>

      <dl className="bg-surface-sunken divide-border divide-y divide-dashed rounded-xl px-3">
        <DetailRow label={action === 'rename' ? '原分组名' : '分组名'} value={name} />
        {action === 'rename' && newName && <DetailRow label="新分组名" value={newName} />}
        {isDelete && (
          <DetailRow
            label="组内待办"
            value={
              affectedTodoCount > 0
                ? `${affectedTodoCount} 条将自动迁回「默认待办」`
                : '空分组，无待办受影响'
            }
          />
        )}
        {reason && <DetailRow label="原因" value={reason} />}
      </dl>

      {errorText && <ErrorAlert text={errorText} />}

      <Button
        icon={confirmed ? 'check' : isDelete ? 'trash' : 'check'}
        variant={isDelete ? 'danger' : 'primary'}
        className="mt-3 w-full"
        loading={confirming}
        disabled={confirmed}
        onClick={onConfirm}
      >
        {confirmed ? doneText : buttonText}
      </Button>
    </div>
  )
}
