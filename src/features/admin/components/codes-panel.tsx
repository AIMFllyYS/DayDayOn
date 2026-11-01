'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import type { AdminCodeRow } from '@/features/admin/schemas'
import type { RedeemCodeStatus } from '@/features/quota/schemas'
import { useQuery } from '@/lib/api'
import { adminCodesQuery, useVoidCode } from '@/lib/api/queries/admin'
import { BUSINESS_TIME_ZONE, formatDateTime } from '@/lib/time'
import { formatYuan } from '../money'
import { GenerateCodesSheet } from './generate-codes'
import { Pager } from './pager'
import { AdminHeader, ConfirmDialog, messageOf } from './shared'

/*
 * 兑换码（PRD 2.7、2.12）：批量生成（明文只显示一次）、列表（前缀、状态、使用者、使用时间）、作废未使用的码。
 */

const PAGE_SIZE = 20
type Filter = 'all' | RedeemCodeStatus

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'unused', label: '未使用' },
  { value: 'redeemed', label: '已兑换' },
  { value: 'void', label: '已作废' },
]

const STATUS_BADGE: Record<
  RedeemCodeStatus,
  { label: string; tone: 'success' | 'neutral' | 'primary' }
> = {
  unused: { label: '未使用', tone: 'success' },
  redeemed: { label: '已兑换', tone: 'primary' },
  void: { label: '已作废', tone: 'neutral' },
}

export function CodesPanel() {
  const [filter, setFilter] = useState<Filter>('all')
  const [offset, setOffset] = useState(0)
  const [generating, setGenerating] = useState(false)
  const query = useQuery(
    adminCodesQuery({
      status: filter === 'all' ? undefined : filter,
      offset,
      limit: PAGE_SIZE,
    }),
  )

  return (
    <div className="flex flex-col gap-4">
      <AdminHeader
        title="兑换码"
        description="每个面值 10 元，一次性，兑换后加到长期有效的加购余额"
        actions={
          <Button icon="plus" onClick={() => setGenerating(true)}>
            批量生成
          </Button>
        }
      />
      <SegmentedControl
        label="按状态筛选"
        options={FILTERS}
        value={filter}
        onValueChange={(v) => {
          setFilter(v)
          setOffset(0)
        }}
        className="max-w-md"
      />
      <Card className="p-0 md:p-0">
        {query.isPending ? (
          <div role="status" aria-label="加载中" className="flex flex-col gap-3 p-5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState
            message={messageOf(query.error)}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        ) : query.data.items.length === 0 ? (
          <EmptyState
            title={filter === 'all' ? '还没有兑换码' : '这一类没有兑换码'}
            description={filter === 'all' ? '点右上角「批量生成」做一批' : undefined}
          />
        ) : (
          <div className="px-4 pb-4 md:px-5">
            <CodesTable rows={query.data.items} />
            <Pager
              offset={offset}
              limit={PAGE_SIZE}
              total={query.data.total}
              onOffsetChange={setOffset}
            />
          </div>
        )}
      </Card>
      <GenerateCodesSheet open={generating} onOpenChange={setGenerating} />
    </div>
  )
}

const th = 'text-tiny text-muted px-3 py-3 text-left font-semibold whitespace-nowrap'
const td = 'text-caption px-3 py-3 align-middle whitespace-nowrap'

export function CodesTable({
  rows,
  demo = false,
}: {
  rows: readonly AdminCodeRow[]
  demo?: boolean
}) {
  const voidCode = useVoidCode()
  const [target, setTarget] = useState<AdminCodeRow | null>(null)
  return (
    <>
      {/* relative：表里 sr-only 的绝对定位文字以此为包含块，否则会按 body 定位把整页撑宽 */}
      <div className="relative -mx-4 overflow-x-auto md:-mx-5">
        <table className="w-full min-w-180 border-collapse">
          <caption className="sr-only">兑换码列表</caption>
          <thead className="border-border border-b">
            <tr>
              <th scope="col" className={th}>
                前缀
              </th>
              <th scope="col" className={`${th} text-right`}>
                面值
              </th>
              <th scope="col" className={th}>
                状态
              </th>
              <th scope="col" className={th}>
                生成时间
              </th>
              <th scope="col" className={th}>
                使用者
              </th>
              <th scope="col" className={th}>
                使用时间
              </th>
              <th scope="col" className={th}>
                <span className="sr-only">操作</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.map((c) => {
              const badge = STATUS_BADGE[c.status]
              return (
                <tr key={c.id}>
                  <td className={`${td} font-mono font-semibold`}>{c.prefix}-••••-••••</td>
                  <td className={`${td} text-right tabular-nums`}>{formatYuan(c.valueMicros)}</td>
                  <td className={td}>
                    <Badge tone={badge.tone} dot>
                      {badge.label}
                    </Badge>
                  </td>
                  <td className={`${td} tabular-nums`}>
                    {formatDateTime(c.createdAt, BUSINESS_TIME_ZONE)}
                  </td>
                  <td className={`${td} max-w-56 truncate`}>
                    {c.redeemedBy ? (c.redeemedBy.nickname ?? c.redeemedBy.email) : '—'}
                  </td>
                  <td className={`${td} tabular-nums`}>
                    {c.redeemedAt ? formatDateTime(c.redeemedAt, BUSINESS_TIME_ZONE) : '—'}
                  </td>
                  <td className={`${td} text-right`}>
                    {c.status === 'unused' && (
                      <Button variant="ghost" onClick={() => setTarget(c)}>
                        作废
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`作废 ${target?.prefix ?? ''}？`}
        description="作废后这个码不能再兑换，也不能恢复。"
        tone="danger"
        confirmLabel="作废"
        onConfirm={async () => {
          if (!target) return
          if (demo) return void toast.info('演示：已作废')
          try {
            await voidCode.mutateAsync(target.id)
            toast.success('已作废')
          } catch (error) {
            toast.error(messageOf(error))
            throw error
          }
        }}
      />
    </>
  )
}
