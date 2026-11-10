import 'server-only'
import { and, eq } from 'drizzle-orm'
import * as z from 'zod'
import type {
  CheckinPayload,
  CreateCheckin,
  CreateCheckinResult,
  GoalProgress,
} from '@/features/checkin/schemas'
import { buildSchema } from '@/features/goal/build-schema'
import { effectiveRules } from '@/features/referee/defaults'
import { judge } from '@/features/referee/rules'
import type { PriorDietMeal } from '@/features/referee/rules/common'
import {
  isFastingSubject,
  isFastingText,
  isJunkName,
  judgeDiet,
} from '@/features/referee/rules/diet'
import { detectCalc, estimateKcal, metOf } from '@/features/referee/rules/exercise'
import type { DietDishFact, Facts, Verdict } from '@/features/referee/schemas'
import { judgeInputOf } from '@/features/referee/subject'
import type { LocalDate } from '@/features/shared/schemas'
import { localDateOf, secondsBetween } from '@/lib/time'
import { findFood } from '@/server/ai/referee/food-table'
import { ApiError } from '@/server/api/errors'
import type { db as Database, DbOrTx } from '@/server/db/client'
import { aiRuns, checkins } from '@/server/db/schema'
import { loadRefereeTier } from '@/server/services/referee/context'
import { todayDietMeals } from '@/server/services/referee/read'
import { goalDayProgress } from '@/server/services/stats'
import { latestWeightGrams } from '../metrics/weight'
import { loadClock } from './clock'
import { recordRevision } from './revisions'
import {
  checkinColumns,
  loadFields,
  loadGoal,
  loadTargetHistory,
  targetFor,
  toCheckinDto,
  type CheckinRow,
  type GoalRow,
} from './goal'
import {
  checkSleepTimes,
  estimateBurnKcal,
  intakeKcalOf,
  isUniqueViolation,
  serverOccurredAt,
  toStatCheckin,
  type Clock,
} from './rules'

/** 一次打卡要写入的列（除 userId / goalId 外） */
interface Draft {
  module: CheckinPayload['module']
  occurredAt: Date
  durationSeconds: number | null
  intakeKcal: number | null
  burnKcal: number | null
  payload: CheckinPayload
  fieldVersion: number | null
  source: 'manual' | 'ai'
  aiRunId: string | null
  parsedText: string | null
}

function invalid(field: string, message: string): ApiError {
  return new ApiError('VALIDATION_FAILED', message, { fields: { [field]: [message] } })
}

/**
 * 运动消耗：有多项明细时按每项 MET 估算（手表给了就用手表的）；没有体重记录、也没有手表数据时不估算。
 * 没有明细的老请求走原来的「品类 × 强度」MET 表。
 */
function exerciseBurnKcal(
  input: Extract<CreateCheckin, { module: 'exercise' }>,
  weightGrams: number | null,
): number | null {
  if (!input.items || input.items.length === 0) {
    return estimateBurnKcal(input.category, input.intensity, input.durationSeconds, weightGrams)
  }
  const kg = weightGrams !== null && weightGrams > 0 ? weightGrams / 1000 : null
  let total = 0
  let known = false
  for (const it of input.items) {
    if (it.kcal !== null) {
      total += it.kcal
      known = true
    } else if (kg !== null) {
      total += estimateKcal(metOf(it.name, it.calc).met, it.minutes, kg)
      known = true
    }
  }
  return known ? total : null
}

