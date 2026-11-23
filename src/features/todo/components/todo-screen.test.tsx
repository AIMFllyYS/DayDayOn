import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '@/lib/api'
import type { Todo, TodoOverview } from '../schemas'
import { TodoFab } from './todo-fab'
import { TodoPriorityPicker } from './todo-priority-picker'
import { TodoScreen } from './todo-screen'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const NOW = new Date('2026-11-01T02:00:00.000Z')
const TZ = 'Asia/Shanghai'
const DEFAULT_GROUP = '0193f6b2-0000-7000-8000-000000000101'
const STUDY_GROUP = '0193f6b2-0000-7000-8000-000000000102'

const sampleTodos: Todo[] = [
  {
    id: '0193f6b2-0000-7000-8000-000000000001',
    groupId: DEFAULT_GROUP,
    groupName: '默认待办',
    title: '交数据结构实验报告，超长标题需要被严格省略避免压盖右侧删除按钮',
    note: '需要附上性能分析',
    dueAt: '2026-11-01T15:59:00.000Z',
    priority: 'urgent-important',
    tags: ['高数', '作业'],
    status: 'open',
    doneAt: null,
    abandonedAt: null,
    abandonReason: null,
    settledAt: null,
    isArchived: false,
    sortOrder: 0,
    createdAt: '2026-10-30T01:00:00.000Z',
    updatedAt: '2026-10-30T01:00:00.000Z',
  },
  {
    id: '0193f6b2-0000-7000-8000-000000000002',
    groupId: STUDY_GROUP,
    groupName: '学习',
    title: '折叠分组内的待办不应在未展开时挂载',
    note: null,
    dueAt: null,
    priority: 'important-not-urgent',
    tags: [],
    status: 'open',
    doneAt: null,
    abandonedAt: null,
    abandonReason: null,
    settledAt: null,
    isArchived: false,
    sortOrder: 0,
    createdAt: '2026-10-30T02:00:00.000Z',
    updatedAt: '2026-10-30T02:00:00.000Z',
  },
  {
    id: '0193f6b2-0000-7000-8000-000000000003',
    groupId: DEFAULT_GROUP,
    groupName: '默认待办',
    title: '已完成的待办不应进四象限',
    note: null,
    dueAt: null,
    priority: 'urgent-important',
    tags: [],
    status: 'done',
    doneAt: '2026-10-31T10:00:00.000Z',
    abandonedAt: null,
    abandonReason: null,
    settledAt: '2026-10-31T10:00:00.000Z',
    isArchived: false,
    sortOrder: 0,
    createdAt: '2026-10-30T03:00:00.000Z',
    updatedAt: '2026-10-31T10:00:00.000Z',
  },
]

const overview: TodoOverview = {
  defaultGroupId: DEFAULT_GROUP,
  groups: [
    {
      id: DEFAULT_GROUP,
      name: '默认待办',
      isDefault: true,
      sortOrder: 0,
      openCount: 1,
      soonCount: 1,
      createdAt: '2026-10-30T00:00:00.000Z',
      updatedAt: '2026-10-30T00:00:00.000Z',
    },
    {
      id: STUDY_GROUP,
      name: '学习',
      isDefault: false,
      sortOrder: 1,
      openCount: 1,
      soonCount: 0,
      createdAt: '2026-10-30T00:00:00.000Z',
      updatedAt: '2026-10-30T00:00:00.000Z',
    },
  ],
  tags: [
    {
      id: '0193f6b2-0000-7000-8000-000000000201',
      name: '高数',
      createdAt: '2026-10-30T00:00:00.000Z',
    },
  ],
  counts: {
    openTotal: 2,
    overdueCount: 0,
    doneRecentCount: 1,
    abandonedRecentCount: 0,
    archivedCount: 4,
    quadrants: {
      'urgent-important': 1,
      'important-not-urgent': 1,
      'urgent-not-important': 0,
      'not-important-not-urgent': 0,
    },
  },
  defaultGroupTodos: { items: [sampleTodos[0]!], nextCursor: null },
}

const noop = () => {}

