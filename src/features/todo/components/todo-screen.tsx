'use client'

import Link from 'next/link'
import { Mascot } from '@/components/mascot/mascot'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Icon } from '@/components/ui/icon'
import { Menu, type MenuItemDef } from '@/components/ui/menu'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Skeleton } from '@/components/ui/skeleton'
import { useInfiniteQuery } from '@/lib/api'
import { todoListQuery } from '@/lib/api/queries/todos'
import type { TodoLayoutMode, TodoView } from '../rules'
import type { Todo, TodoGroup, TodoOverview, TodoTag } from '../schemas'
import { useLongPressReorder } from '../use-long-press-reorder'
import { TodoFab } from './todo-fab'
import { TodoGroupPanel } from './todo-group-panel'
import { TodoQuadrantView } from './todo-quadrant-view'

/*
 * 待办页面主体（Todo v2，独立模块，不耦合打卡模块）：
 * - 完整保留左上角「清单 | 时间日志」分段控制；
 * - 同行右侧替换为「过程」按钮（跳独立单页 /todo/timeline）与「菜单」下拉（切换列表/四象限、管理分组、查看已归档、按标签筛选、全部折叠/展开）；
 * - 整体密度略微收紧，每个分组为可折叠小面板（默认仅展开「默认待办」，其他分组与已过期/已完成/已放弃均默认折叠按需加载）；
 * - 右下角置顶悬浮加号球负责新建待办。
 */

const views = [
  { value: 'list', label: '清单' },
  { value: 'log', label: '时间日志' },
] as const

export type TodoScreenStatus = 'loading' | 'error' | 'ready'

export interface TodoScreenProps {
  view: TodoView
  onViewChange: (view: TodoView) => void
  mode: TodoLayoutMode
  onModeChange: (mode: TodoLayoutMode) => void
  activeTag?: string
  onTagChange: (tag: string | undefined) => void
  onCreate: () => void
  onOpenGroupManager: () => void
  onNavigateArchived: () => void
  status: TodoScreenStatus
  errorText?: string
  onRetry?: () => void
  retrying?: boolean
  overview?: TodoOverview
  expandedGroups: ReadonlySet<string>
  onToggleGroup: (groupId: string) => void
  onExpandAllGroups: () => void
  onCollapseAllGroups: () => void
  overdueOpen: boolean
  onToggleOverdue: () => void
  doneOpen: boolean
  onToggleDone: () => void
  abandonedOpen: boolean
  onToggleAbandoned: () => void
  now: Date
  timeZone: string
  onToggleTodo: (todo: Todo) => void
  onOpenManage: (todo: Todo) => void
  onRequestDelete: (todo: Todo) => void
  onReorderTodos: (groupId: string, todoIds: string[]) => void
  onReorderGroups: (groupIds: string[]) => void
  /** 抽屉或确认弹窗打开时隐藏右下角悬浮球 */
  fabHidden?: boolean
  /** Playbook 离线演示模式（不发真实请求，使用 demoData 驱动交互） */
  demoMode?: {
    allTodos: readonly Todo[]
    onOpenTimelineDemo?: () => void
  }
}