function buildFallbackDietFacts(
  items: Extract<CreateCheckin, { module: 'diet' }>['items'],
): Extract<Facts, { module: 'diet' }> {
  const dishes: DietDishFact[] = items.map((it) => {
    const row = findFood(it.name)
    if (row) {
      const ratio = row.servingG / 100
      return {
        name: it.name,
        portion: it.portion || `约 ${row.servingG}g`,
        kcal: it.kcal ?? Math.round(row.kcal * ratio),
        proteinG: Math.round(row.protein * ratio * 10) / 10,
        carbG: Math.round(row.carb * ratio * 10) / 10,
        fatG: Math.round(row.fat * ratio * 10) / 10,
        fiberG: Math.round(row.fiber * ratio * 10) / 10,
        sodiumMg: Math.round(row.sodium * ratio),
        gi: row.gi,
        junk: Boolean(row.junk || isJunkName(it.name)),
        sweet: Boolean(row.sweet),
        isFasting: isFastingText(it.name),
        carbQuality:
          row.gi >= 70
            ? ('refined' as const)
            : row.fiber >= 2
              ? ('complex' as const)
              : ('none' as const),
        fatQuality: 'normal' as const,
        cooking: 'other' as const,
        source: 'table' as const,
      }
    }
    const kcal = it.kcal ?? 180
    const junk = isJunkName(it.name)
    return {
      name: it.name,
      portion: it.portion || '1 份',
      kcal,
      proteinG: junk ? 8 : 10,
      carbG: junk ? 25 : 18,
      fatG: junk ? 15 : 7,
      fiberG: junk ? 0.5 : 2,
      sodiumMg: junk ? 600 : 350,
      gi: junk ? 75 : 55,
      junk,
      sweet: false,
      isFasting: isFastingText(it.name),
      carbQuality: 'none' as const,
      fatQuality: 'normal' as const,
      cooking: 'other' as const,
      source: 'estimate' as const,
    }
  })
  return { module: 'diet', dishes }
}

export interface JudgeCheckinOptions {
  priorMinutesToday?: number
  localDate?: LocalDate
  priorDietMeals?: readonly PriorDietMeal[]
}

/**
 * 裁判结论（checkin-modules.md 第 3.4 节）：用目标规则、个人体质和请求带来的事实重算，
 * 前端算好的结论一律不用。refereeRunId 必须是自己的裁判记录。
 */
export async function judgeCheckin(
  db: DbOrTx,
  userId: string,
  goal: GoalRow,
  input: CreateCheckin,
  clock: Clock,
  options?: JudgeCheckinOptions,
): Promise<Verdict> {
  if (input.refereeRunId !== undefined) {
    const [run] = await db
      .select({ id: aiRuns.id })
      .from(aiRuns)
      .where(
        and(
          eq(aiRuns.id, input.refereeRunId),
          eq(aiRuns.userId, userId),
          eq(aiRuns.purpose, 'referee'),
        ),
      )
      .limit(1)
    if (!run) throw invalid('refereeRunId', '找不到这次裁判记录')
  }
  const fields =
    input.module === 'custom' && goal.fieldVersion !== null
      ? await loadFields(db, goal.id, goal.fieldVersion)
      : null
  const facts: Facts | null =
    input.facts ??
    (input.module === 'diet' && !isFastingSubject(input)
      ? buildFallbackDietFacts(input.items)
      : null)
  let priorDietMeals = options?.priorDietMeals
  if (input.module === 'diet' && priorDietMeals === undefined && options?.localDate) {
    const existing = await todayDietMeals(db, userId, goal.id, options.localDate)
    priorDietMeals = existing.filter((m) => m.mealType !== input.mealType)
  }
  return judge(
    judgeInputOf(input, {
      timeZone: clock.timeZone,
      fields,
      storedRules: goal.refereeRules,
      facts,
      tier: await loadRefereeTier(db, userId),
      priorMinutesToday: options?.priorMinutesToday,
      priorDietMeals,
      extras: {
        refereeRunId: input.refereeRunId ?? null,
        citations: input.citations ?? [],
        advice: input.advice ?? [],
      },
    }),
  )
}

