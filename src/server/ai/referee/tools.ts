import 'server-only'
import { tool, type ToolSet } from 'ai'
import * as z from 'zod'
import { judge, type JudgeInput } from '@/features/referee/rules'
import { estimateKcal } from '@/features/referee/rules/exercise'
import {
  CitationSchema,
  CustomFactsSchema,
  DietFactsSchema,
  ExerciseFactsSchema,
  SleepFactsSchema,
  StudyFactsSchema,
  type Verdict,
} from '@/features/referee/schemas'
import type { LocalDate, Module } from '@/features/shared/schemas'
import type { DbOrTx } from '@/server/db/client'
import { recentGoalCheckins, recentSleep, todayStudyMinutes } from '@/server/services/referee/read'
import { SEARCH_FETCH_COST_MICROS, type SearchBudget } from '../agent-tools'
import { fetchWeb, searchWeb } from '../web-search'
import { lookupFoods, lookupMets } from '../checkin-lookups'

/*
 * 裁判 Agent 的工具（checkin-modules.md 第 4 节）。每次裁判构建一次，闭包捕获用户、目标与搜索预算。
 * 只有 submitVerdict 产出结论：它的入参是该板块的事实，执行时调用前后端共用的 judge()。
 */

/** 一次裁判最多联网几次（搜索 + 读网页合计） */
export const MAX_REFEREE_SEARCHES = 3

export interface RefereeToolContext {
  db: DbOrTx
  userId: string
  goalId: string
  module: Module
  today: LocalDate
  timeZone: string
  weightKg: number | null
  search: SearchBudget
  /** judge() 的输入（不含事实与附加信息） */
  judgeBase: Omit<JudgeInput, 'facts' | 'extras'>
  aiRunId: string
  /** submitVerdict 执行后回调，服务端据此确认 Agent 交了结论 */
  onVerdict: (verdict: Verdict) => void
}

const FACTS_SCHEMA = {
  diet: DietFactsSchema,
  exercise: ExerciseFactsSchema,
  sleep: SleepFactsSchema,
  study: StudyFactsSchema,
  custom: CustomFactsSchema,
} as const

function webTools(search: SearchBudget): ToolSet {
  return {
    webSearch: tool({
      description:
        '联网搜索权威资料（食物成分、GI 值、运动 MET、学习主题的基本概念）。只在内置工具查不到时用，结果里的数字要标出处。',
      inputSchema: z.object({
        query: z.string().min(1).max(128),
        count: z.number().int().min(1).max(5).default(3),
      }),
      execute: async ({ query, count }) => {
        if (search.used >= MAX_REFEREE_SEARCHES) {
          return { error: `本次裁判联网已达 ${MAX_REFEREE_SEARCHES} 次上限，用已有信息估算` }
        }
        search.used += 1
        const result = await searchWeb(query, count)
        if (!result.ok) return { error: `搜索失败：${result.reason}` }
        search.costMicros += SEARCH_FETCH_COST_MICROS
        return { results: result.results }
      },
    }),
    webFetch: tool({
      description: '读取一个搜索结果的网页正文（Markdown），搜索摘要不够时再用。',
      inputSchema: z.object({ url: z.string().url().max(2048) }),
      execute: async ({ url }) => {
        if (search.used >= MAX_REFEREE_SEARCHES) {
          return { error: `本次裁判联网已达 ${MAX_REFEREE_SEARCHES} 次上限` }
        }
        search.used += 1
        const result = await fetchWeb(url)
        if (!result.ok) return { error: `读网页失败：${result.reason}` }
        search.costMicros += SEARCH_FETCH_COST_MICROS
        return { title: result.page.title, content: result.page.content.slice(0, 4000) }
      },
    }),
  }
}

function moduleTools(ctx: RefereeToolContext): ToolSet {
  switch (ctx.module) {
    case 'diet':
      return {
        lookupFoodNutrition: tool({
          description:
            '查内置的常见食物营养表（每 100 克 / 100 毫升的热量、蛋白、碳水、脂肪、纤维、钠、GI，以及一份的常见克数）。先用它，查不到的再联网。',
          inputSchema: z.object({ names: z.array(z.string().min(1).max(30)).min(1).max(20) }),
          execute: async ({ names }) => lookupFoods(names),
        }),
        ...webTools(ctx.search),
      }
    case 'exercise':
      return {
        lookupMet: tool({
          description: '按运动名称查代谢当量（MET，Compendium of Physical Activities 取整）。',
          inputSchema: z.object({
            activities: z
              .array(
                z.object({ name: z.string().min(1).max(20), calc: z.enum(['distance', 'count']) }),
              )
              .min(1)
              .max(10),
          }),
          execute: async ({ activities }) => lookupMets(activities),
        }),
        calcExerciseKcal: tool({
          description: '按 MET × 体重 × 小时估算消耗；体重取用户最近一次记录，没有则按 60kg。',
          inputSchema: z.object({
            met: z.number().min(1).max(20),
            minutes: z.number().min(0).max(600),
          }),
          execute: async ({ met, minutes }) => ({
            kcal: estimateKcal(met, minutes, ctx.weightKg),
            weightKg: ctx.weightKg ?? 60,
            assumedWeight: ctx.weightKg === null,
          }),
        }),
      }
    case 'sleep':
      return {
        getRecentSleep: tool({
          description:
            '读这个睡眠目标最近 7 晚的入睡时刻与时长，并给出入睡时刻的平均偏差（分钟）。',
          inputSchema: z.object({}),
          execute: async () => recentSleep(ctx.db, ctx.userId, ctx.goalId, ctx.today, ctx.timeZone),
        }),
      }
    case 'study':
      return {
        getTodayStudy: tool({
          description: '读今天这个学习目标之前已经记过的分钟数（碎片学习累加）。',
          inputSchema: z.object({}),
          execute: async () => ({
            todayMinutesBefore: await todayStudyMinutes(ctx.db, ctx.userId, ctx.goalId, ctx.today),
          }),
        }),
        ...webTools(ctx.search),
      }
    case 'custom':
      return {
        listCheckins: tool({
          description:
            '读这个自定义目标最近 7 条记录（日期、是否达标、填了什么），用来对照判卷标准。',
          inputSchema: z.object({}),
          execute: async () => ({
            checkins: await recentGoalCheckins(ctx.db, ctx.userId, ctx.goalId),
          }),
        }),
      }
  }
}

export function buildRefereeTools(ctx: RefereeToolContext): ToolSet {
  const factsSchema = FACTS_SCHEMA[ctx.module]
  const submitVerdict = tool({
    description:
      '最后一步：提交你核实过的事实，系统按用户的达标规则算出结论。必须调用且只调用一次，调用后不要再输出别的内容。',
    inputSchema: z.object({
      facts: factsSchema,
      citations: z.array(CitationSchema).max(5).default([]),
      advice: z.array(z.string().trim().min(1).max(80)).max(2).default([]),
    }),
    execute: async ({ facts, citations, advice }) => {
      const verdict = judge({
        ...ctx.judgeBase,
        facts,
        extras: { refereeRunId: ctx.aiRunId, citations, advice },
      } as JudgeInput)
      ctx.onVerdict(verdict)
      return { verdict }
    },
  })
  return { ...moduleTools(ctx), submitVerdict }
}