export function TodoScreen(props: TodoScreenProps) {
  const {
    view,
    onViewChange,
    mode,
    onModeChange,
    activeTag,
    onTagChange,
    onCreate,
    onOpenGroupManager,
    onNavigateArchived,
    overview,
    fabHidden = false,
    demoMode,
  } = props

  const availableTags: readonly TodoTag[] = overview?.tags ?? []

  const menuItems: (MenuItemDef | null)[] = [
    {
      label: mode === 'list' ? '切换为四象限视图' : '切换为列表视图',
      icon: mode === 'list' ? 'quadrant' : 'todo',
      onSelect: () => onModeChange(mode === 'list' ? 'quadrant' : 'list'),
    },
    {
      label: '管理分组',
      icon: 'folder',
      onSelect: onOpenGroupManager,
    },
    {
      label:
        overview && overview.counts.archivedCount > 0
          ? `已归档（${overview.counts.archivedCount}）`
          : '已归档',
      icon: 'archive',
      onSelect: onNavigateArchived,
    },
    ...(mode === 'list'
      ? [
          null,
          {
            label: '展开全部分组',
            icon: 'chevron-down' as const,
            onSelect: props.onExpandAllGroups,
          },
          {
            label: '收起全部分组',
            icon: 'chevron-up' as const,
            onSelect: props.onCollapseAllGroups,
          },
        ]
      : []),
  ]

  return (
    <div
      className={
        mode === 'quadrant'
          ? 'mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-2.5 pb-20'
          : 'mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-2.5 pb-20'
      }
    >
      {/* 顶部工具条：左侧保留「清单 | 时间日志」，右侧替换为「过程」+「菜单」 */}
      <div className="flex w-full min-w-0 items-center gap-1.5">
        <SegmentedControl
          options={views}
          value={view}
          onValueChange={onViewChange}
          label="待办视图"
          size="sm"
          className="w-40 shrink-0 sm:w-44"
        />

        {view === 'list' && (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {demoMode?.onOpenTimelineDemo ? (
              <Button
                variant="soft"
                size="sm"
                icon="clock"
                className="h-8.5 px-2.5"
                onClick={demoMode.onOpenTimelineDemo}
              >
                过程
              </Button>
            ) : (
              <Link
                href="/todo/timeline"
                aria-label="查看待办过程时间轴"
                className="ease-spring bg-primary-soft text-primary-ink text-caption inline-flex h-8.5 items-center gap-1 rounded-full px-2.5 font-semibold transition-[transform,filter] duration-(--dur-fast) hover:brightness-95 active:scale-95"
              >
                <Icon name="clock" size={15} lineOnly />
                <span>过程</span>
              </Link>
            )}

            <Menu
              trigger={
                <button
                  type="button"
                  aria-label="待办菜单"
                  className="ease-spring border-border bg-surface text-foreground hover:bg-surface-sunken text-caption inline-flex h-8.5 items-center gap-1 rounded-full border px-2.5 font-semibold transition-[transform,background-color] duration-(--dur-fast) active:scale-95"
                >
                  <Icon name="menu" size={15} lineOnly />
                  <span>菜单</span>
                </button>
              }
              items={menuItems}
              align="end"
              side="bottom"
            />
          </div>
        )}
      </div>

      {/* 标签快速筛选条（有标签时呈现紧凑单行胶囊滚动） */}
      {view === 'list' && props.status === 'ready' && availableTags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => onTagChange(undefined)}
            className={
              activeTag === undefined
                ? 'bg-primary text-on-primary text-tiny shrink-0 rounded-full px-2.5 py-1 font-semibold'
                : 'bg-surface border-border text-muted hover:bg-surface-sunken text-tiny shrink-0 rounded-full border px-2.5 py-1 font-medium'
            }
          >
            全部标签
          </button>
          {availableTags.map((t) => {
            const selected = activeTag === t.name
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTagChange(selected ? undefined : t.name)}
                className={
                  selected
                    ? 'bg-primary-soft text-primary-ink border-primary/35 text-tiny shrink-0 rounded-full border px-2.5 py-1 font-semibold'
                    : 'bg-surface border-border text-muted hover:bg-surface-sunken text-tiny shrink-0 rounded-full border px-2.5 py-1 font-medium'
                }
              >
                #{t.name}
              </button>
            )
          })}
        </div>
      )}

      {view === 'log' ? <LogPlaceholder /> : <TodoMainContent {...props} />}

      {/* 右下角置顶悬浮加号球（新建待办） */}
      {view === 'list' && (
        <TodoFab onClick={onCreate} hidden={fabHidden} contained={Boolean(demoMode)} />
      )}
    </div>
  )
}

function LogPlaceholder() {
  return (
    <Card variant="sunken" className="flex flex-col items-center gap-2 py-8 text-center">
      <Mascot mood="thinking" size={72} />
      <p className="font-semibold">时间日志在后续版本上线</p>
      <p className="text-caption text-muted">可以先用「清单」和右上角「过程」记录与回顾待办</p>
    </Card>
  )
}