/** 按板块组装要写入的列；需要查库的校验（自定义字段、AI 记录、体重）也在这里。修改打卡复用它 */
export async function buildDraft(
  db: DbOrTx,
  userId: string,
  goal: GoalRow,
  input: CreateCheckin,
  clock: Clock,
  now: Date,
): Promise<Draft> {
  if (input.source === 'ai' && input.aiRunId !== undefined) {
    // 只认自己的识别记录；一次识别只能确认一次由唯一索引保证
    const [run] = await db
      .select({ id: aiRuns.id })
      .from(aiRuns)
      .where(and(eq(aiRuns.id, input.aiRunId), eq(aiRuns.userId, userId)))
      .limit(1)
    if (!run) throw invalid('aiRunId', '找不到这次识别记录')
  }
  const base = {
    occurredAt: serverOccurredAt(now, clock, input.isMakeup),
    durationSeconds: null,
    intakeKcal: null,
    burnKcal: null,
    fieldVersion: null,
    source: input.source,
    aiRunId: input.source === 'ai' ? (input.aiRunId ?? null) : null,
    parsedText: input.source === 'ai' ? (input.parsedText ?? null) : null,
  }
  switch (input.module) {
    case 'exercise': {
      const weight = await latestWeightGrams(db, userId)
      return {
        ...base,
        module: 'exercise',
        durationSeconds: input.durationSeconds,
        burnKcal: exerciseBurnKcal(input, weight),
        payload: {
          module: 'exercise',
          category: input.category,
          intensity: input.intensity,
          ...(input.items ? { items: input.items } : {}),
        },
      }
    }
    case 'diet': {
      return {
        ...base,
        module: 'diet',
        intakeKcal: intakeKcalOf(input.items),
        payload: {
          module: 'diet',
          method: input.method,
          mealType: input.mealType,
          items: input.items,
          ...(input.snackTime ? { snackTime: input.snackTime } : {}),
        },
      }
    }
    case 'sleep': {
      const bedAt = new Date(input.bedAt)
      const wakeAt = new Date(input.wakeAt)
      const check = checkSleepTimes(bedAt, wakeAt, now, clock, input.isMakeup)
      if (!check.ok && !input.skipReason?.trim()) {
        throw new ApiError('MAKEUP_NOT_ALLOWED', check.reason)
      }
      const occurredAt = check.ok ? check.occurredAt : serverOccurredAt(now, clock, input.isMakeup)
      return {
        ...base,
        module: 'sleep',
        occurredAt,
        durationSeconds: secondsBetween(bedAt, wakeAt),
        payload: {
          module: 'sleep',
          bedAt: bedAt.toISOString(),
          wakeAt: wakeAt.toISOString(),
          quality: input.quality,
          ...(input.advanced ? { advanced: input.advanced } : {}),
        },
      }
    }
    case 'study':
      return {
        ...base,
        module: 'study',
        durationSeconds: input.durationSeconds ?? null,
        payload: {
          module: 'study',
          what: input.what,
          ...(input.points && input.points.length > 0 ? { points: input.points } : {}),
        },
      }
    case 'custom': {
      if (goal.fieldVersion === null || input.fieldVersion !== goal.fieldVersion) {
        throw invalid('fieldVersion', '目标的字段已经改过了，刷新后再记')
      }
      const fields = await loadFields(db, goal.id, goal.fieldVersion)
      if (!fields) throw invalid('fieldVersion', '找不到这个字段版本')
      const parsed = buildSchema(fields).safeParse(input.values)
      if (!parsed.success && !input.skipReason?.trim()) {
        throw new ApiError('VALIDATION_FAILED', '自定义字段校验失败', {
          fields: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
        })
      }
      // 去掉 undefined：jsonb 里只放填了的字段
      const rawValues = parsed.success ? parsed.data : input.values
      const values = Object.fromEntries(
        Object.entries(rawValues).filter(
          (e): e is [string, NonNullable<(typeof e)[1]>] => e[1] !== undefined,
        ),
      )
      return {
        ...base,
        module: 'custom',
        fieldVersion: goal.fieldVersion,
        payload: { module: 'custom', values },
      }
    }
  }
}

