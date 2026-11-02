'use client'

import { Badge, IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { useConfirmDraft } from '@/lib/api/queries/agent'
import type { AgentDraft, DraftField } from '../schemas'
import { AiDraftCard } from './ai-draft-card'

/*
 * Agent 草稿卡的入口：按草稿 kind 分发到对应展示与确认。
 * 确认走普通创建接口（打卡 / 待办 / 体重），草稿本身不写库。
 */

export function DraftCard({ draft }: { draft: AgentDraft }) {
  const confirm = useConfirmDraft()

  if (draft.kind === 'checkin') {
    return (
      <AiDraftCard
        module={draft.module}
        title={draft.title}
        fields={draft.fields as readonly DraftField[]}
        items={draft.items}
        confidence={draft.confidence}
        estimate={draft.estimate}
        confirming={confirm.isPending}
        onConfirm={() => confirm.mutate({ draft })}
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
        <Badge tone="primary" icon="custom">
          AI 草稿
        </Badge>
      </div>

      <dl className="bg-surface-sunken divide-border divide-y divide-dashed rounded-xl px-3">
        {draft.kind === 'todo' ? (
          <>
            <Row label="内容" value={draft.title} />
            <Row
              label="截止"
              value={draft.dueAt ? new Date(draft.dueAt).toLocaleString('zh-CN') : '不设'}
            />
            <Row label="优先级" value={draft.priority === 'important' ? '重要' : '普通'} />
          </>
        ) : (
          <Row label="体重" value={`${draft.weightKg} kg`} />
        )}
      </dl>

      {confirm.isError && (
        <p className="text-tiny text-danger-ink mt-2 flex items-center gap-1.5">
          <Icon name="alert" size={14} />
          确认失败，请重试
        </p>
      )}

      <Button
        icon="check"
        className="mt-4 w-full"
        loading={confirm.isPending}
        onClick={() => confirm.mutate({ draft })}
      >
        确认记录
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