describe('TodoScreen 渲染与折叠性能守卫', () => {
  it('列表视图：保留清单/时间日志、右上角过程与菜单、默认仅展开默认待办、折叠组零 DOM 挂载、右下角悬浮球置顶', () => {
    const html = renderToStaticMarkup(
      <ApiProvider>
        <TodoScreen
          view="list"
          onViewChange={noop}
          mode="list"
          onModeChange={noop}
          onTagChange={noop}
          onCreate={noop}
          onOpenGroupManager={noop}
          onNavigateArchived={noop}
          status="ready"
          overview={overview}
          expandedGroups={new Set([DEFAULT_GROUP])}
          onToggleGroup={noop}
          onExpandAllGroups={noop}
          onCollapseAllGroups={noop}
          overdueOpen={false}
          onToggleOverdue={noop}
          doneOpen={false}
          onToggleDone={noop}
          abandonedOpen={false}
          onToggleAbandoned={noop}
          now={NOW}
          timeZone={TZ}
          onToggleTodo={noop}
          onOpenManage={noop}
          onRequestDelete={noop}
          onReorderTodos={noop}
          onReorderGroups={noop}
          demoMode={{ allTodos: sampleTodos }}
        />
      </ApiProvider>,
    )

    // 保留左上角分段开关 + 右侧过程/菜单
    expect(html).toContain('清单')
    expect(html).toContain('时间日志')
    expect(html).toContain('href="/todo/timeline"')
    expect(html).toContain('过程')
    expect(html).toContain('菜单')

    // 面板结构：默认待办展开，折叠组内的待办未挂载进 DOM
    expect(html).toContain('默认待办')
    expect(html).toContain('学习')
    expect(html).toContain('已完成')
    expect(html).toContain('已放弃')
    expect(html).toContain('交数据结构实验报告')
    expect(html).not.toContain('折叠分组内的待办不应在未展开时挂载')

    // 标题严格带 truncate，副标题带四象限与自定义标签，右下角悬浮球（Playbook 演示态 contained）
    expect(html).toContain('truncate')
    expect(html).toContain('重要紧急')
    expect(html).toContain('#高数')
    expect(html).toContain('#作业')
    expect(html).toContain('aria-label="新建待办"')
    expect(html).toContain('z-[35]')
  })

  it('四象限视图：仅渲染进行中待办（排除已完成），忽略自定义分组，展示四大象限', () => {
    const html = renderToStaticMarkup(
      <ApiProvider>
        <TodoScreen
          view="list"
          onViewChange={noop}
          mode="quadrant"
          onModeChange={noop}
          onTagChange={noop}
          onCreate={noop}
          onOpenGroupManager={noop}
          onNavigateArchived={noop}
          status="ready"
          overview={overview}
          expandedGroups={new Set([DEFAULT_GROUP])}
          onToggleGroup={noop}
          onExpandAllGroups={noop}
          onCollapseAllGroups={noop}
          overdueOpen={false}
          onToggleOverdue={noop}
          doneOpen={false}
          onToggleDone={noop}
          abandonedOpen={false}
          onToggleAbandoned={noop}
          now={NOW}
          timeZone={TZ}
          onToggleTodo={noop}
          onOpenManage={noop}
          onRequestDelete={noop}
          onReorderTodos={noop}
          onReorderGroups={noop}
          demoMode={{ allTodos: sampleTodos }}
        />
      </ApiProvider>,
    )

    expect(html).toContain('data-todo-quadrant-grid="2x2"')
    expect(html).toContain('grid-cols-[minmax(0,1fr)_minmax(0,1fr)]')
    expect(html).toContain('grid-rows-2')
    expect(html).toContain('h-60')
    expect(html).toContain('overflow-y-auto')
    expect(html).toContain('overscroll-contain')
    expect(html).toContain('重要且紧急')
    expect(html).toContain('重要不紧急')
    expect(html).toContain('紧急不重要')
    expect(html).toContain('不重要不紧急')
    expect(html).toContain('交数据结构实验报告')
    expect(html).toContain('折叠分组内的待办不应在未展开时挂载')
    expect(html).not.toContain('已完成的待办不应进四象限')
  })

  it('TodoPriorityPicker 正确呈现双维度开关与实时四象限标签', () => {
    const html = renderToStaticMarkup(
      <TodoPriorityPicker value="not-important-not-urgent" onValueChange={noop} />,
    )
    expect(html).toContain('不重要不紧急')
    expect(html).toContain('普通')
    expect(html).toContain('重要')
    expect(html).toContain('不紧急')
    expect(html).toContain('紧急')
  })

  it('TodoFab 在正式页面模式通过客户端 Portal 脱离 @container，SSR 首帧不误挂进滚动文档流', () => {
    const ssrLiveHtml = renderToStaticMarkup(<TodoFab onClick={noop} />)
    expect(ssrLiveHtml).toBe('')

    const containedHtml = renderToStaticMarkup(<TodoFab onClick={noop} contained />)
    expect(containedHtml).toContain('aria-label="新建待办"')
    expect(containedHtml).toContain('sticky')
  })
})
