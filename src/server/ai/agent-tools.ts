import 'server-only'
import { tool } from 'ai'
import * as z from 'zod'
import type { AgentDraft } from '@/features/agent/schemas'
import type { Clock } from '@/server/services/checkins/rules'
import * as read from '@/server/services/agent/read'
import { db } from '@/server/db/client'
import { getInsights } from '@/server/services/insights'
import { buildCheckinTools } from './agent-checkin-tools'
import { fetchWeb, searchWeb } from './web-search'

/*
 * Agent 工具集。每轮对话构建一次（闭包捕获 userId / now / 搜索预算）。
 * - 读工具：只查库，返回给模型看的精简 JSON。
 * - 草稿工具（draft*）：不写库，返回结构化草稿（AgentDraft），前端渲染成草稿卡，
 *   用户确认后用 confirmBody 调普通接口。打卡的新增、修改、删除、留痕在 agent-checkin-tools.ts。
 * - 图表工具（showStats）：返回板块近况（features/insights），前端渲染成和主页同一种近况卡。
 * - 联网搜索 / 读网页：直接调 DeepSeek Search/Fetch，按次计费，计入额度。
 */

export const MAX_SEARCHES_PER_TURN = 10
/** 每次成功搜索/读网页约 0.005 元 = 5000 微元（ai-and-quota.md 第 4 节） */
export const SEARCH_FETCH_COST_MICROS = 5000

export interface SearchBudget {
  used: number
  costMicros: number
}

export interface AgentToolContext {
  userId: string
  now: Date
  search: SearchBudget
  clock?: Clock
}

