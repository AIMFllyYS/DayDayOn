'use client'

import { useEffect, useRef, useState } from 'react'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { toast } from '@/components/ui/toast'
import { DietItemsSchema } from '@/features/checkin/schemas'
import { errorMessage } from '@/lib/api/error-messages'
import { isApiError, newIdempotencyKey } from '@/lib/api/fetcher'
import { useConfirmDraft } from '@/lib/api/queries/agent'
import { useMe } from '@/lib/api/queries/me'
import { BUSINESS_TIME_ZONE, formatLocalDateLabel } from '@/lib/time'
import { isDraftConfirmed, markDraftConfirmed, stableIdempotencyKey } from '../confirmed-drafts'
import type { DraftItem, DraftItemErrors } from '../draft'
import type { AgentDraft, DraftField } from '../schemas'
import { AiDraftCard } from './ai-draft-card'
import { ChangeDraftCard } from './change-draft-card'
import { MetricDraftCard } from './metric-draft-card'
import { TodoChangeDraftCard, TodoDraftCard, TodoGroupDraftCard } from './todo-draft-card'

/*
 * Agent 草稿卡的入口：按草稿 kind 分发到对应展示与确认。
 * 确认走普通接口（打卡新增/修改/删除、待办增改完弃恢复删与分组管理、体重），草稿本身不写库。
 * 按 toolCallId 持久化已确认态并派生稳定 UUID 幂等键，防止关弹窗/切全屏/刷新后重复提交。
 */

function validateDietItems(items: readonly DraftItem[]): {
  ok: boolean
  errors: Record<string, DraftItemErrors>
} {
  const parsed = DietItemsSchema.safeParse(
    items.map((i) => ({ name: i.name, portion: i.portion, kcal: i.kcal })),
  )
  if (parsed.success) return { ok: true, errors: {} }
  const errors: Record<string, DraftItemErrors> = {}
  for (const issue of parsed.error.issues) {
    const [index, field] = issue.path
    const item = typeof index === 'number' ? items[index] : undefined
    if (item && (field === 'name' || field === 'portion' || field === 'kcal')) {
      errors[item.id] = { ...errors[item.id], [field]: errors[item.id]?.[field] ?? issue.message }
    }
  }
  return { ok: false, errors }
}

function successToastText(draft: AgentDraft): string {
  switch (draft.kind) {
    case 'checkin-delete':
    case 'todo-delete':
    case 'metric-delete':
      return '删掉了'
    case 'checkin-update':
      return '改好了'
    case 'metric-upsert':
      return draft.action === 'update' ? '改好了' : '已记录'
    case 'todo-update':
      return draft.action === 'complete'
        ? '已完成'
        : draft.action === 'abandon'
          ? '已放弃'
          : draft.action === 'reopen'
            ? '已恢复进行中'
            : '改好了'
    case 'todo-group':
      return draft.action === 'create'
        ? '分组已新建'
        : draft.action === 'rename'
          ? '分组已重命名'
          : '分组已删除'
    default:
      return '已记录'
  }
}

