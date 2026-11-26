import 'server-only'
import { tool } from 'ai'
import * as z from 'zod'
import type { AgentDraft } from '@/features/agent/schemas'
import {
  TODO_ABANDON_REASON_MAX,
  TODO_DEFAULT_GROUP_NAME,
  TODO_EVENT_TYPES,
  TODO_GROUP_NAME_MAX,
  TODO_LIFECYCLE_STATUSES,
  TODO_NOTE_MAX,
  TODO_PRIORITIES,
  TODO_QUERY_STATUSES,
  TODO_TAG_MAX_LENGTH,
  TODO_TAGS_MAX_COUNT,
  TODO_TITLE_MAX,
} from '@/features/todo/schemas'
import { BUSINESS_TIME_ZONE, combineLocal, toInstant } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import * as todoRead from '@/server/services/agent/todo-read'
import type { Clock } from '@/server/services/checkins/rules'

/*
 * 对话 Agent 的待办专项工具（独立封装，复用 ToolLoopAgent / DraftCard / 额度体系）：
 * - 遵循渐进式披露：
 *   1. getTodoOverview（轻量索引 ~200 tokens）
 *   2. listTodos（定向分页筛选，支持 active 合并未过期+已过期、dueFrom/dueTo 筛截止日）
 *   3. getTodoDetail / getTodoTimeline（按需读完整 2000 字备注与全生命周期时间轴含已归档）
 * - 单轮内存记忆化（turnMemo）：同一轮多步调用中同参查询 0 额外 DB 查库。
 * - 所有写操作一律走草稿工具（draftTodo / draftUpdateTodo / draftDeleteTodo / draftTodoGroup），
 *   严禁在 execute 中写业务表，必须由用户在前端草稿卡点击确认后走 /api/v1 接口落库。
 */

export interface TodoToolContext {
  userId: string
  now: Date
  clock?: Clock
}

function stableKey(name: string, input: Record<string, unknown>): string {
  const entries = Object.entries(input)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `${name}:${JSON.stringify(entries)}`
}

/**
 * 将 Agent 传入的 dueAt 规范化为 UTC ISO 字符串（严禁依赖服务器系统时区）：
 * - 带 Z 或 ±HH:MM 时区偏移：经 toInstant 转 UTC ISO；
 * - 无时区的本地日期时间（YYYY-MM-DDTHH:mm[:ss] / YYYY-MM-DD HH:mm）：按用户 timeZone 换算；
 * - 仅日期（YYYY-MM-DD）：按用户 timeZone 当日 23:59 换算。
 */
export function parseAgentDueAt(raw: string | null | undefined, timeZone: string): string | null {
  if (raw === null || raw === undefined) return null
  const trimmed = raw.trim()
  if (trimmed === '') return null

  if (/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed)) {
    try {
      return toInstant(trimmed).toISOString()
    } catch {
      throw new Error(
        'dueAt 必须是合法的 ISO 8601 时间字符串（如 2026-11-02T10:00:00.000Z）或 null',
      )
    }
  }

  const localDt = /^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})(?::\d{2})?$/.exec(trimmed)
  if (localDt?.[1] && localDt[2]) {
    try {
      return combineLocal(localDt[1], localDt[2], timeZone).toISOString()
    } catch {
      throw new Error(`dueAt 本地时间无效：${trimmed}`)
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    try {
      return combineLocal(trimmed, '23:59', timeZone).toISOString()
    } catch {
      throw new Error(`dueAt 日期无效：${trimmed}`)
    }
  }

  throw new Error('dueAt 格式不合法：请传带 Z 的 UTC ISO 字符串、YYYY-MM-DDTHH:mm 或 null')
}

function asToolError(err: unknown): { error: true; code: string; detail: string } {
  if (err instanceof ApiError) {
    return { error: true, code: err.code, detail: err.message }
  }
  const detail = err instanceof Error ? err.message : '操作未能通过校验'
  return { error: true, code: 'VALIDATION_FAILED', detail }
}

