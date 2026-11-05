'use client'

import { useRef, useState } from 'react'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { toast } from '@/components/ui/toast'
import { DietItemsSchema } from '@/features/checkin/schemas'
import { errorMessage } from '@/lib/api/error-messages'
import { isApiError, newIdempotencyKey } from '@/lib/api/fetcher'
import { useConfirmDraft } from '@/lib/api/queries/agent'
import { useMe } from '@/lib/api/queries/me'
import { cn } from '@/lib/cn'
import { BUSINESS_TIME_ZONE, formatDateTime, formatLocalDateLabel } from '@/lib/time'
import type { DraftItem, DraftItemErrors } from '../draft'
import type { AgentDraft, DraftField } from '../schemas'
import { AiDraftCard } from './ai-draft-card'
import { ChangeDraftCard } from './change-draft-card'

/*
 * Agent 草稿卡的入口：按草稿 kind 分发到对应展示与确认。
 * 确认走普通接口（打卡新增 / 修改 / 删除、待办、体重），草稿本身不写库。
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

export function DraftCard({ draft }: { draft: AgentDraft }) {
  const confirm = useConfirmDraft()
  const { data: me } = useMe()
  const timeZone = me?.profile.timeZone ?? BUSINESS_TIME_ZONE

  const [items, setItems] = useState<DraftItem[] | undefined>(() =>
    draft.kind === 'checkin' ? draft.items : undefined,
  )
  const [itemErrors, setItemErrors] = useState<Record<string, DraftItemErrors>>({})
  const [confirmed, setConfirmed] = useState(false)
  const [itemsEdited, setItemsEdited] = useState(false)
  const idempotencyKeyRef = useRef<string>(newIdempotencyKey())

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
          toast.success(
            draft.kind === 'checkin-delete'
              ? '删掉了'
              : draft.kind === 'checkin-update'
                ? '改好了'
                : '已记录',
          )
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

  return (
    <div className="bg-surface shadow-card rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <IconTile
          icon={draft.kind === 'todo' ? 'todo' : 'chart'}
          tone={draft.kind === 'todo' ? 'neutral' : 'primary'}
          size="sm"
        />
        <p className="min-w-0 flex-1 truncate font-semibold">
          {draft.kind === 'todo' ? '待办草稿' : '体重草稿'}
        </p>
        <Badge tone={confirmed ? 'success' : 'primary'} icon={confirmed ? 'check' : 'custom'}>
          {confirmed ? '已记录' : 'AI 草稿'}
        </Badge>
      </div>

      <dl className="bg-surface-sunken divide-border divide-y divide-dashed rounded-xl px-3">
        {draft.kind === 'todo' ? (
          <>
            <Row label="内容" value={draft.title} />
            <Row
              label="截止"
              value={draft.dueAt ? formatDateTime(draft.dueAt, timeZone) : '不设'}
            />
            <Row label="优先级" value={draft.priority === 'important' ? '重要' : '普通'} />
          </>
        ) : (
          <Row label="体重" value={`${draft.weightKg} kg`} />
        )}
      </dl>

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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt className="text-caption text-muted">{label}</dt>
      <dd className={cn('font-display shrink-0 text-right font-semibold tabular-nums')}>{value}</dd>
    </div>
  )
}