export function DraftCard({ draft, toolCallId }: { draft: AgentDraft; toolCallId?: string }) {
  const confirm = useConfirmDraft()
  const { data: me } = useMe()
  const timeZone = me?.profile.timeZone ?? BUSINESS_TIME_ZONE

  const [items, setItems] = useState<DraftItem[] | undefined>(() =>
    draft.kind === 'checkin' ? draft.items : undefined,
  )
  const [itemErrors, setItemErrors] = useState<Record<string, DraftItemErrors>>({})
  const [confirmed, setConfirmed] = useState(false)
  const [itemsEdited, setItemsEdited] = useState(false)
  const idempotencyKeyRef = useRef<string>(
    toolCallId ? stableIdempotencyKey(toolCallId) : newIdempotencyKey(),
  )

  useEffect(() => {
    if (!toolCallId) return
    const frame = requestAnimationFrame(() => {
      if (isDraftConfirmed(toolCallId)) setConfirmed(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [toolCallId])

  const errorText = confirm.isError
    ? isApiError(confirm.error)
      ? errorMessage(confirm.error)
      : '确认失败，请重试'
    : undefined

  function handleConfirm() {
    if (confirmed || confirm.isPending) return
    let nextDraft = draft
    if (draft.kind === 'checkin' && items !== undefined) {
      const check = validateDietItems(items)
      if (!check.ok) {
        setItemErrors(check.errors)
        return
      }
      setItemErrors({})
      // 条目改过后，模型查的逐菜事实对不上了：去掉事实，入库时按新条目重新判定
      const body = Object.fromEntries(
        Object.entries(draft.confirmBody).filter(([key]) => key !== 'facts'),
      )
      nextDraft = {
        ...draft,
        items,
        confirmBody: {
          ...(itemsEdited ? body : draft.confirmBody),
          items: items.map((it) => ({
            name: it.name.trim(),
            portion: it.portion.trim(),
            kcal: it.kcal,
          })),
        },
      }
    }
    confirm.mutate(
      { draft: nextDraft, idempotencyKey: idempotencyKeyRef.current },
      {
        onSuccess: () => {
          setConfirmed(true)
          markDraftConfirmed(toolCallId)
          toast.success(successToastText(draft))
        },
        onError: (err) => {
          // 校验或冲突类错误允许用户重试时换新幂等键
          if (isApiError(err) && err.status >= 400 && err.status < 500) {
            idempotencyKeyRef.current = newIdempotencyKey()
          }
        },
      },
    )
  }

  if (draft.kind === 'checkin') {
    const isMakeup = Boolean(draft.isMakeup || draft.confirmBody.isMakeup === true)
    const makeupDateText = draft.localDate ? formatLocalDateLabel(draft.localDate) : '昨天'
    const makeupLabel = isMakeup ? `昨日补卡 · ${makeupDateText}` : undefined
    const overwriteWarning = draft.willOverwrite
      ? `确认后将覆盖该日已有记录${draft.existingSummary ? `（原记录：${draft.existingSummary}）` : ''}并重新计算`
      : undefined
    return (
      <AiDraftCard
        module={draft.module}
        title={draft.title}
        fields={draft.fields as readonly DraftField[]}
        items={items}
        itemErrors={itemErrors}
        onItemsChange={(next) => {
          setItems(next)
          setItemsEdited(true)
          setItemErrors({})
          idempotencyKeyRef.current = newIdempotencyKey()
        }}
        verdict={draft.verdict}
        verdictStale={itemsEdited}
        makeupLabel={makeupLabel}
        overwriteWarning={overwriteWarning}
        confidence={draft.confidence}
        estimate={draft.estimate}
        confirming={confirm.isPending}
        confirmed={confirmed}
        errorText={errorText}
        onConfirm={handleConfirm}
      />
    )
  }

  if (draft.kind === 'checkin-update' || draft.kind === 'checkin-delete') {
    return (
      <ChangeDraftCard
        mode={draft.kind === 'checkin-delete' ? 'delete' : 'update'}
        module={draft.module}
        title={draft.title}
        dateLabel={formatLocalDateLabel(draft.localDate)}
        reason={draft.reason}
        before={draft.before}
        after={draft.kind === 'checkin-update' ? draft.after : undefined}
        fields={draft.kind === 'checkin-update' ? draft.fields : undefined}
        verdict={draft.kind === 'checkin-update' ? draft.verdict : undefined}
        confirming={confirm.isPending}
        confirmed={confirmed}
        errorText={errorText}
        onConfirm={handleConfirm}
      />
    )
  }

  if (draft.kind === 'todo') {
    return (
      <TodoDraftCard
        title={draft.title}
        note={draft.note}
        dueAt={draft.dueAt}
        priority={draft.priority}
        groupName={draft.groupName}
        isNewGroup={draft.isNewGroup}
        tags={draft.tags}
        timeZone={timeZone}
        confirming={confirm.isPending}
        confirmed={confirmed}
        errorText={errorText}
        onConfirm={handleConfirm}
      />
    )
  }

  if (draft.kind === 'todo-update' || draft.kind === 'todo-delete') {
    return (
      <TodoChangeDraftCard
        mode={draft.kind === 'todo-delete' ? 'delete' : 'update'}
        action={draft.kind === 'todo-update' ? draft.action : undefined}
        reason={draft.reason}
        before={draft.before}
        after={draft.kind === 'todo-update' ? draft.after : undefined}
        changes={draft.kind === 'todo-update' ? draft.changes : undefined}
        timeZone={timeZone}
        confirming={confirm.isPending}
        confirmed={confirmed}
        errorText={errorText}
        onConfirm={handleConfirm}
      />
    )
  }

  if (draft.kind === 'todo-group') {
    return (
      <TodoGroupDraftCard
        action={draft.action}
        name={draft.name}
        newName={draft.newName}
        affectedTodoCount={draft.affectedTodoCount}
        reason={draft.reason}
        confirming={confirm.isPending}
        confirmed={confirmed}
        errorText={errorText}
        onConfirm={handleConfirm}
      />
    )
  }

  if (draft.kind === 'metric-upsert' || draft.kind === 'metric-delete') {
    return (
      <MetricDraftCard
        mode={draft.kind === 'metric-delete' ? 'delete' : draft.action}
        metric={draft.metric}
        targetDay={draft.targetDay}
        localDate={draft.localDate}
        beforeLabel={draft.beforeLabel}
        afterLabel={draft.kind === 'metric-upsert' ? draft.afterLabel : undefined}
        reason={draft.reason}
        confirming={confirm.isPending}
        confirmed={confirmed}
        errorText={errorText}
        onConfirm={handleConfirm}
      />
    )
  }

  // draft.kind === 'weight'（兼容历史旧会话消息）
  return (
    <div className="bg-surface shadow-card rounded-xl p-3.5 md:rounded-2xl md:p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <IconTile icon="chart" tone="primary" size="sm" />
        <p className="min-w-0 flex-1 truncate font-semibold">体重草稿</p>
        <Badge tone={confirmed ? 'success' : 'primary'} icon={confirmed ? 'check' : 'custom'}>
          {confirmed ? '已记录' : 'AI 草稿'}
        </Badge>
      </div>

      <dl className="bg-surface-sunken divide-border divide-y divide-dashed rounded-xl px-3">
        <div className="flex items-baseline justify-between gap-3 py-2.5">
          <dt className="text-caption text-muted shrink-0">体重</dt>
          <dd className="font-display text-foreground min-w-0 flex-1 text-right font-semibold tabular-nums">
            {draft.weightKg} kg
          </dd>
        </div>
      </dl>

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
        icon="check"
        className="mt-4 w-full"
        loading={confirm.isPending}
        disabled={confirmed}
        onClick={handleConfirm}
      >
        {confirmed ? '已记录' : '确认记录'}
      </Button>
    </div>
  )
}
