import 'server-only'
import { tool } from 'ai'
import * as z from 'zod'
import {
  CheckinEntrySchema,
  EntryRefereeSchema,
  entryToCreateInput,
  factsMismatch,
} from '@/features/agent/checkin-entry'
import {
  draftFieldsOf,
  draftItemsOf,
  snapshotOf,
  verdictPreview,
} from '@/features/agent/draft-view'
import type { AgentDraft } from '@/features/agent/schemas'
import { mealLabel } from '@/features/checkin/format'
import { ChangeReasonSchema, NOTE_MAX } from '@/features/checkin/schemas'
import { estimateKcal } from '@/features/referee/rules/exercise'
import { IdSchema } from '@/features/shared/schemas'
import { addDays, localDateOf } from '@/lib/time'
import { isApiError } from '@/server/api/errors'
import { db } from '@/server/db/client'
import * as read from '@/server/services/agent/read'
import { loadClock } from '@/server/services/checkins/clock'
import { loadGoal } from '@/server/services/checkins/goal'
import { previewCreate, previewDelete, previewUpdate } from '@/server/services/checkins/preview'
import { latestWeightGrams } from '@/server/services/metrics/weight'
import { recentSleep, todayStudyMinutes } from '@/server/services/referee/read'
import { lookupFoods, lookupMets } from './checkin-lookups'

/*
 * Agent 对话的打卡工具（checkin-modules.md 第 8 节）：和打卡页的 Agent 裁判用同一套事实格式、
 * 内置查询和规则函数，所以对话里记的打卡与打卡页记的分数一致。
 * - 写操作（新增 / 修改 / 删除）都只出草稿，用户在草稿卡上确认后才调普通接口入库。
 * - 修改、删除只能针对今天和昨天的打卡；工具在这里拦一层，接口在 origin = agent 时再拦一层。
 */

export interface CheckinToolContext {
  userId: string
  now: Date
}

const noteSchema = z.string().trim().max(NOTE_MAX).nullable().optional()

/** 业务错误转成给模型看的一句话（带字段级原因），让它改了再试 */
function asToolError(e: unknown): Error {
  if (isApiError(e)) {
    const fields = e.extras.fields
      ? Object.entries(e.extras.fields)
          .map(([k, v]) => `${k}: ${v.join('；')}`)
          .join('\n')
      : ''
    return new Error(fields ? `${e.message}\n${fields}` : e.message)
  }
  return e instanceof Error ? e : new Error(String(e))
}

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    throw asToolError(e)
  }
}

