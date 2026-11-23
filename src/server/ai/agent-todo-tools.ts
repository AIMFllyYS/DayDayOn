import 'server-only'
import { tool } from 'ai'
import * as z from 'zod'
import type { AgentDraft } from '@/features/agent/schemas'
import {
  TODO_DEFAULT_GROUP_NAME,
  TODO_EVENT_TYPES,
  TODO_GROUP_NAME_MAX,
  TODO_NOTE_MAX,
  TODO_PRIORITIES,
  TODO_QUERY_STATUSES,
  TODO_TAG_MAX_LENGTH,
  TODO_TAGS_MAX_COUNT,
  TODO_TITLE_MAX,
} from '@/features/todo/schemas'
import * as todoRead from '@/server/services/agent/todo-read'

/*
 * 对话 Agent 的待办专项工具（独立封装，复用 ToolLoopAgent / DraftCard / 额度体系）：
 * - 遵循渐进式披露：
 *   1. getTodoOverview（轻量索引 ~200 tokens）
 *   2. listTodos（定向分页筛选，精简投影 + 备注预览）
 *   3. getTodoDetail / getTodoTimeline（按需读完整 2000 字备注与全生命周期时间轴含已归档）
 * - 单轮内存记忆化（turnMemo）：同一轮多步调用中同参查询 0 额外 DB 查库。
 * - 写操作一律走草稿工具 draftTodo，用户确认后调 POST /api/v1/todos。
 */

export interface TodoToolContext {
  userId: string
  now: Date
}

function stableKey(name: string, input: Record<string, unknown>): string {
  const entries = Object.entries(input)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `${name}:${JSON.stringify(entries)}`
}

