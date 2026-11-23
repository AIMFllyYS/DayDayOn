'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { solidToneClass } from '@/components/ui/tone'
import type { Me } from '@/features/me/schemas'
import { apiFetch, errorMessage, isApiError, keys, useInfiniteQuery, useQuery } from '@/lib/api'
import { todoEventsQuery } from '@/lib/api/queries/todos'
import { cn } from '@/lib/cn'
import { BUSINESS_TIME_ZONE, formatLocalDateLabel, formatTime } from '@/lib/time'
import { groupEventsByLocalDate, TODO_EVENT_META } from '../rules'
import type { TodoEvent, TodoEventType } from '../schemas'

/*
 * 待办过程单页（/todo/timeline）：
 * - 复用全站二级页面外壳与打卡历史/过程页面的按日分组 + 虚线时间轴视觉语言；
 * - 卡片尺寸较打卡时间轨迹页面更小巧紧凑，重点清晰展示「待办名称」、时刻、动作徽章与来源分组；
 * - 直接读取全周期 todo_events，天然包含已满 30 天自动归档的历史待办。
 */

const FILTER_OPTIONS: { value: TodoEventType | 'all'; label: string }[] = [
  { value: 'all', label: '全部过程' },
  { value: 'completed', label: '已完成' },
  { value: 'abandoned', label: '已放弃' },
  { value: 'created', label: '新建' },
  { value: 'moved', label: '移动分组' },
]

function useTimeZone(): string {
  const me = useQuery({ queryKey: keys.me.detail(), queryFn: () => apiFetch<Me>('/me') })
  return me.data?.profile.timeZone ?? BUSINESS_TIME_ZONE
}

function eventDetailText(ev: TodoEvent): string | null {
  if (ev.eventType === 'moved' && ev.meta.fromGroup && ev.meta.toGroup) {
    return `${ev.meta.fromGroup} → ${ev.meta.toGroup}`
  }
  if (ev.eventType === 'abandoned' && ev.meta.reason) {
    return `原因：${ev.meta.reason}`
  }
  return null
}

export function TodoTimelinePage() {
  const timeZone = useTimeZone()
  const [filter, setFilter] = useState<TodoEventType | 'all'>('all')
  const query = useInfiniteQuery(todoEventsQuery(filter === 'all' ? {} : { eventType: filter }))

  const events = query.data?.pages.flatMap((p) => p.items) ?? []
  const grouped = groupEventsByLocalDate(events, timeZone)

  return (
    <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-3 pb-10">
      {/* 顶部紧凑说明 + 类型筛选胶囊 */}
      <div className="flex flex-col gap-2">
        <p className="text-tiny text-muted px-0.5">
          按时间轴回看每条待办的完整流转（含已满 30 天自动归档的历史记录）
        </p>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilter(opt.value)}
                className={cn(
                  'ease-spring text-tiny shrink-0 rounded-full border px-2.5 py-1 font-semibold transition-colors duration-(--dur-fast) active:scale-95',
                  active
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-border bg-surface text-muted hover:bg-surface-sunken',
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {query.isPending ? (
        <div role="status" aria-label="加载中" className="grid gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState
          size="compact"
          title="过程记录没加载出来"
          message={isApiError(query.error) ? errorMessage(query.error) : undefined}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      ) : grouped.length === 0 ? (
        <Card variant="sunken">
          <EmptyState
            size="compact"
            title="还没有过程记录"
            description="新建、完成或放弃待办后，这里会按时间轴记录每一步"
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3.5">
          {grouped.map(([date, list]) => (
            <section
              key={date}
              aria-label={formatLocalDateLabel(date)}
              className="flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between px-1">
                <h2 className="text-tiny text-muted font-bold">{formatLocalDateLabel(date)}</h2>
                <span className="text-tiny text-subtle tabular-nums">{list.length} 条动态</span>
              </div>

              <ol className="border-border bg-surface shadow-soft rounded-xl border px-3 py-2">
                {list.map((ev, idx) => {
                  const meta = TODO_EVENT_META[ev.eventType]
                  const last = idx === list.length - 1
                  const detail = eventDetailText(ev)
                  return (
                    <li key={ev.id} className={cn('relative pl-5', !last && 'pb-2.5')}>
                      {/* 纵向虚线时间轨道（复用打卡过程视觉语言，尺寸更紧凑） */}
                      {!last && (
                        <span
                          aria-hidden
                          className="border-border absolute top-3.5 bottom-0 left-[5px] border-l-2 border-dashed"
                        />
                      )}
                      <span
                        aria-hidden
                        className={cn(
                          'ring-surface absolute top-1.5 left-0 size-3 rounded-full ring-2',
                          solidToneClass[meta.tone],
                        )}
                      />

                      <div className="flex min-w-0 items-start gap-2">
                        <time
                          dateTime={ev.occurredAt}
                          className="font-display text-tiny text-subtle w-10 shrink-0 pt-0.5 tabular-nums"
                        >
                          {formatTime(ev.occurredAt, timeZone)}
                        </time>

                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <Badge tone={meta.tone} size="sm">
                              {meta.label}
                            </Badge>
                            <span className="text-caption text-foreground min-w-0 truncate font-semibold">
                              {ev.todoTitle}
                            </span>
                            {ev.isArchived && (
                              <Badge tone="neutral" size="sm">
                                已归档
                              </Badge>
                            )}
                          </div>
                          <div className="text-tiny text-muted mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span>分组：{ev.groupName}</span>
                            {detail && <span className="truncate">{detail}</span>}
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}

          {query.hasNextPage && (
            <Button
              variant="ghost"
              size="sm"
              className="self-center"
              loading={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              加载更早记录
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
