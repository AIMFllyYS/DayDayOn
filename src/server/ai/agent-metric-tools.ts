import 'server-only'
import { tool } from 'ai'
import * as z from 'zod'
import type { MetricDeleteDraft, MetricUpsertDraft } from '@/features/agent/schemas'
import { MetricKindSchema, STEPS_MAX, STEPS_MIN, type MetricKind } from '@/features/metric/schemas'
import { addDays, BUSINESS_TIME_ZONE, localDateOf } from '@/lib/time'
import * as read from '@/server/services/agent/read'
import { loadClock } from '@/server/services/checkins/clock'
import type { Clock } from '@/server/services/checkins/rules'
import { db } from '@/server/db/client'

/*
 * 每日指标（体重 / 心情 / 步数）的 Agent 工具集：
 * - getMetrics：读今天/昨天现状、近期走势摘要与用户的步数参考虚线（dailyStepTarget）。
 * - draftMetric：新增或覆盖修改今天/昨天的体重、心情或步数（先查库比对，产出 MetricUpsertDraft）。
 * - draftDeleteMetric：删除今天/昨天的体重、心情或步数（先核对记录存在，产出 MetricDeleteDraft）。
 * 所有写操作均走草稿确认再调普通 /api/v1 接口，绝不直接写库（AGENTS.md 硬规则）。
 */

const MOOD_TEXT: Record<number, string> = {
  1: '1 分 · 很糟',
  2: '2 分 · 不太好',
  3: '3 分 · 一般',
  4: '4 分 · 不错',
  5: '5 分 · 超棒',
}

const METRIC_NAME: Record<MetricKind, string> = {
  weight: '体重',
  mood: '心情',
  steps: '步数',
}

export function formatMetricValue(metric: MetricKind, rawValue: number): string {
  if (metric === 'weight') return `${(rawValue / 1000).toFixed(1)} kg`
  if (metric === 'mood') return MOOD_TEXT[rawValue] ?? `${rawValue} 分`
  return `${rawValue.toLocaleString('en-US')} 步`
}

const DEFAULT_CLOCK: Clock = { timeZone: BUSINESS_TIME_ZONE, dayStartHour: 4 }

async function resolveClock(userId: string, provided?: Clock): Promise<Clock> {
  if (provided) return provided
  try {
    return await loadClock(db, userId)
  } catch {
    return DEFAULT_CLOCK
  }
}

export interface MetricToolContext {
  userId: string
  now: Date
  clock?: Clock
}