export function buildAgentTools(ctx: AgentToolContext) {
  const { userId, now, search } = ctx

  const readProfile = tool({
    description:
      '读取用户的个人资料：昵称、性别、出生年份、身高、吉祥物、人群档位（饮食评分按它定标准）。回答"我是谁/我的资料"时用。',
    inputSchema: z.object({}),
    execute: async () => ({ profile: await read.getProfile(userId) }),
  })

  const listGoalsTool = tool({
    description:
      '列出用户进行中的目标（含目标 id、板块、标题、目标量、每周几、达标规则 rules、截止日期）。需要打卡或提到某个目标时先调它拿到 goalId。',
    inputSchema: z.object({}),
    execute: async () => ({ goals: await read.listGoals(userId) }),
  })

  const todaySummary = tool({
    description:
      '读取今天的状态：各目标进度、完成度、体重、心情。回答"我今天怎么样/完成了什么"时用。',
    inputSchema: z.object({}),
    execute: async () => ({ today: await read.getTodaySummary(userId, now) }),
  })

  const listTodosTool = tool({
    description: '列出未完成的待办（含标题、DDL、优先级）。',
    inputSchema: z.object({}),
    execute: async () => ({ todos: await read.getOpenTodos(userId, now) }),
  })

  const listCheckinsTool = tool({
    description:
      '读取某段日期（含两端，格式 YYYY-MM-DD）内自己的打卡记录，可只看一个目标。不填默认最近 7 天。\
每条带 checkinId、一句话摘要、分数、是否有效（isValid=false 是未达标的存档，不计进度）和 editable（今天、昨天的才能改删）。',
    inputSchema: z.object({
      from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      goalId: z.string().optional().describe('只看这个目标'),
    }),
    execute: async ({ from, to, goalId }) => ({
      checkins: await read.listCheckinsInRange(userId, now, { from, to, goalId }),
    }),
  })

  const weightTool = tool({
    description: '读取最近 30 天的体重记录和 7 天差值。',
    inputSchema: z.object({}),
    execute: async () => ({ weight: await read.getWeight(userId, now) }),
  })

  // 图表：返回的数据前端直接画成近况卡（agent-messages.tsx 的 STATS_TOOLS），数字由服务端算，模型不用复述
  const showStatsTool = tool({
    description:
      '展示用户各板块最近 7 / 30 天的近况卡片（达标率、平均分 / 时长 / 入睡时刻、每天走势、最常没通过的规则、期限）。' +
      '用户问「这周 / 最近怎么样」「哪个板块不行」「饮食分数走势」时调它；只看一个目标就传 goalId。' +
      '卡片会直接显示给用户，你的文字只点评重点和给一两条建议，不要逐个复述卡片上的数字。',
    inputSchema: z.object({
      days: z
        .union([z.literal(7), z.literal(30)])
        .default(7)
        .describe('统计最近多少天'),
      goalId: z.uuid().optional().describe('只看一个目标时传（来自 listGoals）'),
    }),
    execute: async ({ days, goalId }) => {
      try {
        const insights = await getInsights(db, userId, now, { days, ...(goalId ? { goalId } : {}) })
        return { kind: 'insights' as const, ...insights }
      } catch {
        return { error: '没找到这个目标，先用 listGoals 看看 goalId' }
      }
    },
  })

  const listFriendsTool = tool({
    description:
      '读取我的好友列表及每位好友今日打卡完成概况（昵称、连续天数、今日完成目标数/计划目标数、今日心情）。当用户提到好友或想和好友对比打卡情况时先调它。',
    inputSchema: z.object({}),
    execute: async () => await read.getFriendsOverview(userId, now),
  })

  const getFriendStatusTool = tool({
    description:
      '读取某位好友完整的今日打卡仪表盘（各目标进度、连续天数、本周热力图、体重、心情）以及近 N 天的打卡明细，用于和用户本人对比或回答好友打卡问题。',
    inputSchema: z.object({
      friendIdOrNickname: z.string().min(1).describe('好友的 userId（来自 listFriends）或好友昵称'),
      days: z.number().int().min(1).max(30).default(7).describe('读取最近多少天的打卡明细'),
    }),
    execute: async ({ friendIdOrNickname, days }) =>
      await read.getFriendStatusDetail(userId, friendIdOrNickname, now, days),
  })

  const searchTool = tool({
    description:
      '联网搜索，返回网页结果（标题、摘要、链接）。涉及食物热量、营养成分、运动 MET/消耗、睡眠建议等数值时必须先搜索，不要凭空编造。',
    inputSchema: z.object({
      query: z.string().min(1).max(128).describe('搜索词，可用 site: 等操作符'),
      count: z.number().int().min(1).max(10).default(5),
    }),
    execute: async ({ query, count }) => {
      if (search.used >= MAX_SEARCHES_PER_TURN) {
        return { error: `本轮联网搜索已达 ${MAX_SEARCHES_PER_TURN} 次上限，用已有信息回答` }
      }
      search.used += 1
      const result = await searchWeb(query, count)
      if (!result.ok) return { error: `搜索失败：${result.reason}` }
      search.costMicros += SEARCH_FETCH_COST_MICROS
      return { results: result.results }
    },
  })

  const fetchTool = tool({
    description: '读取一个网页，返回 Markdown 正文。搜索结果不够详细时用它读具体页面。',
    inputSchema: z.object({
      url: z.string().url().max(8192).describe('http/https 完整地址'),
    }),
    execute: async ({ url }) => {
      if (search.used >= MAX_SEARCHES_PER_TURN) {
        return { error: `本轮联网次数已达 ${MAX_SEARCHES_PER_TURN} 次上限` }
      }
      search.used += 1
      const result = await fetchWeb(url)
      if (!result.ok) return { error: `读网页失败：${result.reason}` }
      search.costMicros += SEARCH_FETCH_COST_MICROS
      return result.page
    },
  })

  // ---- 草稿工具（不写库，返回 AgentDraft） ----

  const draftTodo = tool({
    description: '把用户说的事整理成一条待办草稿（不写入）。DDL 不明确就问，不要瞎编时间。',
    inputSchema: z.object({
      title: z.string().min(1).max(60),
      dueAt: z.string().describe('ISO 时刻，没有就传 null').nullable(),
      priority: z.enum(['normal', 'important']).default('normal'),
    }),
    execute: async ({ title, dueAt, priority }): Promise<AgentDraft> => {
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
      return {
        kind: 'todo',
        title,
        dueAt: normalizedDueAt,
        priority,
        confirmBody: { title, dueAt: normalizedDueAt, priority },
      }
    },
  })

  const draftWeight = tool({
    description: '把用户说的体重整理成草稿（不写入）。',
    inputSchema: z.object({
      weightKg: z.number().min(20).max(300).describe('体重，千克'),
    }),
    execute: async ({ weightKg }): Promise<AgentDraft> => ({
      kind: 'weight',
      weightKg,
      confirmBody: { weightGrams: Math.round(weightKg * 1000), confirmLargeChange: true },
    }),
  })

  return {
    getUserProfile: readProfile,
    listGoals: listGoalsTool,
    getDaySummary: todaySummary,
    listTodos: listTodosTool,
    listCheckins: listCheckinsTool,
    getWeight: weightTool,
    showStats: showStatsTool,
    listFriends: listFriendsTool,
    getFriendStatus: getFriendStatusTool,
    webSearch: searchTool,
    webFetch: fetchTool,
    ...buildCheckinTools({ userId, now }),
    draftTodo,
    draftWeight,
  }
}
