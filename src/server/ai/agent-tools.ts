import 'server-only'
import { tool } from 'ai'
import { and, eq } from 'drizzle-orm'
import * as z from 'zod'
import type { AgentDraft } from '@/features/agent/schemas'
import { buildSchema } from '@/features/goal/build-schema'
import {
  addDays,
  BUSINESS_TIME_ZONE,
  DEFAULT_DAY_START_HOUR,
  formatDateTime,
  localDateOf,
  secondsBetween,
} from '@/lib/time'
import { db } from '@/server/db/client'
import { goals } from '@/server/db/schema'
import * as read from '@/server/services/agent/read'
import { loadFields } from '@/server/services/checkins/goal'
import { checkSleepTimes, type Clock } from '@/server/services/checkins/rules'
import { fetchWeb, searchWeb } from './web-search'

/*
 * Agent 工具集。每轮对话构建一次（闭包捕获 userId / now / 搜索预算）。
 * - 读工具：只查库，返回给模型看的精简 JSON。
 * - 草稿工具（draft*）：不写库，返回结构化草稿（AgentDraft），前端渲染成 AiDraftCard，
 *   用户确认后用 confirmBody 调普通创建接口。
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

async function loadGoal(userId: string, goalId: string) {
  const [row] = await db
    .select({
      id: goals.id,
      module: goals.module,
      title: goals.title,
      status: goals.status,
      fieldVersion: goals.fieldVersion,
    })
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.id, goalId)))
    .limit(1)
  return row ?? null
}

function draftItemId(i: number): string {
  return `draft-${Date.now().toString(36)}-${i}`
}

const INTENSITY_LABEL: Record<string, string> = { easy: '轻松', moderate: '中等', hard: '高强度' }
const MEAL_LABEL: Record<string, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
}

export function buildAgentTools(ctx: AgentToolContext) {
  const {
    userId,
    now,
    search,
    clock = { timeZone: BUSINESS_TIME_ZONE, dayStartHour: DEFAULT_DAY_START_HOUR },
  } = ctx

  const readProfile = tool({
    description:
      '读取用户的个人资料：昵称、性别、出生年份、身高、吉祥物。回答"我是谁/我的资料"时用。',
    inputSchema: z.object({}),
    execute: async () => ({ profile: await read.getProfile(userId) }),
  })

  const listGoalsTool = tool({
    description:
      '列出用户进行中的目标（含目标 id、板块、标题、目标量、每周几）。需要打卡或提到某个目标时先调它拿到 goalId。',
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
      '读取某段日期（含两端，格式 YYYY-MM-DD）内的打卡记录。不填默认最近 7 天。回答"这周/最近记录"时用。',
    inputSchema: z.object({
      from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    }),
    execute: async ({ from, to }) => ({
      checkins: await read.listCheckinsInRange(userId, now, { from, to }),
    }),
  })

  const weightTool = tool({
    description: '读取最近 30 天的体重记录和 7 天差值。',
    inputSchema: z.object({}),
    execute: async () => ({ weight: await read.getWeight(userId, now) }),
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

  const draftCheckin = tool({
    description:
      '把用户说的"做了什么"整理成一条打卡草稿（不写入，用户确认后才生效）。先调 listGoals 拿到 goalId。\
食物热量、运动消耗等数值必须已经联网搜索过。一次只能草拟一个目标的一条打卡。',
    inputSchema: z.object({
      goalId: z.string().describe('目标 id，来自 listGoals'),
      confidence: z.number().min(0).max(1).default(0.8).describe('把握度，不确定就调低到 0.6 以下'),
      isMakeup: z.boolean().default(false).describe('是否补昨天的打卡（只能补昨天，默认 false）'),
      note: z.string().max(200).optional(),
      data: z.discriminatedUnion('module', [
        z.object({
          module: z.literal('exercise'),
          category: z.string().min(1).max(10),
          intensity: z.enum(['easy', 'moderate', 'hard']),
          durationMinutes: z.number().int().min(1).max(600),
        }),
        z.object({
          module: z.literal('diet'),
          mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
          items: z
            .array(
              z.object({
                name: z.string().min(1).max(30),
                portion: z.string().max(30).default(''),
                kcal: z.number().int().min(0).max(5000).nullable(),
              }),
            )
            .min(1)
            .max(20),
        }),
        z.object({
          module: z.literal('sleep'),
          bedAt: z.string().describe('ISO 时刻，入睡'),
          wakeAt: z.string().describe('ISO 时刻，起床'),
          quality: z.number().int().min(1).max(5),
        }),
        z.object({
          module: z.literal('study'),
          what: z.string().min(1).max(60),
          durationMinutes: z.number().int().min(1).max(1440).optional(),
        }),
        z.object({
          module: z.literal('custom'),
          values: z
            .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]))
            .default({})
            .describe('自定义目标的字段键值（键为 listGoals 返回的 fields[].key）'),
        }),
      ]),
    }),
    execute: async ({ goalId, confidence, isMakeup, note, data }): Promise<AgentDraft> => {
      const goal = await loadGoal(userId, goalId)
      if (!goal) throw new Error('找不到这个目标，先调 listGoals 确认 goalId')
      if (goal.status !== 'active') throw new Error(`目标「${goal.title}」已归档，不能继续打卡`)
      if (goal.module !== data.module) {
        throw new Error(`目标「${goal.title}」是 ${goal.module} 板块，不能记成 ${data.module}`)
      }
      const base = {
        goalId,
        module: goal.module,
        title: goal.title,
        confidence,
        summary: '',
        fields: [],
        confirmBody: {},
      }

      if (data.module === 'exercise') {
        const durationSeconds = data.durationMinutes * 60
        return {
          kind: 'checkin',
          ...base,
          estimate: true,
          summary: `${data.category} ${data.durationMinutes} 分钟`,
          fields: [
            { label: '品类', value: data.category },
            { label: '时长', value: `${data.durationMinutes} 分钟` },
            { label: '强度', value: INTENSITY_LABEL[data.intensity] ?? data.intensity },
          ],
          confirmBody: {
            module: 'exercise',
            category: data.category,
            intensity: data.intensity,
            durationSeconds,
            note: note ?? null,
            isMakeup,
          },
        }
      }
      if (data.module === 'diet') {
        const items = data.items.map((it, i) => ({
          id: draftItemId(i),
          ...it,
          portion: it.portion ?? '',
        }))
        const total = items.reduce((s, it) => s + (it.kcal ?? 0), 0)
        return {
          kind: 'checkin',
          ...base,
          estimate: true,
          summary: `${MEAL_LABEL[data.mealType] ?? data.mealType}：${items.map((i) => i.name).join('、')}，约 ${total} 千卡`,
          fields: [{ label: '餐次', value: MEAL_LABEL[data.mealType] ?? data.mealType }],
          items,
          confirmBody: {
            module: 'diet',
            method: 'manual',
            mealType: data.mealType,
            items: items.map((it) => ({ name: it.name, portion: it.portion, kcal: it.kcal })),
            note: note ?? null,
            isMakeup,
          },
        }
      }
      if (data.module === 'sleep') {
        const bed = new Date(data.bedAt)
        const wake = new Date(data.wakeAt)
        if (Number.isNaN(bed.getTime()) || Number.isNaN(wake.getTime())) {
          throw new Error(
            'bedAt 和 wakeAt 必须是合法的 ISO 8601 时间（如 2026-11-01T15:30:00.000Z）',
          )
        }
        const secs = secondsBetween(bed, wake)
        if (secs < 1800 || secs > 72_000) {
          throw new Error('睡眠时长必须在 30 分钟到 20 小时之间，请核对入睡和起床时刻')
        }
        const today = localDateOf(now, clock.timeZone, clock.dayStartHour)
        const yesterday = addDays(today, -1)
        const wakeDay = localDateOf(wake, clock.timeZone, clock.dayStartHour)
        const sleepMakeup = wakeDay === yesterday ? true : isMakeup
        const check = checkSleepTimes(bed, wake, now, clock, sleepMakeup)
        if (!check.ok) {
          throw new Error(
            `睡眠时间校验未通过：${check.reason}（当前 UTC ${now.toISOString()}，今日打卡日 ${today}）`,
          )
        }
        const hours = Math.max(0, secs / 3600)
        return {
          kind: 'checkin',
          ...base,
          estimate: true,
          summary: `睡眠约 ${hours.toFixed(1)} 小时`,
          fields: [
            { label: '入睡', value: formatDateTime(bed, clock.timeZone) },
            { label: '起床', value: formatDateTime(wake, clock.timeZone) },
            { label: '质量', value: `${data.quality}/5` },
          ],
          confirmBody: {
            module: 'sleep',
            bedAt: bed.toISOString(),
            wakeAt: wake.toISOString(),
            quality: data.quality,
            note: note ?? null,
            isMakeup: sleepMakeup,
          },
        }
      }
      if (data.module === 'custom') {
        if (goal.fieldVersion === null) {
          throw new Error(`自定义目标「${goal.title}」缺少字段定义`)
        }
        const fieldDefs = await loadFields(db, goal.id, goal.fieldVersion)
        if (!fieldDefs) throw new Error(`找不到自定义目标「${goal.title}」的字段版本`)
        const parsed = buildSchema(fieldDefs).safeParse(data.values)
        if (!parsed.success) {
          throw new Error(`自定义字段校验未通过：${z.prettifyError(parsed.error)}`)
        }
        const values = Object.fromEntries(
          Object.entries(parsed.data).filter(
            (e): e is [string, NonNullable<(typeof e)[1]>] => e[1] !== undefined,
          ),
        )
        const displayFields = fieldDefs
          .filter((f) => values[f.key] !== undefined)
          .map((f) => {
            const raw = values[f.key]
            const valStr = Array.isArray(raw)
              ? raw.join('、')
              : typeof raw === 'boolean'
                ? raw
                  ? '是'
                  : '否'
                : `${String(raw)}${f.type === 'number' && f.unit ? ` ${f.unit}` : ''}`
            return { label: f.label, value: valStr }
          })
        return {
          kind: 'checkin',
          ...base,
          estimate: false,
          summary:
            displayFields.length > 0
              ? displayFields.map((f) => `${f.label}：${f.value}`).join(' · ')
              : `完成「${goal.title}」`,
          fields: displayFields,
          confirmBody: {
            module: 'custom',
            fieldVersion: goal.fieldVersion,
            values,
            note: note ?? null,
            isMakeup,
          },
        }
      }
      // study
      const durationSeconds = data.durationMinutes ? data.durationMinutes * 60 : undefined
      return {
        kind: 'checkin',
        ...base,
        estimate: false,
        summary: data.what,
        fields: [
          { label: '内容', value: data.what },
          ...(data.durationMinutes
            ? [{ label: '时长', value: `${data.durationMinutes} 分钟` }]
            : []),
        ],
        confirmBody: {
          module: 'study',
          what: data.what,
          ...(durationSeconds !== undefined ? { durationSeconds } : {}),
          note: note ?? null,
          isMakeup,
        },
      }
    },
  })

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
    listFriends: listFriendsTool,
    getFriendStatus: getFriendStatusTool,
    webSearch: searchTool,
    webFetch: fetchTool,
    draftCheckin,
    draftTodo,
    draftWeight,
  }
}
