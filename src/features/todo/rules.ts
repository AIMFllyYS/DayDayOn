import { addDays, calendarDateOf, formatDateTime, formatTime, secondsBetween } from '@/lib/time'
import type { Todo } from './schemas'

/*
 * 待办的纯规则（PRD 2.10）：排序、DDL 状态、DDL 文案、视图参数。前后端共用，不读当前时间。
 * 服务端列表用同一个比较函数做最终排序，乐观更新时前端也按它插回原位。
 */

/** 页面视图：?view=list|log，非法值回落到 list（routing.md 第 4 节） */
export const TODO_VIEWS = ['list', 'log'] as const
export type TodoView = (typeof TODO_VIEWS)[number]

export function parseTodoView(value: string | null | undefined): TodoView {
  return value === 'log' ? 'log' : 'list'
}

/** "快到期"的窗口：24 小时 */
export const DUE_SOON_SECONDS = 24 * 3600

/** 已完成列表只显示最近 30 天（按完成时间） */
export const DONE_WINDOW_SECONDS = 30 * 24 * 3600

type Sortable = Pick<Todo, 'id' | 'dueAt' | 'createdAt'>
type DoneSortable = Pick<Todo, 'id' | 'doneAt'>

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * 进行中：DDL 升序，没有 DDL 的排后；DDL 相同按创建时间升序，再按 id。
 * 时间都是带 Z 的 ISO 字符串（同一格式），可以直接按字符串比较。
 */
export function compareOpenTodos(a: Sortable, b: Sortable): number {
  if (a.dueAt !== b.dueAt) {
    if (a.dueAt === null) return 1
    if (b.dueAt === null) return -1
    const byDue = cmp(toMs(a.dueAt), toMs(b.dueAt))
    if (byDue !== 0) return byDue
  }
  return cmp(toMs(a.createdAt), toMs(b.createdAt)) || cmp(a.id, b.id)
}

/** 已完成：完成时间降序，再按 id 降序（与服务端游标顺序一致） */
export function compareDoneTodos(a: DoneSortable, b: DoneSortable): number {
  const da = a.doneAt === null ? '' : toMs(a.doneAt)
  const db = b.doneAt === null ? '' : toMs(b.doneAt)
  return cmp(db, da) || cmp(b.id, a.id)
}

/** 比较用的定长毫秒字符串：ISO 字符串的小数位数可能不同（.5Z 与 .500Z），统一后再比较 */
function toMs(iso: string): string {
  return String(new Date(iso).getTime()).padStart(16, '0')
}

export function sortOpenTodos<T extends Sortable>(items: readonly T[]): T[] {
  return [...items].sort(compareOpenTodos)
}

export type DueStatus = 'none' | 'later' | 'soon' | 'overdue'

/**
 * DDL 状态：没有 DDL → none；已过 → overdue（到点即过期）；24 小时内 → soon；其余 later。
 * now 由调用方传入。
 */
export function dueStatus(dueAt: string | null, now: Date | string): DueStatus {
  if (dueAt === null) return 'none'
  const left = secondsBetween(now, dueAt)
  if (left <= 0) return 'overdue'
  if (left < DUE_SOON_SECONDS) return 'soon'
  return 'later'
}

/**
 * DDL 文案（按用户时区的日历日期）：'今天 23:59'、'明天 07:00'、'昨天 18:00'，其余 '11月3日 23:59'。
 */
export function formatDue(dueAt: string, now: Date | string, timeZone: string): string {
  const today = calendarDateOf(now, timeZone)
  const day = calendarDateOf(dueAt, timeZone)
  const time = formatTime(dueAt, timeZone)
  if (day === today) return `今天 ${time}`
  if (day === addDays(today, 1)) return `明天 ${time}`
  if (day === addDays(today, -1)) return `昨天 ${time}`
  return formatDateTime(dueAt, timeZone)
}
