'use client'

import dynamic from 'next/dynamic'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { errorMessage, isApiError } from '@/lib/api'
import { formatLocalDateLabel } from '@/lib/time'

const ConfirmDialog = dynamic(
  () => import('@/components/ui/confirm-dialog').then((m) => m.ConfirmDialog),
  { loading: () => null },
)

/*
 * 可复用的按日分组历史记录卡片：
 * 抽离自 GoalCheckinHistory，统一承载目标打卡历史与每日指标（体重 / 心情 / 步数）的详细记录列表：
 * - 统一的 Card + CardHeader、骨架屏、ErrorState、EmptyState；
 * - 按 localDate 倒序分组，渲染 bg-surface-sunken/60 圆角分割列表；
 * - 统一游标分页「再看看更早的」按钮与懒加载危险态 ConfirmDialog 删除确认。
 */

export interface RecordHistoryDeleteConfig<T> {
  title: string | ((item: T) => string)
  description: string | ((item: T) => string)
  confirmLabel?: string
  successToast?: string
  onDelete: (item: T) => Promise<unknown>
}

export interface RecordHistoryCardProps<T extends { localDate: string }> {
  title: string
  description?: string
  headerAction?: ReactNode
  items: readonly T[]
  getKey: (item: T) => string
  renderItem: (item: T, helpers: { requestDelete: (item: T) => void }) => ReactNode
  isPending: boolean
  isError: boolean
  error?: unknown
  isRefetching?: boolean
  onRetry: () => void
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onFetchNextPage?: () => void
  emptyTitle: string
  emptyDescription: string
  errorTitle?: string
  deleteConfig?: RecordHistoryDeleteConfig<T>
}

/** 按打卡日分组（调用方已按日期倒序排列） */
function groupByDate<T extends { localDate: string }>(items: readonly T[]): [string, T[]][] {
  const out: [string, T[]][] = []
  for (const item of items) {
    const last = out.at(-1)
    if (last && last[0] === item.localDate) last[1].push(item)
    else out.push([item.localDate, [item]])
  }
  return out
}

export function RecordHistoryCard<T extends { localDate: string }>({
  title,
  description,
  headerAction,
  items,
  getKey,
  renderItem,
  isPending,
  isError,
  error,
  isRefetching = false,
  onRetry,
  hasNextPage = false,
  isFetchingNextPage = false,
  onFetchNextPage,
  emptyTitle,
  emptyDescription,
  errorTitle = '记录没加载出来',
  deleteConfig,
}: RecordHistoryCardProps<T>) {
  const [pending, setPending] = useState<T | null>(null)
  const [confirmLoaded, setConfirmLoaded] = useState(false)

  function requestDelete(item: T) {
    if (!confirmLoaded) setConfirmLoaded(true)
    setPending(item)
  }

  let body: ReactNode
  if (isPending) {
    body = (
      <div role="status" aria-label="加载中" className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    )
  } else if (isError) {
    body = (
      <ErrorState
        size="compact"
        title={errorTitle}
        message={isApiError(error) ? errorMessage(error) : undefined}
        onRetry={onRetry}
        retrying={isRefetching}
      />
    )
  } else if (items.length === 0) {
    body = <EmptyState size="compact" title={emptyTitle} description={emptyDescription} />
  } else {
    body = (
      <div className="flex flex-col gap-4">
        {groupByDate(items).map(([date, list]) => (
          <section key={date} aria-label={formatLocalDateLabel(date)}>
            <h4 className="text-tiny text-muted mb-1.5 font-semibold">
              {formatLocalDateLabel(date)}
            </h4>
            <ul className="divide-border bg-surface-sunken/60 divide-y overflow-hidden rounded-2xl">
              {list.map((item) => (
                <li key={getKey(item)}>{renderItem(item, { requestDelete })}</li>
              ))}
            </ul>
          </section>
        ))}
        {hasNextPage && onFetchNextPage && (
          <Button
            variant="ghost"
            className="self-center"
            loading={isFetchingNextPage}
            onClick={onFetchNextPage}
          >
            再看看更早的
          </Button>
        )}
      </div>
    )
  }

  const dialogTitle =
    pending && deleteConfig
      ? typeof deleteConfig.title === 'function'
        ? deleteConfig.title(pending)
        : deleteConfig.title
      : ''
  const dialogDesc =
    pending && deleteConfig
      ? typeof deleteConfig.description === 'function'
        ? deleteConfig.description(pending)
        : deleteConfig.description
      : ''

  return (
    <Card>
      <CardHeader title={title} description={description}>
        {headerAction}
      </CardHeader>
      {body}
      {deleteConfig && confirmLoaded && (
        <ConfirmDialog
          open={pending !== null}
          onOpenChange={(open) => {
            if (!open) setPending(null)
          }}
          title={dialogTitle}
          description={dialogDesc}
          tone="danger"
          confirmLabel={deleteConfig.confirmLabel ?? '删除'}
          onConfirm={() => {
            if (!pending) return
            return deleteConfig.onDelete(pending).then(
              () => toast.success(deleteConfig.successToast ?? '删掉了'),
              (e: unknown) => {
                toast.error(isApiError(e) ? errorMessage(e) : '出了点小状况，稍后再试试')
                throw e
              },
            )
          }}
        />
      )}
    </Card>
  )
}
