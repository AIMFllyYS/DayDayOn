import type { Tone } from '@/components/ui/tone'
import { addDays, calendarDateOf, formatDateTime, formatTime, secondsBetween } from '@/lib/time'
import {
  TODO_AUTO_ARCHIVE_DAYS,
  type Todo,
  type TodoEvent,
  type TodoEventType,
  type TodoPriority,
} from './schemas'

/*
 * 待办的纯规则（Todo v2）：视图与展示模式解析、四象限双维度映射、排序、过期与 30 天自动归档判定。
 * 前后端共用，绝不读取当前系统时间（所有需要"现在"的函数均由调用方传入 now）。
 */

/** 顶部分段视图：?view=list|log（保留原样，非法值回落到 list） */
export const TODO_VIEWS = ['list', 'log'] as const
export type TodoView = (typeof TODO_VIEWS)[number]

export function parseTodoView(value: string | null | undefined): TodoView {
  return value === 'log' ? 'log' : 'list'
}

/** 清单展示模式：?mode=list|quadrant（右上角菜单切换） */
export const TODO_LAYOUT_MODES = ['list', 'quadrant'] as const
export type TodoLayoutMode = (typeof TODO_LAYOUT_MODES)[number]

export function parseTodoLayoutMode(value: string | null | undefined): TodoLayoutMode {
  return value === 'quadrant' ? 'quadrant' : 'list'
}

/** "快到期"的窗口：24 小时 */
export const DUE_SOON_SECONDS = 24 * 3600

/** 30 天自动归档窗口（已完成与已放弃共用） */
export const DONE_WINDOW_SECONDS = TODO_AUTO_ARCHIVE_DAYS * 24 * 3600

// ---------------------------------------------------------------------------
// 四象限优先级双维度映射
// ---------------------------------------------------------------------------

export type TodoImportance = 'normal' | 'important'
export type TodoUrgency = 'normal' | 'urgent'

export interface TodoPriorityMeta {
  priority: TodoPriority
  label: string
  shortLabel: string
  description: string
  tone: Tone
  importance: TodoImportance
  urgency: TodoUrgency
}

export const TODO_PRIORITY_META: Record<TodoPriority, TodoPriorityMeta> = {
  'urgent-important': {
    priority: 'urgent-important',
    label: '重要且紧急',
    shortLabel: '重要紧急',
    description: '优先立刻处理',
    tone: 'danger',
    importance: 'important',
    urgency: 'urgent',
  },
  'important-not-urgent': {
    priority: 'important-not-urgent',
    label: '重要不紧急',
    shortLabel: '重要不紧急',
    description: '提前安排推进',
    tone: 'primary',
    importance: 'important',
    urgency: 'normal',
  },
  'urgent-not-important': {
    priority: 'urgent-not-important',
    label: '紧急不重要',
    shortLabel: '紧急不重要',
    description: '快速清掉或简办',
    tone: 'warning',
    importance: 'normal',
    urgency: 'urgent',
  },
  'not-important-not-urgent': {
    priority: 'not-important-not-urgent',
    label: '不重要不紧急',
    shortLabel: '不重要不紧急',
    description: '有空时顺手做',
    tone: 'neutral',
    importance: 'normal',
    urgency: 'normal',
  },
}

export function priorityFromAxes(importance: TodoImportance, urgency: TodoUrgency): TodoPriority {
  if (importance === 'important' && urgency === 'urgent') return 'urgent-important'
  if (importance === 'important' && urgency === 'normal') return 'important-not-urgent'
  if (importance === 'normal' && urgency === 'urgent') return 'urgent-not-important'
  return 'not-important-not-urgent'
}

export function axesFromPriority(priority: TodoPriority): {
  importance: TodoImportance
  urgency: TodoUrgency
} {
  const meta = TODO_PRIORITY_META[priority]
  return { importance: meta.importance, urgency: meta.urgency }
}

// ---------------------------------------------------------------------------
// 过期与 30 天自动归档判定
// ---------------------------------------------------------------------------

export type DueStatus = 'none' | 'later' | 'soon' | 'overdue'

/** DDL 状态：没有 DDL → none；已过 → overdue（到点即过期）；24 小时内 → soon；其余 later */
export function dueStatus(dueAt: string | null, now: Date | string): DueStatus {
  if (dueAt === null) return 'none'
  const left = secondsBetween(now, dueAt)
  if (left <= 0) return 'overdue'
  if (left < DUE_SOON_SECONDS) return 'soon'
  return 'later'
}

/** 是否属于「已过期」分组：仅未完成（open）且 DDL 已到期 */
export function isOverdueTodo(todo: Pick<Todo, 'status' | 'dueAt'>, now: Date | string): boolean {
  return todo.status === 'open' && dueStatus(todo.dueAt, now) === 'overdue'
}

/** 30 天自动归档截止时刻（用于服务端 SQL 与前端纯函数一致口径） */
export function archiveCutoff(now: Date): Date {
  return new Date(now.getTime() - DONE_WINDOW_SECONDS * 1000)
}