export function buildMetricTools({ userId, now, clock }: MetricToolContext) {
  const getMetrics = tool({
    description:
      '读取每日指标（体重 weight、心情 mood、步数 steps）的今日/昨日现状、近期走势摘要与用户的步数参考虚线（dailyStepTarget）。' +
      '回答体重/心情/步数走势，或在帮用户记录、修改、删除今日或昨日指标前先调它核对现状。',
    inputSchema: z.object({
      kind: z
        .enum(['all', 'weight', 'mood', 'steps'])
        .default('all')
        .describe('要查的指标：all（全部三项）、weight、mood 或 steps'),
      days: z
        .number()
        .int()
        .min(1)
        .max(365)
        .default(30)
        .describe('统计最近多少天，默认 30，最长 365'),
    }),
    execute: async ({ kind, days }) => read.getMetricsOverview(userId, now, kind, days),
  })

  const draftMetric = tool({
    description:
      '为今天或昨天的每日指标（体重 weight / 心情 mood / 步数 steps）生成新建或覆盖修改草稿（不直接写库）。' +
      '自动检查该日是否已有记录：已有则生成带改前→改后对比的覆盖修改草稿，没有则生成新建草稿。仅支持今天或昨天。',
    inputSchema: z.object({
      metric: MetricKindSchema.describe('指标类型：weight 体重 / mood 心情 / steps 步数'),
      targetDay: z
        .enum(['today', 'yesterday'])
        .default('today')
        .describe('记到今天（today）还是补/改昨天（yesterday）'),
      weightKg: z
        .number()
        .min(20)
        .max(300)
        .optional()
        .describe('体重，单位千克（20–300），metric=weight 时必填'),
      moodValue: z
        .number()
        .int()
        .min(1)
        .max(5)
        .optional()
        .describe('心情评分 1–5（1 很糟、2 不太好、3 一般、4 不错、5 超棒），metric=mood 时必填'),
      steps: z
        .number()
        .int()
        .min(STEPS_MIN)
        .max(STEPS_MAX)
        .optional()
        .describe('每日步数整数（0–200000），metric=steps 时必填'),
      reason: z.string().trim().max(80).optional().describe('修改或补记原因（可选，简短一句话）'),
    }),
    execute: async ({
      metric,
      targetDay,
      weightKg,
      moodValue,
      steps,
      reason,
    }): Promise<MetricUpsertDraft | { error: string }> => {
      const resolvedClock = await resolveClock(userId, clock)
      const today = localDateOf(now, resolvedClock.timeZone, resolvedClock.dayStartHour)
      const localDate = targetDay === 'yesterday' ? addDays(today, -1) : today

      let nextRawValue: number
      let confirmBody: Record<string, unknown>

      if (metric === 'weight') {
        if (weightKg === undefined || !Number.isFinite(weightKg)) {
          return { error: '记录体重需要传入 weightKg（20–300 千克）' }
        }
        const weightGrams = Math.round(weightKg * 1000)
        nextRawValue = weightGrams
        confirmBody = { weightGrams, confirmLargeChange: true, localDate }
      } else if (metric === 'mood') {
        if (moodValue === undefined || !Number.isInteger(moodValue)) {
          return { error: '记录心情需要传入 moodValue（1–5 整数）' }
        }
        nextRawValue = moodValue
        confirmBody = { scope: 'overall', value: moodValue, localDate }
      } else {
        if (steps === undefined || !Number.isInteger(steps)) {
          return { error: '记录步数需要传入 steps（0–200000 整数）' }
        }
        nextRawValue = steps
        confirmBody = { steps, localDate }
      }

      const existing = await read.getMetricValueOnDate(userId, metric, localDate)
      return {
        kind: 'metric-upsert',
        metric,
        action: existing !== null ? 'update' : 'create',
        targetDay,
        localDate,
        beforeLabel: existing !== null ? formatMetricValue(metric, existing) : null,
        afterLabel: formatMetricValue(metric, nextRawValue),
        ...(reason ? { reason } : {}),
        confirmBody,
      }
    },
  })

  const draftDeleteMetric = tool({
    description:
      '为今天或昨天的每日指标（体重 / 心情 / 步数）生成删除草稿（不直接删库）。' +
      '会先核对该日是否确实存在记录；更早的历史记录请引导用户去对应指标详情页手动删除。',
    inputSchema: z.object({
      metric: MetricKindSchema.describe('指标类型：weight 体重 / mood 心情 / steps 步数'),
      targetDay: z
        .enum(['today', 'yesterday'])
        .describe('删除哪一天的记录（仅支持 today 或 yesterday）'),
      reason: z.string().trim().min(1).max(80).describe('一句话写清删除原因'),
    }),
    execute: async ({
      metric,
      targetDay,
      reason,
    }): Promise<MetricDeleteDraft | { error: string }> => {
      const resolvedClock = await resolveClock(userId, clock)
      const today = localDateOf(now, resolvedClock.timeZone, resolvedClock.dayStartHour)
      const localDate = targetDay === 'yesterday' ? addDays(today, -1) : today
      const existing = await read.getMetricValueOnDate(userId, metric, localDate)
      if (existing === null) {
        const dayText = targetDay === 'yesterday' ? '昨天' : '今天'
        return { error: `${dayText}（${localDate}）还没有${METRIC_NAME[metric]}记录，无需删除` }
      }
      return {
        kind: 'metric-delete',
        metric,
        targetDay,
        localDate,
        beforeLabel: formatMetricValue(metric, existing),
        reason,
      }
    },
  })

  return {
    getMetrics,
    draftMetric,
    draftDeleteMetric,
  }
}