/** 某个目标某个打卡日的进度（stats.goalDayProgress） */
export async function goalProgressOn(
  db: DbOrTx,
  userId: string,
  goal: GoalRow,
  localDate: LocalDate,
): Promise<GoalProgress> {
  const [rows, history] = await Promise.all([
    db
      .select({
        localDate: checkins.localDate,
        isMakeup: checkins.isMakeup,
        durationSeconds: checkins.durationSeconds,
        count: checkins.count,
        payload: checkins.payload,
        occurredAt: checkins.occurredAt,
        isValid: checkins.isValid,
        verdict: checkins.verdict,
      })
      .from(checkins)
      .where(
        and(
          eq(checkins.userId, userId),
          eq(checkins.goalId, goal.id),
          eq(checkins.localDate, localDate),
        ),
      )
      .limit(500),
    loadTargetHistory(db, [goal.id]),
  ])
  return goalDayProgress(
    targetFor(goal, history.get(goal.id), localDate),
    goal.module,
    rows.map(toStatCheckin),
  )
}

/**
 * 饮食全天结算与加餐/删改硬覆盖（reconcileDailyDiet）：
 * - 当天早、午、晚三餐集齐时，按 evaluateDietDay 统一计算全天总分，并将当日该目标下所有饮食记录同步写回全天 score、isValid 与 settled verdict。
 * - 若后续有加餐、修改某餐或删除某餐（如删掉加餐恢复达标，或删掉一顿正餐退回 2/3 pending 态），实时重算并硬覆盖当日全部记录。
 */
export async function reconcileDailyDiet(
  tx: DbOrTx,
  userId: string,
  goal: GoalRow,
  localDate: LocalDate,
  currentRow: CheckinRow | null,
): Promise<CheckinRow | null> {
  if (goal.module !== 'diet') return currentRow
  if (currentRow?.verdict?.metrics?.skipped === 1 && currentRow.isValid) {
    return currentRow
  }

  const dayRows = await tx
    .select(checkinColumns)
    .from(checkins)
    .where(
      and(
        eq(checkins.userId, userId),
        eq(checkins.goalId, goal.id),
        eq(checkins.localDate, localDate),
      ),
    )
  if (dayRows.length === 0) return currentRow
  if (dayRows.some((r) => r.verdict?.metrics?.skipped === 1 && r.isValid)) {
    return currentRow
  }

  const [tier, rules] = [
    await loadRefereeTier(tx, userId),
    effectiveRules('diet', goal.refereeRules),
  ]

  const entries = dayRows.flatMap((r) => {
    if (r.payload.module !== 'diet') return []
    const items = r.payload.items.map((i) => ({
      name: i.name,
      portion: i.portion ?? '',
      kcal: i.kcal,
    }))
    const storedFacts = r.verdict?.facts?.module === 'diet' ? r.verdict.facts : null
    const fasting = isFastingSubject({ items, note: r.note }, storedFacts?.dishes)
    const facts = storedFacts ?? (fasting ? null : buildFallbackDietFacts(r.payload.items))
    const meal: PriorDietMeal = {
      mealType: r.payload.mealType,
      items,
      note: r.note,
      dishes: facts ? facts.dishes : null,
    }
    return [{ row: r, meal, facts }]
  })

  let updatedCurrent: CheckinRow | null = currentRow
  for (const entry of entries) {
    const otherMeals = entries.filter((e) => e.row.id !== entry.row.id).map((e) => e.meal)
    const nextVerdict = judgeDiet(
      {
        mealType: entry.meal.mealType,
        items: entry.meal.items,
        note: entry.meal.note,
      },
      {
        rules,
        facts: entry.facts,
        tier,
        priorDietMeals: otherMeals,
        extras: {
          refereeRunId: entry.row.verdict?.refereeRunId ?? null,
          citations: entry.row.verdict?.citations ?? [],
          advice: entry.row.verdict?.advice ?? [],
        },
      },
    )
    const [updated] = await tx
      .update(checkins)
      .set({
        score: nextVerdict.score,
        isValid: nextVerdict.isValid,
        verdict: nextVerdict,
      })
      .where(and(eq(checkins.id, entry.row.id), eq(checkins.userId, userId)))
      .returning(checkinColumns)
    if (updated && currentRow && entry.row.id === currentRow.id) {
      updatedCurrent = updated
    }
  }

  return updatedCurrent
}