export function buildCheckinTools(ctx: CheckinToolContext) {
  const { userId, now } = ctx

  const lookupFoodNutrition = tool({
    description:
      '查内置的常见食物营养表（每 100 克 / 100 毫升的热量、蛋白、碳水、脂肪、纤维、钠、GI，以及一份的常见克数）。记饮食前先用它算每道菜的事实，查不到的再 webSearch。',
    inputSchema: z.object({ names: z.array(z.string().min(1).max(30)).min(1).max(20) }),
    execute: async ({ names }) => lookupFoods(names),
  })

  const lookupMet = tool({
    description: '按运动名称查代谢当量（MET）。记运动前用它。',
    inputSchema: z.object({
      activities: z
        .array(z.object({ name: z.string().min(1).max(20), calc: z.enum(['distance', 'count']) }))
        .min(1)
        .max(10),
    }),
    execute: async ({ activities }) => lookupMets(activities),
  })

  const calcExerciseKcal = tool({
    description: '按 MET × 体重 × 小时估算消耗；体重取用户最近一次记录，没有则按 60kg。',
    inputSchema: z.object({ met: z.number().min(1).max(20), minutes: z.number().min(0).max(600) }),
    execute: async ({ met, minutes }) => {
      const grams = await latestWeightGrams(db, userId)
      const kg = grams !== null && grams > 0 ? grams / 1000 : null
      return {
        kcal: estimateKcal(met, minutes, kg),
        weightKg: kg ?? 60,
        assumedWeight: kg === null,
      }
    },
  })

  const getRecentSleep = tool({
    description:
      '读某个睡眠目标最近 7 晚的入睡时刻与时长，以及入睡时刻的平均偏差（规律度，分钟）。',
    inputSchema: z.object({ goalId: IdSchema.describe('睡眠目标 id，来自 listGoals') }),
    execute: async ({ goalId }) =>
      guard(async () => {
        const goal = await loadGoal(db, userId, goalId)
        if (goal.module !== 'sleep') throw new Error('这不是睡眠目标')
        const clock = await loadClock(db, userId)
        const today = localDateOf(now, clock.timeZone, clock.dayStartHour)
        return recentSleep(db, userId, goalId, today, clock.timeZone)
      }),
  })

  const getTodayStudy = tool({
    description: '读某个学习目标今天（或补卡时的昨天）之前已经记过的分钟数（碎片学习累加）。',
    inputSchema: z.object({
      goalId: IdSchema.describe('学习目标 id，来自 listGoals'),
      yesterday: z.boolean().default(false),
    }),
    execute: async ({ goalId, yesterday }) =>
      guard(async () => {
        const goal = await loadGoal(db, userId, goalId)
        if (goal.module !== 'study') throw new Error('这不是学习目标')
        const clock = await loadClock(db, userId)
        const today = localDateOf(now, clock.timeZone, clock.dayStartHour)
        const day = yesterday ? addDays(today, -1) : today
        return { localDate: day, minutesBefore: await todayStudyMinutes(db, userId, goalId, day) }
      }),
  })

  const getCheckin = tool({
    description:
      '读一条自己的打卡的完整内容（checkinId 来自 listCheckins）。返回的 entry 就是 draftUpdateCheckin 要的形状：改其中几项后整份交回。editable=false 表示已经超出可改范围。',
    inputSchema: z.object({ checkinId: IdSchema }),
    execute: async ({ checkinId }) => guard(() => read.getCheckinDetail(userId, checkinId, now)),
  })

  const getCheckinHistory = tool({
    description:
      '查打卡的留痕：给 checkinId 看这一条从新增到修改、删除的全部历史（删掉的也查得到）；不给就看最近 20 次改动。',
    inputSchema: z.object({ checkinId: IdSchema.optional() }),
    execute: async ({ checkinId }) => guard(() => read.getCheckinHistory(userId, checkinId)),
  })

  const draftCheckin = tool({
    description:
      '把用户说的或照片里看到的「做了什么」整理成一条打卡草稿（不写入，用户确认后才生效），草稿会附上按用户达标规则算出的结论。\
先调 listGoals 拿 goalId；按本板块的说明查好事实填进 facts（查不到就不填 facts，按规则离线判定）。一次只草拟一个目标的一条打卡。',
    inputSchema: z.object({
      goalId: IdSchema.describe('目标 id，来自 listGoals'),
      entry: CheckinEntrySchema,
      ...EntryRefereeSchema.shape,
      note: noteSchema,
      isMakeup: z.boolean().default(false).describe('补昨天的打卡（只能补昨天）'),
      confidence: z.number().min(0).max(1).default(0.8).describe('把握度，不确定就调低到 0.6 以下'),
    }),
    execute: async ({ goalId, entry, facts, citations, advice, note, isMakeup, confidence }) =>
      guard(async (): Promise<AgentDraft> => {
        const mismatch = factsMismatch(entry, { facts })
        if (mismatch) throw new Error(`事实和内容对不上：${mismatch}`)
        const goal = await loadGoal(db, userId, goalId)
        const clock = await loadClock(db, userId)
        let makeup = isMakeup
        if (entry.module === 'sleep') {
          // 起床落在昨天的打卡日，就是补昨天的睡眠
          const wake = new Date(entry.wakeAt)
          const today = localDateOf(now, clock.timeZone, clock.dayStartHour)
          if (
            !Number.isNaN(wake.getTime()) &&
            localDateOf(wake, clock.timeZone, clock.dayStartHour) === addDays(today, -1)
          ) {
            makeup = true
          }
        }
        const raw = entryToCreateInput(
          entry,
          { fieldVersion: goal.fieldVersion, note: note ?? null, isMakeup: makeup },
          { facts, citations, advice },
        )
        const p = await previewCreate(db, userId, goalId, raw, now)
        return {
          kind: 'checkin',
          goalId,
          module: p.goal.module,
          // 饮食草稿的条目里看不出餐次，标题带上，用户确认前能核对
          title:
            p.checkin.payload.module === 'diet'
              ? `${p.goal.title} · ${mealLabel[p.checkin.payload.mealType]}`
              : p.goal.title,
          summary: snapshotOf(p.checkin, p.fields).summary,
          confidence,
          estimate:
            p.goal.module === 'diet' || p.goal.module === 'exercise' || p.goal.module === 'sleep',
          fields: draftFieldsOf(p.checkin, clock.timeZone, p.fields),
          items: draftItemsOf(p.checkin),
          localDate: p.checkin.localDate,
          verdict: verdictPreview(p.verdict),
          confirmBody: raw as Record<string, unknown>,
        }
      }),
  })

  const draftUpdateCheckin = tool({
    description:
      '把一条今天或昨天的打卡改成新内容（不写入，用户确认后才生效）。先 getCheckin 拿到 entry，改好后整份交回；只改备注时可以不传 entry。\
内容变了要重新查事实填 facts。打卡日和板块不能改：记错了日子就删掉重记。reason 写用户为什么要改。',
    inputSchema: z.object({
      checkinId: IdSchema,
      entry: CheckinEntrySchema.optional(),
      ...EntryRefereeSchema.shape,
      note: noteSchema,
      reason: ChangeReasonSchema,
    }),
    execute: async ({ checkinId, entry, facts, citations, advice, note, reason }) =>
      guard(async (): Promise<AgentDraft> => {
        if (entry === undefined && note === undefined) {
          throw new Error('没有要改的内容：传 entry 或 note')
        }
        if (entry) {
          const mismatch = factsMismatch(entry, { facts })
          if (mismatch) throw new Error(`事实和内容对不上：${mismatch}`)
        }
        const detail = await read.getCheckinDetail(userId, checkinId, now)
        if (!detail.found) throw new Error(detail.error)
        const goal = await loadGoal(db, userId, detail.goalId)
        const replace = entry
          ? entryToCreateInput(
              entry,
              { fieldVersion: goal.fieldVersion },
              { facts, citations, advice },
            )
          : undefined
        const p = await previewUpdate(db, userId, checkinId, { replace, note }, now)
        const clock = await loadClock(db, userId)
        const confirmBody = {
          ...(replace ? { replace } : {}),
          ...(note !== undefined ? { note } : {}),
          origin: 'agent',
          reason,
        }
        return {
          kind: 'checkin-update',
          checkinId,
          goalId: p.goal.id,
          module: p.goal.module,
          title: p.goal.title,
          localDate: p.current.localDate,
          reason,
          before: snapshotOf(p.current, p.fields),
          after: snapshotOf(p.next, p.fields),
          ...(p.verdict ? { verdict: verdictPreview(p.verdict) } : {}),
          fields: draftFieldsOf(p.next, clock.timeZone, p.fields, { dietItems: true, note: false }),
          confirmBody,
        } as AgentDraft
      }),
  })

  const draftDeleteCheckin = tool({
    description:
      '删一条今天或昨天的打卡（不写入，用户确认后才删）。删掉后进度、连续天数重新计算，留痕保留。reason 写用户为什么要删。',
    inputSchema: z.object({ checkinId: IdSchema, reason: ChangeReasonSchema }),
    execute: async ({ checkinId, reason }) =>
      guard(async (): Promise<AgentDraft> => {
        const p = await previewDelete(db, userId, checkinId, now)
        return {
          kind: 'checkin-delete',
          checkinId,
          goalId: p.goal.id,
          module: p.goal.module,
          title: p.goal.title,
          localDate: p.current.localDate,
          reason,
          before: snapshotOf(p.current, p.fields),
        }
      }),
  })

  return {
    lookupFoodNutrition,
    lookupMet,
    calcExerciseKcal,
    getRecentSleep,
    getTodayStudy,
    getCheckin,
    getCheckinHistory,
    draftCheckin,
    draftUpdateCheckin,
    draftDeleteCheckin,
  }
}