function TodoMainContent(props: TodoScreenProps) {
  const { status, errorText, onRetry, retrying, overview, mode } = props

  if (status === 'loading') return <TodoListSkeleton />
  if (status === 'error' || !overview) {
    return (
      <ErrorState
        title="待办没加载出来"
        message={errorText}
        onRetry={onRetry}
        retrying={retrying}
      />
    )
  }

  if (mode === 'quadrant') {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-tiny text-muted font-semibold">
            四象限视图 · 仅进行中（{overview.counts.openTotal} 项 · 按创建时间由近到远）
          </span>
          {props.activeTag && <Badge tone="primary">#{props.activeTag}</Badge>}
        </div>
        <TodoQuadrantView
          counts={overview.counts.quadrants}
          activeTag={props.activeTag}
          now={props.now}
          timeZone={props.timeZone}
          onToggleTodo={props.onToggleTodo}
          onOpenManage={props.onOpenManage}
          onRequestDelete={props.onRequestDelete}
          demoItems={props.demoMode?.allTodos}
        />
      </div>
    )
  }

  return <TodoCollapsibleListView {...props} overview={overview} />
}

function TodoCollapsibleListView(props: TodoScreenProps & { overview: TodoOverview }) {
  const {
    overview,
    activeTag,
    expandedGroups,
    onToggleGroup,
    overdueOpen,
    onToggleOverdue,
    doneOpen,
    onToggleDone,
    abandonedOpen,
    onToggleAbandoned,
    now,
    timeZone,
    onToggleTodo,
    onOpenManage,
    onRequestDelete,
    onReorderTodos,
    onReorderGroups,
    onCreate,
    demoMode,
  } = props

  const groupIds = overview.groups.map((g) => g.id)
  const groupById = new Map(overview.groups.map((g) => [g.id, g]))

  const groupDrag = useLongPressReorder({
    ids: groupIds,
    enabled: overview.groups.length > 1,
    onReorder: onReorderGroups,
  })

  const orderedGroups = groupDrag.orderedIds
    .map((id) => groupById.get(id))
    .filter((g): g is TodoGroup => g !== undefined)

  const hasAnyTodo =
    overview.counts.openTotal > 0 ||
    overview.counts.doneRecentCount > 0 ||
    overview.counts.abandonedRecentCount > 0

  return (
    <div className="flex flex-col gap-2">
      {!hasAnyTodo && !activeTag && (
        <EmptyState
          size="compact"
          title="还没有待办呢"
          description="点右下角加号球，记下要做的事吧"
          action={
            <Button variant="soft" size="sm" icon="plus" onClick={onCreate}>
              新建待办
            </Button>
          }
        />
      )}

      {/* 自定义分组可折叠小面板（支持长按分组头拖拽排序 + 组内待办长按拖拽排序） */}
      {orderedGroups.map((group) => {
        const isOpen = expandedGroups.has(group.id)
        return (
          <CustomGroupPanelContainer
            key={group.id}
            group={group}
            isDefaultGroup={group.id === overview.defaultGroupId}
            initialDefaultTodos={
              group.id === overview.defaultGroupId ? overview.defaultGroupTodos : undefined
            }
            activeTag={activeTag}
            open={isOpen}
            onToggleOpen={() => onToggleGroup(group.id)}
            now={now}
            timeZone={timeZone}
            onToggleTodo={onToggleTodo}
            onOpenManage={onOpenManage}
            onRequestDelete={onRequestDelete}
            onReorderTodos={(todoIds) => onReorderTodos(group.id, todoIds)}
            panelRef={groupDrag.registerItem(group.id)}
            groupDragBind={groupDrag.bindItem(group.id)}
            isGroupDragging={groupDrag.draggingId === group.id}
            groupDragOffsetY={groupDrag.draggingId === group.id ? groupDrag.dragOffsetY : 0}
            shouldSuppressGroupClick={groupDrag.shouldSuppressClick}
            demoAllTodos={demoMode?.allTodos}
          />
        )
      })}

      {/* 已过期分组面板（超 DDL 未完成自动归入） */}
      {overview.counts.overdueCount > 0 && (
        <SystemBucketPanel
          status="overdue"
          title="已过期"
          icon="alert"
          tone="danger"
          count={overview.counts.overdueCount}
          alertText="已超时"
          alertTone="danger"
          open={overdueOpen}
          onToggleOpen={onToggleOverdue}
          activeTag={activeTag}
          emptyText="没有过期的待办"
          now={now}
          timeZone={timeZone}
          onToggleTodo={onToggleTodo}
          onOpenManage={onOpenManage}
          onRequestDelete={onRequestDelete}
          demoAllTodos={demoMode?.allTodos}
        />
      )}

      {/* 已完成分组面板（近 30 天，默认自动折叠，展开才请求） */}
      <SystemBucketPanel
        status="done"
        title="已完成"
        subtitle="近 30 天"
        icon="check"
        tone="success"
        count={overview.counts.doneRecentCount}
        open={doneOpen}
        onToggleOpen={onToggleDone}
        activeTag={activeTag}
        emptyText="最近 30 天还没有已完成的待办"
        now={now}
        timeZone={timeZone}
        onToggleTodo={onToggleTodo}
        onOpenManage={onOpenManage}
        onRequestDelete={onRequestDelete}
        demoAllTodos={demoMode?.allTodos}
      />

      {/* 已放弃分组面板（近 30 天，默认自动折叠，展开才请求） */}
      <SystemBucketPanel
        status="abandoned"
        title="已放弃"
        subtitle="近 30 天"
        icon="ban"
        tone="neutral"
        count={overview.counts.abandonedRecentCount}
        open={abandonedOpen}
        onToggleOpen={onToggleAbandoned}
        activeTag={activeTag}
        emptyText="最近 30 天没有已放弃的待办"
        now={now}
        timeZone={timeZone}
        onToggleTodo={onToggleTodo}
        onOpenManage={onOpenManage}
        onRequestDelete={onRequestDelete}
        demoAllTodos={demoMode?.allTodos}
      />
    </div>
  )
}