/**
 * POST /goals/{goalId}/checkins（PRD 2.4、3、7.2）。
 * 打卡日 = localDateOf(occurredAt, 资料时区, 日切换时间)；补卡只能补昨天（isMakeup）。
 * 饮食同一天同一餐次再次提交时直接硬覆盖（Upsert）该餐记录，并触发全天总分结算与硬覆盖。
 */
export async function createCheckin(
  db: typeof Database,
  userId: string,
  goalId: string,
  input: CreateCheckin,
  now: Date,
): Promise<CreateCheckinResult> {
  try {
    return await db.transaction(async (tx) => {
      const goal = await loadGoal(tx, userId, goalId)
      if (goal.status !== 'active') throw invalid('goalId', '这个目标已经归档了')
      if (goal.module !== input.module) throw invalid('module', '板块和目标不一致')
      const clock = await loadClock(tx, userId)
      const initialDraft = await buildDraft(tx, userId, goal, input, clock, now)
      const localDate = localDateOf(initialDraft.occurredAt, clock.timeZone, clock.dayStartHour)

      const sameDayRows = await tx
        .select(checkinColumns)
        .from(checkins)
        .where(
          and(
            eq(checkins.userId, userId),
            eq(checkins.goalId, goalId),
            eq(checkins.localDate, localDate),
          ),
        )

      // 运动模块：若来自全局智能识别（未携带完整历史 items）且今日已有运动记录，自动合并运动明细
      let effectiveInput: CreateCheckin = input
      if (
        input.module === 'exercise' &&
        input.source === 'ai' &&
        (!input.items || input.items.length <= 1) &&
        sameDayRows[0]?.payload.module === 'exercise'
      ) {
        const prevPayload = sameDayRows[0].payload
        const prevItems =
          prevPayload.items && prevPayload.items.length > 0
            ? prevPayload.items
            : [
                {
                  name: prevPayload.category,
                  calc: detectCalc(prevPayload.category) ?? ('distance' as const),
                  minutes: Math.max(1, Math.round((sameDayRows[0].durationSeconds ?? 1800) / 60)),
                  km: null,
                  sets: null,
                  effort: '',
                  kcal: sameDayRows[0].burnKcal,
                  heartRate: null,
                  feel: '',
                },
              ]
        const incomingItems =
          input.items && input.items.length > 0
            ? input.items
            : [
                {
                  name: input.category,
                  calc: detectCalc(input.category) ?? ('distance' as const),
                  minutes: Math.max(1, Math.round(input.durationSeconds / 60)),
                  km: null,
                  sets: null,
                  effort: '',
                  kcal: null,
                  heartRate: null,
                  feel: '',
                },
              ]
        const mergedItems = [
          ...prevItems.filter(
            (p) => !incomingItems.some((n) => n.name === p.name && n.minutes === p.minutes),
          ),
          ...incomingItems,
        ].slice(0, 10)
        const totalMin = mergedItems.reduce((s, i) => s + i.minutes, 0)
        effectiveInput = {
          ...input,
          category: mergedItems[0]?.name.slice(0, 10) ?? input.category,
          durationSeconds: Math.max(60, Math.min(36_000, totalMin * 60)),
          items: mergedItems,
        }
      }

      const draft =
        effectiveInput === input
          ? initialDraft
          : await buildDraft(tx, userId, goal, effectiveInput, clock, now)
      const priorMinutesToday =
        effectiveInput.module === 'study'
          ? Math.round(
              sameDayRows
                .filter((r) => r.payload.module === 'study')
                .reduce((sum, r) => sum + (r.durationSeconds ?? 0), 0) / 60,
            )
          : undefined
      const verdict = await judgeCheckin(tx, userId, goal, effectiveInput, clock, {
        priorMinutesToday,
        localDate,
      })

      const isSkippedApproved = Boolean(effectiveInput.skipReason?.trim()) && verdict.isValid
      const effectiveCount =
        isSkippedApproved && goal.targetKind === 'count' ? Math.max(1, goal.targetValue) : 1
      const effectiveDuration =
        isSkippedApproved && goal.targetKind === 'duration'
          ? Math.max(draft.durationSeconds ?? 0, goal.targetValue)
          : draft.durationSeconds

      const noteVal = effectiveInput.skipReason?.trim()
        ? `[跳过打卡] ${effectiveInput.skipReason.trim()}`
        : (effectiveInput.note ?? null)

      // 饮食同日同餐次、睡眠/自定义/运动同日单条直接硬覆盖（Upsert）已有行
      let existingRow: CheckinRow | undefined
      if (effectiveInput.module === 'diet') {
        existingRow = sameDayRows.find(
          (r) => r.payload.module === 'diet' && r.payload.mealType === effectiveInput.mealType,
        )
      } else if (
        effectiveInput.module === 'sleep' ||
        effectiveInput.module === 'custom' ||
        effectiveInput.module === 'exercise'
      ) {
        existingRow = sameDayRows[0]
      }

      let row: CheckinRow | undefined
      if (existingRow) {
        const [updated] = await tx
          .update(checkins)
          .set({
            ...draft,
            aiRunId: draft.aiRunId ?? existingRow.aiRunId,
            durationSeconds: effectiveDuration,
            count: effectiveCount,
            note: noteVal,
            score: verdict.score,
            isValid: verdict.isValid,
            verdict,
          })
          .where(and(eq(checkins.id, existingRow.id), eq(checkins.userId, userId)))
          .returning(checkinColumns)
        row = updated
        if (!row) throw new Error('createCheckin：覆盖更新没有返回行')
        row = (await reconcileDailyDiet(tx, userId, goal, localDate, row)) ?? row
        const checkin = toCheckinDto(row)
        await recordRevision(tx, {
          userId,
          action: 'update',
          origin: effectiveInput.origin,
          reason: '同日记录硬覆盖更新',
          before: toCheckinDto(existingRow),
          after: checkin,
        })
        const progress = await goalProgressOn(tx, userId, goal, localDate)
        return { checkin, progress }
      }

      const [inserted] = await tx
        .insert(checkins)
        .values({
          ...draft,
          durationSeconds: effectiveDuration,
          userId,
          goalId,
          localDate,
          isMakeup: effectiveInput.isMakeup,
          count: effectiveCount,
          note: noteVal,
          score: verdict.score,
          isValid: verdict.isValid,
          verdict,
        })
        .returning(checkinColumns)
      if (!inserted) throw new Error('createCheckin：写入没有返回行')

      // 学习模块：当碎片化学习累加后本次达成有效，将当日此前暂存的碎片学习记录同步标记为有效，使全天累计时长完整计入进度
      if (
        effectiveInput.module === 'study' &&
        verdict.isValid &&
        sameDayRows.some((r) => !r.isValid)
      ) {
        await tx
          .update(checkins)
          .set({ isValid: true })
          .where(
            and(
              eq(checkins.userId, userId),
              eq(checkins.goalId, goalId),
              eq(checkins.localDate, localDate),
            ),
          )
      }

      row = (await reconcileDailyDiet(tx, userId, goal, localDate, inserted)) ?? inserted
      const checkin = toCheckinDto(row)
      await recordRevision(tx, {
        userId,
        action: 'create',
        origin: effectiveInput.origin,
        before: null,
        after: checkin,
      })
      const progress = await goalProgressOn(tx, userId, goal, localDate)
      return { checkin, progress }
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError('CHECKIN_EXISTS', '这一天已经记过，或这次识别已经确认过')
    }
    throw error
  }
}
