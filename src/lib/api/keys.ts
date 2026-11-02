import type { GoalStatus } from '@/features/goal/schemas'
import type { RankRange } from '@/features/rank/schemas'
import type { TodoStatus } from '@/features/todo/schemas'

/*
 * Query key 工厂：全项目唯一来源（client-data-and-forms.md 第 3 节）。F1 维护；领域缺 key 写进 sharedChangeRequests。
 * 第一段是领域名，失效时按前缀：invalidateQueries({ queryKey: keys.goals.all })。key 里不放 userId。
 */
export const keys = {
  me: {
    all: ['me'] as const,
    detail: () => ['me', 'detail'] as const,
    quota: () => ['me', 'quota'] as const,
    aiRuns: () => ['me', 'ai-runs'] as const,
  },
  goals: {
    all: ['goals'] as const,
    list: (status: GoalStatus) => ['goals', 'list', { status }] as const,
    detail: (goalId: string) => ['goals', 'detail', goalId] as const,
  },
  checkins: {
    all: ['checkins'] as const,
    today: () => ['checkins', 'today'] as const,
    history: (goalId: string, range: { from?: string; to?: string } = {}) =>
      ['checkins', 'history', goalId, range] as const,
    calendar: (goalId: string, month: string) => ['checkins', 'calendar', goalId, month] as const,
  },
  metrics: {
    all: ['metrics'] as const,
    weight: (days: number) => ['metrics', 'weight', { days }] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    today: () => ['dashboard', 'today'] as const,
  },
  rank: {
    all: ['rank'] as const,
    board: (range: RankRange) => ['rank', 'board', { range }] as const,
    feed: () => ['rank', 'feed'] as const,
  },
  todos: {
    all: ['todos'] as const,
    list: (status: TodoStatus) => ['todos', 'list', { status }] as const,
  },
  agent: {
    all: ['agent'] as const,
    conversations: () => ['agent', 'conversations'] as const,
    conversation: (conversationId: string) => ['agent', 'conversation', conversationId] as const,
  },
  admin: {
    all: ['admin'] as const,
    overview: () => ['admin', 'overview'] as const,
    users: (params: { q?: string; offset: number; limit: number }) =>
      ['admin', 'users', params] as const,
    codes: (params: { status?: string; offset: number; limit: number }) =>
      ['admin', 'codes', params] as const,
    settings: () => ['admin', 'settings'] as const,
  },
} as const

/**
 * 打卡类写操作成功后要失效的前缀：打卡弹层、主页、目标详情、排行都会变。
 * 用法：for (const k of afterCheckinChange) queryClient.invalidateQueries({ queryKey: k })
 */
export const afterCheckinChange = [
  keys.checkins.all,
  keys.dashboard.all,
  keys.rank.all,
  keys.me.detail(),
] as const