/** 已完成或已放弃满 30 天自动归档（不做手动归档） */
export function isAutoArchived(
  todo: Pick<Todo, 'status' | 'settledAt' | 'doneAt' | 'abandonedAt'>,
  now: Date | string,
): boolean {
  if (todo.status === 'open') return false
  const settled = todo.settledAt ?? todo.doneAt ?? todo.abandonedAt
  if (!settled) return false
  const nowMs = typeof now === 'string' ? new Date(now).getTime() : now.getTime()
  return new Date(settled).getTime() < nowMs - DONE_WINDOW_SECONDS * 1000
}

// ---------------------------------------------------------------------------
// 排序比较器
// ---------------------------------------------------------------------------

type OpenSortable = Pick<Todo, 'id' | 'sortOrder' | 'dueAt' | 'createdAt'>
type SettledSortable = Pick<Todo, 'id' | 'settledAt' | 'doneAt' | 'abandonedAt'>
type QuadrantSortable = Pick<Todo, 'id' | 'createdAt'>

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** 比较用的定长毫秒字符串：统一 ISO 字符串小数位数后再比较 */
function toMs(iso: string): string {
  return String(new Date(iso).getTime()).padStart(16, '0')
}

/** 分组内进行中排序：用户拖拽 sortOrder 升序 → DDL 升序（无 DDL 排后）→ 创建时间升序 → id */
export function compareOpenTodos(a: OpenSortable, b: OpenSortable): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
  if (a.dueAt !== b.dueAt) {
    if (a.dueAt === null) return 1
    if (b.dueAt === null) return -1
    const byDue = cmp(toMs(a.dueAt), toMs(b.dueAt))
    if (byDue !== 0) return byDue
  }
  return cmp(toMs(a.createdAt), toMs(b.createdAt)) || cmp(a.id, b.id)
}

export function sortOpenTodos<T extends OpenSortable>(items: readonly T[]): T[] {
  return [...items].sort(compareOpenTodos)
}

/** 四象限排序：按创建时间从近到远（createdAt DESC, id DESC） */
export function compareQuadrantTodos(a: QuadrantSortable, b: QuadrantSortable): number {
  return cmp(toMs(b.createdAt), toMs(a.createdAt)) || cmp(b.id, a.id)
}

export function sortQuadrantTodos<T extends QuadrantSortable>(items: readonly T[]): T[] {
  return [...items].sort(compareQuadrantTodos)
}

/** 已完成 / 已放弃 / 已归档：终态时间降序，再按 id 降序 */
export function compareSettledTodos(a: SettledSortable, b: SettledSortable): number {
  const sa = a.settledAt ?? a.doneAt ?? a.abandonedAt
  const sb = b.settledAt ?? b.doneAt ?? b.abandonedAt
  const ma = sa === null ? '' : toMs(sa)
  const mb = sb === null ? '' : toMs(sb)
  return cmp(mb, ma) || cmp(b.id, a.id)
}

/** 兼容旧函数名 */
export const compareDoneTodos = compareSettledTodos

// ---------------------------------------------------------------------------
// 展示格式化与过程时间轴按日分组
// ---------------------------------------------------------------------------

/** DDL 文案（按用户时区日历日期）：'今天 23:59'、'明天 07:00'、'昨天 18:00'，其余 '11月3日 23:59' */
export function formatDue(dueAt: string, now: Date | string, timeZone: string): string {
  const today = calendarDateOf(now, timeZone)
  const day = calendarDateOf(dueAt, timeZone)
  const time = formatTime(dueAt, timeZone)
  if (day === today) return `今天 ${time}`
  if (day === addDays(today, 1)) return `明天 ${time}`
  if (day === addDays(today, -1)) return `昨天 ${time}`
  return formatDateTime(dueAt, timeZone)
}

export const TODO_EVENT_META: Record<TodoEventType, { label: string; verb: string; tone: Tone }> = {
  created: { label: '新建', verb: '新建了待办', tone: 'primary' },
  completed: { label: '完成', verb: '完成了待办', tone: 'success' },
  reopened: { label: '恢复', verb: '重新打开了待办', tone: 'study' },
  abandoned: { label: '放弃', verb: '放弃了待办', tone: 'warning' },
  moved: { label: '移动', verb: '移动了分组', tone: 'neutral' },
  updated: { label: '编辑', verb: '更新了内容', tone: 'neutral' },
  deleted: { label: '删除', verb: '删除了待办', tone: 'danger' },
}

/** 将过程事件按用户时区的本地日历日期分组（保持输入顺序） */
export function groupEventsByLocalDate(
  events: readonly TodoEvent[],
  timeZone: string,
): [string, TodoEvent[]][] {
  const out: [string, TodoEvent[]][] = []
  for (const ev of events) {
    const day = calendarDateOf(ev.occurredAt, timeZone)
    const last = out.at(-1)
    if (last && last[0] === day) last[1].push(ev)
    else out.push([day, [ev]])
  }
  return out
}