export function buildTodoTools({ userId, now }: TodoToolContext) {
  const turnMemo = new Map<string, Promise<unknown>>()

  function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = turnMemo.get(key)
    if (hit) return hit as Promise<T>
    const pending = load().catch((err: unknown) => {
      turnMemo.delete(key)
      throw err
    })
    turnMemo.set(key, pending)
    return pending
  }

  const getTodoOverviewTool = tool({
    description:
      '【渐进式第 1 层】获取待办轻量概览：全部分组及进行中数量、已过期数、近 30 天已完成/已放弃数、已归档总数、四象限数量分布、常用标签，以及最紧急的 5 条待办。凡涉及待办分析或规划时必须先调它，不要一上来拉全量明细。',
    inputSchema: z.object({}),
    execute: () => cached('getTodoOverview', () => todoRead.getAgentTodoOverview(userId, now)),
  })

  const listTodosTool = tool({
    description:
      '【渐进式第 2 层】按条件分页查询待办精简列表（支持 status: open 进行中 / overdue 已过期 / done 近30天已完成 / abandoned 近30天已放弃 / archived 满30天自动归档 / quadrant 四象限进行中，支持按分组名、四象限优先级、标签、关键词、日期范围筛选）。列表不含 2000 字长备注全文，需看完整备注请用 getTodoDetail。',
    inputSchema: z.object({
      status: z.enum(TODO_QUERY_STATUSES).default('open'),
      groupId: z.uuid().optional().describe('分组 ID（来自 getTodoOverview）'),
      groupName: z
        .string()
        .trim()
        .min(1)
        .max(TODO_GROUP_NAME_MAX)
        .optional()
        .describe('分组名称，如「默认待办」'),
      priority: z.enum(TODO_PRIORITIES).optional().describe('四象限优先级筛选'),
      tag: z
        .string()
        .trim()
        .min(1)
        .max(TODO_TAG_MAX_LENGTH)
        .optional()
        .describe('按自定义标签筛选'),
      keyword: z.string().trim().min(1).max(60).optional().describe('标题或备注关键词'),
      archivedOutcome: z
        .enum(['done', 'abandoned'])
        .optional()
        .describe('仅 status=archived 时区分原终态'),
      from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe('起始日期 YYYY-MM-DD'),
      to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe('结束日期 YYYY-MM-DD'),
      cursor: z.string().min(1).optional().describe('翻页游标（来自上次返回的 nextCursor）'),
      limit: z.number().int().min(1).max(50).default(20),
    }),
    execute: (params) =>
      cached(stableKey('listTodos', params), () => todoRead.listAgentTodos(userId, now, params)),
  })

  const getTodoDetailTool = tool({
    description:
      '【渐进式第 3 层】按 todoId 读取单条待办完整信息（包含最多 2000 字的完整备注 note、标签、状态与最近 15 条过程记录）。仅在需要查看某条待办的详细备注或具体历程时调用。',
    inputSchema: z.object({
      todoId: z.uuid().describe('待办 ID（来自 getTodoOverview 或 listTodos）'),
    }),
    execute: ({ todoId }) =>
      cached(`getTodoDetail:${todoId}`, () => todoRead.getAgentTodoDetail(userId, now, todoId)),
  })

  const getTodoTimelineTool = tool({
    description:
      '【渐进式第 3 层】读取待办过程时间轴（新建、完成、恢复、放弃、移动分组、编辑、删除事件，天然包含已满 30 天自动归档的历史记录）。不传日期默认近 7 天，用于复盘完成节奏、过期与放弃原因。',
    inputSchema: z.object({
      todoId: z.uuid().optional().describe('只看某一条待办的完整历程'),
      eventType: z.enum(TODO_EVENT_TYPES).optional().describe('筛选事件类型'),
      from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe('起始日期 YYYY-MM-DD'),
      to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe('结束日期 YYYY-MM-DD'),
      cursor: z.string().min(1).optional(),
      limit: z.number().int().min(1).max(60).default(30),
    }),
    execute: (params) =>
      cached(stableKey('getTodoTimeline', params), () =>
        todoRead.getAgentTodoTimeline(userId, now, params),
      ),
  })

  const draftTodo = tool({
    description:
      '把用户说的事整理成一条待办草稿（不写入，用户确认后生效）。支持四象限优先级（默认 not-important-not-urgent 不重要不紧急）、分组（默认「默认待办」，也可指定新分组名）、自定义标签（最多 5 个）与备注（最多 2000 字）。DDL 不明确就问，不要瞎编时间。',
    inputSchema: z.object({
      title: z.string().trim().min(1).max(TODO_TITLE_MAX),
      note: z.string().trim().max(TODO_NOTE_MAX).nullable().optional(),
      dueAt: z.string().describe('ISO 时刻（UTC 带 Z），没有就传 null').nullable(),
      priority: z.enum(TODO_PRIORITIES).default('not-important-not-urgent'),
      groupName: z
        .string()
        .trim()
        .min(1)
        .max(TODO_GROUP_NAME_MAX)
        .optional()
        .describe('目标分组名，不传归入「默认待办」'),
      tags: z
        .array(z.string().trim().min(1).max(TODO_TAG_MAX_LENGTH))
        .max(TODO_TAGS_MAX_COUNT)
        .default([]),
    }),
    execute: async ({ title, note, dueAt, priority, groupName, tags }): Promise<AgentDraft> => {
      let normalizedDueAt: string | null = null
      if (dueAt !== null && dueAt.trim() !== '') {
        const d = new Date(dueAt)
        if (Number.isNaN(d.getTime())) {
          throw new Error(
            'dueAt 必须是合法的 ISO 8601 时间字符串（如 2026-11-02T10:00:00.000Z）或 null',
          )
        }
        normalizedDueAt = d.toISOString()
      }

      const normalizedNote = note && note.trim().length > 0 ? note.trim() : null
      const uniqueTags = [...new Set(tags.map((t) => t.trim()).filter(Boolean))]
      const confirmBody: Record<string, unknown> = {
        title,
        note: normalizedNote,
        dueAt: normalizedDueAt,
        priority,
        tags: uniqueTags,
      }

      let resolvedGroupName = TODO_DEFAULT_GROUP_NAME
      let isNewGroup = false
      if (groupName && groupName.trim() !== TODO_DEFAULT_GROUP_NAME) {
        const found = await todoRead.lookupUserTodoGroupByName(userId, groupName)
        if (found) {
          resolvedGroupName = found.name
          confirmBody.groupId = found.id
        } else {
          resolvedGroupName = groupName.trim()
          isNewGroup = true
          confirmBody.newGroupName = resolvedGroupName
        }
      }

      return {
        kind: 'todo',
        title,
        note: normalizedNote,
        dueAt: normalizedDueAt,
        priority,
        groupName: resolvedGroupName,
        isNewGroup,
        tags: uniqueTags,
        confirmBody,
      }
    },
  })

  return {
    getTodoOverview: getTodoOverviewTool,
    listTodos: listTodosTool,
    getTodoDetail: getTodoDetailTool,
    getTodoTimeline: getTodoTimelineTool,
    draftTodo,
  }
}