export function buildTodoTools({ userId, now, clock }: TodoToolContext) {
  const timeZone = clock?.timeZone ?? BUSINESS_TIME_ZONE
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
      '【渐进式第 1 层】获取待办轻量概览：全部分组及进行中数量、已过期数、近 30 天已完成/已放弃数、已归档总数、四象限数量分布、常用标签，以及最紧急的 5 条待办。凡涉及待办分析、规划或修改删除定位前，先调它了解结构。',
    inputSchema: z.object({}),
    execute: () => cached('getTodoOverview', () => todoRead.getAgentTodoOverview(userId, now)),
  })

  const listTodosTool = tool({
    description:
      '【渐进式第 2 层】按条件分页查询待办精简列表。status 说明：active=全部进行中（含已过期，修改/完成/删除定位优先用它）、open=未过期进行中、overdue=仅已过期、done=近30天已完成、abandoned=近30天已放弃、archived=满30天自动归档、quadrant=按四象限排序。筛选截止日期请用 dueFrom/dueTo，from/to 筛选创建时间或完成时间。',
    inputSchema: z.object({
      status: z.enum(TODO_QUERY_STATUSES).default('active'),
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
        .describe('创建/终态起始日期 YYYY-MM-DD（不是截止日）'),
      to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe('创建/终态结束日期 YYYY-MM-DD（不是截止日）'),
      dueFrom: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe('按截止时间（dueAt）起始日期 YYYY-MM-DD'),
      dueTo: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe('按截止时间（dueAt）结束日期 YYYY-MM-DD'),
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
      '把用户说的事整理成一条新建待办草稿（不写入，用户确认后生效）。支持四象限优先级（默认 not-important-not-urgent 不重要不紧急）、分组（默认「默认待办」，也可指定新分组名）、自定义标签（最多 5 个）与备注（最多 2000 字）。DDL 不明确就问，不要瞎编时间。',
    inputSchema: z.object({
      title: z.string().trim().min(1).max(TODO_TITLE_MAX),
      note: z.string().trim().max(TODO_NOTE_MAX).nullable().optional(),
      dueAt: z
        .string()
        .describe('ISO 时刻（UTC 带 Z，或用户时区 YYYY-MM-DDTHH:mm），没有就传 null 或省略')
        .nullable()
        .optional()
        .default(null),
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
    execute: async ({
      title,
      note,
      dueAt,
      priority,
      groupName,
      tags,
    }): Promise<AgentDraft | { error: true; code: string; detail: string }> => {
      try {
        const normalizedDueAt = parseAgentDueAt(dueAt, timeZone)
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

        await todoRead.checkAgentTodoCreateLimits(userId, isNewGroup)

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
      } catch (err: unknown) {
        return asToolError(err)
      }
    },
  })

  const draftUpdateTodo = tool({
    description:
      '整理一条修改待办草稿（不写入，用户确认后生效）。可编辑标题、备注、截止时间、四象限优先级、标签、移动分组（支持指定新分组名），或变更状态（done 标记完成 / abandoned 放弃并可附原因 / open 取消完成或从已归档恢复进行中）。调用前必须先查 listTodos 或 getTodoOverview 拿到准确的 todoId。',
    inputSchema: z.object({
      todoId: z.uuid().describe('要修改的待办 ID（必须来自查询结果，禁止编造）'),
      title: z.string().trim().min(1).max(TODO_TITLE_MAX).optional(),
      note: z.string().trim().max(TODO_NOTE_MAX).nullable().optional(),
      dueAt: z
        .string()
        .describe('新的截止时刻（UTC 带 Z 或用户时区 YYYY-MM-DDTHH:mm），取消截止传 null')
        .nullable()
        .optional(),
      priority: z.enum(TODO_PRIORITIES).optional(),
      tags: z
        .array(z.string().trim().min(1).max(TODO_TAG_MAX_LENGTH))
        .max(TODO_TAGS_MAX_COUNT)
        .optional(),
      groupName: z
        .string()
        .trim()
        .min(1)
        .max(TODO_GROUP_NAME_MAX)
        .optional()
        .describe('目标分组名（可填已有分组名或新分组名）'),
      status: z
        .enum(TODO_LIFECYCLE_STATUSES)
        .optional()
        .describe('done=标记完成，abandoned=放弃，open=恢复进行中（含恢复已归档）'),
      abandonReason: z
        .string()
        .trim()
        .max(TODO_ABANDON_REASON_MAX)
        .nullable()
        .optional()
        .describe('放弃原因（仅 status=abandoned 时生效）'),
      reason: z
        .string()
        .trim()
        .min(1)
        .max(80)
        .describe('一句话写明本次修改/状态变更的原因，如「用户已提交报告，标记完成」'),
    }),
    execute: async (
      params,
    ): Promise<AgentDraft | { error: true; code: string; detail: string }> => {
      try {
        const normalizedDueAt =
          params.dueAt === undefined ? undefined : parseAgentDueAt(params.dueAt, timeZone)
        return await todoRead.previewAgentTodoUpdate(
          userId,
          {
            todoId: params.todoId,
            title: params.title,
            note: params.note,
            dueAt: normalizedDueAt,
            priority: params.priority,
            tags: params.tags,
            groupName: params.groupName,
            status: params.status,
            abandonReason: params.abandonReason,
            reason: params.reason,
            timeZone,
          },
          now,
        )
      } catch (err: unknown) {
        return asToolError(err)
      }
    },
  })

  const draftDeleteTodo = tool({
    description:
      '整理一条删除待办草稿（不写入，用户确认后生效）。删除后待办行移除，但过程时间轴仍保留删除快照。调用前必须先查 listTodos 拿到准确的 todoId。',
    inputSchema: z.object({
      todoId: z.uuid().describe('要删除的待办 ID（必须来自查询结果）'),
      reason: z.string().trim().min(1).max(80).describe('一句话写明删除原因'),
    }),
    execute: async ({
      todoId,
      reason,
    }): Promise<AgentDraft | { error: true; code: string; detail: string }> => {
      try {
        return await todoRead.previewAgentTodoDelete(userId, todoId, reason, now)
      } catch (err: unknown) {
        return asToolError(err)
      }
    },
  })

  const draftTodoGroup = tool({
    description:
      '整理一条待办分组管理草稿（新建 create / 重命名 rename / 删除 delete，不写入，用户确认后生效）。「默认待办」受保护不可重命名或删除；删除自定义分组时组内待办会自动安全迁回「默认待办」。',
    inputSchema: z.object({
      action: z.enum(['create', 'rename', 'delete']),
      groupId: z.uuid().optional().describe('rename / delete 时的分组 ID（来自 getTodoOverview）'),
      name: z
        .string()
        .trim()
        .min(1)
        .max(TODO_GROUP_NAME_MAX)
        .optional()
        .describe('create 时为新分组名；rename / delete 时可按原分组名定位'),
      newName: z
        .string()
        .trim()
        .min(1)
        .max(TODO_GROUP_NAME_MAX)
        .optional()
        .describe('rename 时的新分组名'),
      reason: z.string().trim().min(1).max(80).optional().describe('一句话原因说明'),
    }),
    execute: async (
      params,
    ): Promise<AgentDraft | { error: true; code: string; detail: string }> => {
      try {
        return await todoRead.previewAgentTodoGroup(userId, params)
      } catch (err: unknown) {
        return asToolError(err)
      }
    },
  })

  return {
    getTodoOverview: getTodoOverviewTool,
    listTodos: listTodosTool,
    getTodoDetail: getTodoDetailTool,
    getTodoTimeline: getTodoTimelineTool,
    draftTodo,
    draftUpdateTodo,
    draftDeleteTodo,
    draftTodoGroup,
  }
}