function CustomGroupPanelContainer({
  group,
  isDefaultGroup,
  initialDefaultTodos,
  activeTag,
  open,
  onToggleOpen,
  now,
  timeZone,
  onToggleTodo,
  onOpenManage,
  onRequestDelete,
  onReorderTodos,
  panelRef,
  groupDragBind,
  isGroupDragging,
  groupDragOffsetY,
  shouldSuppressGroupClick,
  demoAllTodos,
}: {
  group: TodoGroup
  isDefaultGroup: boolean
  initialDefaultTodos?: TodoOverview['defaultGroupTodos']
  activeTag?: string
  open: boolean
  onToggleOpen: () => void
  now: Date
  timeZone: string
  onToggleTodo: (todo: Todo) => void
  onOpenManage: (todo: Todo) => void
  onRequestDelete: (todo: Todo) => void
  onReorderTodos: (todoIds: string[]) => void
  panelRef: (node: HTMLElement | null) => void
  groupDragBind: ReturnType<typeof useLongPressReorder>['bindItem'] extends (id: string) => infer R
    ? R
    : never
  isGroupDragging: boolean
  groupDragOffsetY: number
  shouldSuppressGroupClick: () => boolean
  demoAllTodos?: readonly Todo[]
}) {
  // 默认待办首批直接复用 overview 数据，只有用户点击「加载更多」或展开其他分组时才发分页请求
  const shouldFetch =
    !demoAllTodos && open && (!isDefaultGroup || initialDefaultTodos === undefined)
  const extraQuery = useInfiniteQuery({
    ...todoListQuery('open', { groupId: group.id, ...(activeTag ? { tag: activeTag } : {}) }),
    enabled: shouldFetch,
    ...(isDefaultGroup && initialDefaultTodos
      ? {
          initialData: {
            pages: [initialDefaultTodos],
            pageParams: [null],
          },
        }
      : {}),
  })

  let items: readonly Todo[]
  let loading = false
  let hasMore = false
  let loadingMore = false
  let onLoadMore: (() => void) | undefined

  if (demoAllTodos) {
    items = demoAllTodos.filter(
      (t) =>
        t.status === 'open' &&
        t.groupId === group.id &&
        (t.dueAt === null || new Date(t.dueAt).getTime() > now.getTime()),
    )
  } else if (isDefaultGroup && !extraQuery.data && initialDefaultTodos) {
    items = initialDefaultTodos.items
    hasMore = initialDefaultTodos.nextCursor !== null
    onLoadMore = () => void extraQuery.fetchNextPage()
  } else {
    items = extraQuery.data?.pages.flatMap((p) => p.items) ?? []
    loading = shouldFetch && extraQuery.isPending
    hasMore = extraQuery.hasNextPage
    loadingMore = extraQuery.isFetchingNextPage
    onLoadMore = () => void extraQuery.fetchNextPage()
  }

  return (
    <TodoGroupPanel
      title={group.name}
      icon={group.isDefault ? 'todo' : 'folder'}
      tone={group.isDefault ? 'primary' : 'study'}
      count={group.openCount}
      alertText={group.soonCount > 0 ? `${group.soonCount} 快到期` : undefined}
      alertTone="warning"
      open={open}
      onToggleOpen={onToggleOpen}
      loading={loading}
      items={items}
      emptyText={group.isDefault ? '当前没有进行中的待办' : '这个分组暂时没有待办'}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={onLoadMore}
      now={now}
      timeZone={timeZone}
      onToggleTodo={onToggleTodo}
      onOpenManage={onOpenManage}
      onRequestDelete={onRequestDelete}
      onReorderTodos={onReorderTodos}
      panelRef={panelRef}
      groupDragBind={groupDragBind}
      isGroupDragging={isGroupDragging}
      groupDragOffsetY={groupDragOffsetY}
      shouldSuppressGroupClick={shouldSuppressGroupClick}
    />
  )
}

