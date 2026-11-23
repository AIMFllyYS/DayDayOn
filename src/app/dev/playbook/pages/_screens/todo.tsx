'use client'

import { useMemo, useState } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { TodoScreen as TodoScreenView } from '@/features/todo/components/todo-screen'
import { dueStatus, type TodoLayoutMode, type TodoView } from '@/features/todo/rules'
import {
  TODO_DEFAULT_GROUP_NAME,
  type Todo,
  type TodoGroup,
  type TodoOverview,
  type TodoTag,
} from '@/features/todo/schemas'

/*
 * 待办（Todo v2）Playbook 页面预览：渲染正式组件 TodoScreen，数据为本地演示数据。
 * 演示固定在 2026-11-01 10:00（北京时间），完整支持折叠面板、列表/四象限切换、长按排序与删除二次确认。
 */

const NOW = new Date('2026-11-01T02:00:00.000Z')
const TZ = 'Asia/Shanghai'

const DEFAULT_GROUP_ID = '0193f6b2-0000-7000-8000-000000000101'
const STUDY_GROUP_ID = '0193f6b2-0000-7000-8000-000000000102'

const initialGroups: { id: string; name: string; isDefault: boolean }[] = [
  { id: DEFAULT_GROUP_ID, name: TODO_DEFAULT_GROUP_NAME, isDefault: true },
  { id: STUDY_GROUP_ID, name: '学习', isDefault: false },
]

const demoTags: TodoTag[] = [
  {
    id: '0193f6b2-0000-7000-8000-000000000201',
    name: '高数',
    createdAt: '2026-10-30T02:00:00.000Z',
  },
  {
    id: '0193f6b2-0000-7000-8000-000000000202',
    name: '作业',
    createdAt: '2026-10-30T02:00:00.000Z',
  },
  {
    id: '0193f6b2-0000-7000-8000-000000000203',
    name: '采购',
    createdAt: '2026-10-30T02:00:00.000Z',
  },
]

const demo = (id: number, title: string, over: Partial<Todo> = {}): Todo => ({
  id: `0193f6b2-0000-7000-8000-00000000000${id}`,
  groupId: DEFAULT_GROUP_ID,
  groupName: TODO_DEFAULT_GROUP_NAME,
  title,
  note: null,
  dueAt: null,
  priority: 'not-important-not-urgent',
  tags: [],
  status: 'open',
  doneAt: null,
  abandonedAt: null,
  abandonReason: null,
  settledAt: null,
  isArchived: false,
  sortOrder: id,
  createdAt: `2026-10-30T0${id}:00:00.000Z`,
  updatedAt: '2026-10-30T02:00:00.000Z',
  ...over,
})

const initialTodos: Todo[] = [
  demo(1, '交数据结构实验报告，含复杂度分析与测试截图', {
    groupId: DEFAULT_GROUP_ID,
    groupName: TODO_DEFAULT_GROUP_NAME,
    dueAt: '2026-11-01T15:59:00.000Z',
    priority: 'urgent-important',
    tags: ['高数', '作业'],
    note: '需要附上性能对比图和完整源码',
  }),
  demo(2, '买牛奶和燕麦', {
    groupId: DEFAULT_GROUP_ID,
    groupName: TODO_DEFAULT_GROUP_NAME,
    dueAt: '2026-11-02T10:00:00.000Z',
    priority: 'not-important-not-urgent',
    tags: ['采购'],
  }),
  demo(3, '整理本周高数错题本', {
    groupId: STUDY_GROUP_ID,
    groupName: '学习',
    dueAt: '2026-11-08T12:00:00.000Z',
    priority: 'important-not-urgent',
    tags: ['高数'],
  }),
  demo(4, '还图书馆的书（已过期演示）', {
    groupId: DEFAULT_GROUP_ID,
    groupName: TODO_DEFAULT_GROUP_NAME,
    dueAt: '2026-10-31T10:00:00.000Z',
    priority: 'urgent-not-important',
  }),
  demo(5, '晨跑 3km', {
    status: 'done',
    doneAt: '2026-10-31T23:10:00.000Z',
    settledAt: '2026-10-31T23:10:00.000Z',
  }),
  demo(6, '抢周末演唱会门票', {
    status: 'abandoned',
    abandonedAt: '2026-10-31T12:00:00.000Z',
    abandonReason: '时间冲突',
    settledAt: '2026-10-31T12:00:00.000Z',
  }),
]

