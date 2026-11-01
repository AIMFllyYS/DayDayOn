'use client'

import { useId, useState, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Field, Input } from '@/components/ui/field'
import { Form, type FormErrors } from '@/components/ui/form'
import { MenuItem, MenuList } from '@/components/ui/menu-list'
import { Sheet } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { QuotaMeter } from '@/features/agent/components/quota-meter'
import { formatYuan } from '@/features/agent/format'
import { formatBusinessDateTime, formatRelative, BUSINESS_TIME_ZONE } from '@/lib/time'
import { formatRunCost, PURPOSE_LABEL, RUN_STATUS_LABEL } from '../format'
import type { AiRunItem, QuotaView } from '../schemas'

/*
 * 「我的」页额度卡（PRD 2.7、2.11）的纯展示：QuotaMeter + 加购余额 + "兑换额度"抽屉 + "使用记录"抽屉。
 * 数据与请求由 QuotaCard 接入；Playbook 用演示数据直接渲染。
 */

export type LoadState<T> =
  | { status: 'pending' }
  | { status: 'error'; message: string; onRetry: () => void; retrying?: boolean }
  | { status: 'success'; data: T }

export interface QuotaCardViewProps {
  quota: LoadState<QuotaView>
  runs: LoadState<AiRunItem[]>
  /** 打开"使用记录"时才开始请求 */
  onRunsOpen?: () => void
  /** 兑换表单的状态与回调（错误交给 Form errors，字段名 code） */
  redeem: {
    pending: boolean
    errors?: FormErrors
    onSubmit: (code: string) => void
    onReset: () => void
    /** 成功后显示一次 */
    successText?: string
  }
  now?: Date
}

export function QuotaCardView({ quota, runs, onRunsOpen, redeem, now }: QuotaCardViewProps) {
  const [sheet, setSheet] = useState<'redeem' | 'runs' | null>(null)

  function open(next: 'redeem' | 'runs') {
    if (next === 'runs') onRunsOpen?.()
    if (next === 'redeem') redeem.onReset()
    setSheet(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <QuotaSummary quota={quota} />
      <MenuList>
        <MenuItem
          icon="bolt"
          tone="primary"
          label="兑换额度"
          description="输入兑换码，加到长期有效的加购余额"
          onClick={() => open('redeem')}
        />
        <MenuItem
          icon="clock"
          tone="study"
          label="使用记录"
          description="最近 20 次 AI 调用"
          onClick={() => open('runs')}
        />
      </MenuList>

      <Sheet
        open={sheet === 'redeem'}
        onOpenChange={(o) => setSheet(o ? 'redeem' : null)}
        title="兑换额度"
        description="一个兑换码加 10 元，长期有效，本周额度用完后再扣"
      >
        <RedeemForm {...redeem} />
      </Sheet>

      <Sheet
        open={sheet === 'runs'}
        onOpenChange={(o) => setSheet(o ? 'runs' : null)}
        title="使用记录"
        description="照片只用来识别，识别后不保存"
      >
        <RunList runs={runs} now={now} />
      </Sheet>
    </div>
  )
}

function QuotaSummary({ quota }: { quota: LoadState<QuotaView> }) {
  if (quota.status === 'pending') {
    return (
      <div className="border-border bg-surface flex flex-col gap-2 rounded-2xl border p-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    )
  }
  if (quota.status === 'error') {
    return (
      <div className="border-border bg-surface rounded-2xl border">
        <ErrorState
          size="compact"
          title="额度没加载出来"
          message={quota.message}
          onRetry={quota.onRetry}
          retrying={quota.retrying}
        />
      </div>
    )
  }
  const q = quota.data
  return (
    <div className="flex flex-col gap-2">
      <QuotaMeter
        weeklyLimitMicro={q.weeklyLimitMicros}
        weeklyUsedMicro={q.weeklyLimitMicros - q.weeklyRemainingMicros}
        resetText={`${formatBusinessDateTime(q.periodEndsAt)} 重置`}
      />
      <div className="bg-surface-sunken text-caption flex items-center justify-between gap-2 rounded-xl px-3 py-2">
        <span className="text-muted">加购余额 · 长期有效</span>
        <span className="font-display font-semibold tabular-nums">{formatYuan(q.bonusMicros)}</span>
      </div>
    </div>
  )
}

function RedeemForm({ pending, errors, onSubmit, successText }: QuotaCardViewProps['redeem']) {
  const id = useId()
  return (
    <Form
      aria-label="兑换额度"
      errors={errors}
      onFormSubmit={(values) => onSubmit(typeof values.code === 'string' ? values.code : '')}
    >
      <Field
        label="兑换码"
        htmlFor={`${id}-code`}
        name="code"
        hint="形如 DDON-XXXX-XXXX-XXXX，大小写和横线都可以不管"
      >
        <Input
          id={`${id}-code`}
          name="code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={40}
          placeholder="DDON-XXXX-XXXX-XXXX"
          className="font-mono tracking-wider"
          disabled={pending}
        />
      </Field>
      {successText && (
        <p
          role="status"
          className="bg-success-soft text-caption text-success-ink rounded-xl px-3 py-2"
        >
          {successText}
        </p>
      )}
      <Button type="submit" icon="check" loading={pending} className="w-full">
        兑换
      </Button>
    </Form>
  )
}

function RunList({ runs, now }: { runs: LoadState<AiRunItem[]>; now?: Date }) {
  if (runs.status === 'pending') {
    return (
      <ul className="flex flex-col gap-2" aria-label="正在加载使用记录">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center gap-3 py-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-5 w-14" />
          </li>
        ))}
      </ul>
    )
  }
  if (runs.status === 'error') {
    return (
      <ErrorState
        size="compact"
        title="记录没加载出来"
        message={runs.message}
        onRetry={runs.onRetry}
        retrying={runs.retrying}
      />
    )
  }
  if (runs.data.length === 0) {
    return (
      <EmptyState
        size="compact"
        title="还没有用过 AI"
        description="饮食打卡时选“拍照识别”，团团帮你估算热量"
      />
    )
  }
  const ref = now ?? new Date()
  return (
    <ul className="divide-border divide-y">
      {runs.data.map((r) => (
        <RunRow key={r.id} run={r} when={formatRelative(r.createdAt, ref, BUSINESS_TIME_ZONE)} />
      ))}
    </ul>
  )
}

function RunRow({ run, when }: { run: AiRunItem; when: ReactNode }) {
  const ok = run.status === 'succeeded'
  return (
    <li className="flex min-h-14 items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{PURPOSE_LABEL[run.purpose]}</p>
        <p className="text-tiny text-muted">{when}</p>
      </div>
      {!ok && (
        <Badge tone={run.status === 'running' ? 'neutral' : 'warning'} size="sm">
          {RUN_STATUS_LABEL[run.status]}
        </Badge>
      )}
      <span className="font-display text-caption shrink-0 font-semibold tabular-nums">
        {formatRunCost(run.costMicros)}
      </span>
    </li>
  )
}