function SystemBucketPanel({
  status,
  title,
  subtitle,
  icon,
  tone,
  count,
  alertText,
  alertTone,
  open,
  onToggleOpen,
  activeTag,
  emptyText,
  now,
  timeZone,
  onToggleTodo,
  onOpenManage,
  onRequestDelete,
  demoAllTodos,
}: {
  status: 'overdue' | 'done' | 'abandoned'
  title: string
  subtitle?: string
  icon: 'alert' | 'check' | 'ban'
  tone: 'danger' | 'success' | 'neutral'
  count: number
  alertText?: string
  alertTone?: 'danger' | 'warning'
  open: boolean
  onToggleOpen: () => void
  activeTag?: string
  emptyText: string
  now: Date
  timeZone: string
  onToggleTodo: (todo: Todo) => void
  onOpenManage: (todo: Todo) => void
  onRequestDelete: (todo: Todo) => void
  demoAllTodos?: readonly Todo[]
}) {
  const query = useInfiniteQuery({
    ...todoListQuery(status, activeTag ? { tag: activeTag } : {}),
    enabled: !demoAllTodos && open && count > 0,
  })

  const items: readonly Todo[] = demoAllTodos
    ? demoAllTodos.filter((t) => {
        if (status === 'overdue') {
          return (
            t.status === 'open' && t.dueAt !== null && new Date(t.dueAt).getTime() <= now.getTime()
          )
        }
        return t.status === status
      })
    : (query.data?.pages.flatMap((p) => p.items) ?? [])

  return (
    <TodoGroupPanel
      title={title}
      subtitle={subtitle}
      icon={icon}
      tone={tone}
      count={count}
      alertText={alertText}
      alertTone={alertTone}
      open={open}
      onToggleOpen={onToggleOpen}
      loading={!demoAllTodos && open && count > 0 && query.isPending}
      items={items}
      emptyText={emptyText}
      hasMore={!demoAllTodos && query.hasNextPage}
      loadingMore={!demoAllTodos && query.isFetchingNextPage}
      onLoadMore={!demoAllTodos ? () => void query.fetchNextPage() : undefined}
      showGroupBadge
      now={now}
      timeZone={timeZone}
      onToggleTodo={onToggleTodo}
      onOpenManage={onOpenManage}
      onRequestDelete={onRequestDelete}
    />
  )
}

/** 整页骨架（Suspense fallback） */
export function TodoScreenSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-8.5 w-44 rounded-full" />
        <div className="flex gap-1.5">
          <Skeleton className="h-8.5 w-16 rounded-full" />
          <Skeleton className="h-8.5 w-16 rounded-full" />
        </div>
      </div>
      <TodoListSkeleton />
    </div>
  )
}

function TodoListSkeleton() {
  return (
    <div role="status" aria-label="加载中" className="grid gap-2">
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  )
}