export function TodoScreen() {
  const [items, setItems] = useState(initialTodos)
  const [groupOrder, setGroupOrder] = useState(initialGroups)
  const [view, setView] = useState<TodoView>('list')
  const [mode, setMode] = useState<TodoLayoutMode>('list')
  const [activeTag, setActiveTag] = useState<string | undefined>(undefined)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([DEFAULT_GROUP_ID]))
  const [overdueOpen, setOverdueOpen] = useState(false)
  const [doneOpen, setDoneOpen] = useState(false)
  const [abandonedOpen, setAbandonedOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Todo | null>(null)

  const filtered = useMemo(
    () => (activeTag ? items.filter((t) => t.tags.includes(activeTag)) : items),
    [items, activeTag],
  )

  const overview = useMemo<TodoOverview>(() => {
    const groups: TodoGroup[] = groupOrder.map((g, idx) => {
      const inGroup = filtered.filter(
        (t) => t.status === 'open' && t.groupId === g.id && dueStatus(t.dueAt, NOW) !== 'overdue',
      )
      return {
        id: g.id,
        name: g.name,
        isDefault: g.isDefault,
        sortOrder: idx,
        openCount: inGroup.length,
        soonCount: inGroup.filter((t) => dueStatus(t.dueAt, NOW) === 'soon').length,
        createdAt: '2026-10-30T02:00:00.000Z',
        updatedAt: '2026-10-30T02:00:00.000Z',
      }
    })

    const openAll = filtered.filter((t) => t.status === 'open')
    const defaultOpen = openAll.filter(
      (t) => t.groupId === DEFAULT_GROUP_ID && dueStatus(t.dueAt, NOW) !== 'overdue',
    )

    return {
      defaultGroupId: DEFAULT_GROUP_ID,
      groups,
      tags: demoTags,
      counts: {
        openTotal: openAll.length,
        overdueCount: openAll.filter((t) => dueStatus(t.dueAt, NOW) === 'overdue').length,
        doneRecentCount: filtered.filter((t) => t.status === 'done').length,
        abandonedRecentCount: filtered.filter((t) => t.status === 'abandoned').length,
        archivedCount: 3,
        quadrants: {
          'urgent-important': openAll.filter((t) => t.priority === 'urgent-important').length,
          'important-not-urgent': openAll.filter((t) => t.priority === 'important-not-urgent')
            .length,
          'urgent-not-important': openAll.filter((t) => t.priority === 'urgent-not-important')
            .length,
          'not-important-not-urgent': openAll.filter(
            (t) => t.priority === 'not-important-not-urgent',
          ).length,
        },
      },
      defaultGroupTodos: { items: defaultOpen, nextCursor: null },
    }
  }, [filtered, groupOrder])

  return (
    <>
      <TodoScreenView
        view={view}
        onViewChange={setView}
        mode={mode}
        onModeChange={setMode}
        activeTag={activeTag}
        onTagChange={setActiveTag}
        onCreate={() => {}}
        onOpenGroupManager={() => {}}
        onNavigateArchived={() => {}}
        status="ready"
        overview={overview}
        expandedGroups={expanded}
        onToggleGroup={(gid) =>
          setExpanded((prev) => {
            const next = new Set(prev)
            if (next.has(gid)) next.delete(gid)
            else next.add(gid)
            return next
          })
        }
        onExpandAllGroups={() => setExpanded(new Set(groupOrder.map((g) => g.id)))}
        onCollapseAllGroups={() => {
          setExpanded(new Set())
          setOverdueOpen(false)
          setDoneOpen(false)
          setAbandonedOpen(false)
        }}
        overdueOpen={overdueOpen}
        onToggleOverdue={() => setOverdueOpen((v) => !v)}
        doneOpen={doneOpen}
        onToggleDone={() => setDoneOpen((v) => !v)}
        abandonedOpen={abandonedOpen}
        onToggleAbandoned={() => setAbandonedOpen((v) => !v)}
        now={NOW}
        timeZone={TZ}
        onToggleTodo={(t) =>
          setItems((list) =>
            list.map((x) => {
              if (x.id !== t.id) return x
              const nextStatus = x.status === 'open' ? 'done' : 'open'
              const at = nextStatus === 'done' ? NOW.toISOString() : null
              return { ...x, status: nextStatus, doneAt: at, settledAt: at }
            }),
          )
        }
        onOpenManage={() => {}}
        onRequestDelete={setPendingDelete}
        onReorderTodos={(groupId, todoIds) => {
          const idxMap = new Map(todoIds.map((id, i) => [id, i]))
          setItems((list) =>
            list
              .map((t) =>
                t.groupId === groupId && idxMap.has(t.id)
                  ? { ...t, sortOrder: idxMap.get(t.id) ?? t.sortOrder }
                  : t,
              )
              .sort((a, b) => a.sortOrder - b.sortOrder),
          )
        }}
        onReorderGroups={(groupIds) => {
          const byId = new Map(groupOrder.map((g) => [g.id, g]))
          setGroupOrder(
            groupIds
              .map((id) => byId.get(id))
              .filter((g): g is (typeof groupOrder)[number] => Boolean(g)),
          )
        }}
        fabHidden={pendingDelete !== null}
        demoMode={{ allTodos: filtered, onOpenTimelineDemo: () => {} }}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title="确定删除这条待办？"
        description={pendingDelete ? `「${pendingDelete.title}」` : undefined}
        confirmLabel="确认删除"
        tone="danger"
        onConfirm={() => {
          if (pendingDelete) {
            setItems((list) => list.filter((x) => x.id !== pendingDelete.id))
            setPendingDelete(null)
          }
        }}
      />
    </>
  )
}
