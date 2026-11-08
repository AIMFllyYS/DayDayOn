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
import { calcDietDayScore } from '@/features/referee/rules/diet'
import { estimateKcal, metOf } from '@/features/referee/rules/exercise'
import type { Verdict } from '@/features/referee/schemas'
import { judgeInputOf } from '@/features/referee/subject'
import type { LocalDate } from '@/features/shared/schemas'
import { localDateOf, secondsBetween } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import type { db as Database, DbOrTx } from '@/server/db/client'
import { aiRuns, checkins } from '@/server/db/schema'
import { loadRefereeTier } from '@/server/services/referee/context'
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
  return judge(
    judgeInputOf(input, {
      timeZone: clock.timeZone,
      fields,
      storedRules: goal.refereeRules,
      facts: input.facts ?? null,
      tier: await loadRefereeTier(db, userId),
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
 * 饮食全天结算与加餐硬覆盖（reconcileDailyDiet）：
 * - 当天早、午、晚三餐全部打卡后，按全天总分（含加餐修正）判定当日饮食是否有效（isValid）。
 * - 若后续有加餐（或修改某餐），重新计算全天总分并直接硬覆盖（Hard Overwrite）当日所有饮食记录的 isValid，不做软覆盖、不设回退。
 */
export async function reconcileDailyDiet(
  tx: DbOrTx,
  userId: string,
  goal: GoalRow,
  localDate: LocalDate,
  currentRow: CheckinRow,
): Promise<CheckinRow> {
  if (goal.module !== 'diet') return currentRow
  // 若本次是通过「跳过本次打卡」整天豁免，不按单餐重算覆盖
  if (currentRow.verdict?.metrics?.skipped === 1 && currentRow.isValid) {
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

  let breakfast: number | null = null
  let lunch: number | null = null
  let dinner: number | null = null
  const snacks: number[] = []

  const rules = effectiveRules('diet', goal.refereeRules)
  for (const r of dayRows) {
    if (r.payload.module !== 'diet') continue
    const s = r.score ?? (r.isValid ? rules.passScore + 0.5 : 0)
    switch (r.payload.mealType) {
      case 'breakfast':
        breakfast = s
        break
      case 'lunch':
        lunch = s
        break
      case 'dinner':
        dinner = s
        break
      case 'snack':
        snacks.push(s)
        break
    }
  }

  const dayEval = calcDietDayScore({ breakfast, lunch, dinner, snacks }, rules.passScore)
  if (!dayEval.ready || dayEval.score === null) {
    return currentRow
  }

  const dailyScore = dayEval.score
  const dailyValid = dayEval.isValid
  const passStr = rules.passScore.toFixed(1)

  // 硬覆盖当日该饮食目标下所有记录的 isValid
  await tx
    .update(checkins)
    .set({ isValid: dailyValid })
    .where(
      and(
        eq(checkins.userId, userId),
        eq(checkins.goalId, goal.id),
        eq(checkins.localDate, localDate),
      ),
    )

  if (currentRow.verdict) {
    const nextVerdict: Verdict = {
      ...currentRow.verdict,
      isValid: dailyValid,
      detail: dailyValid
        ? `${currentRow.verdict.detail} · 全天总分 ${dailyScore.toFixed(1)} 分（达标）`
        : `${currentRow.verdict.detail} · 全天总分 ${dailyScore.toFixed(1)} 分（未达 ${passStr} 分有效线）`,
      metrics: {
        ...currentRow.verdict.metrics,
        dailyScore,
      },
    }
    const [updated] = await tx
      .update(checkins)
      .set({ isValid: dailyValid, verdict: nextVerdict })
      .where(and(eq(checkins.id, currentRow.id), eq(checkins.userId, userId)))
      .returning(checkinColumns)
    if (updated) return updated
  }

  return { ...currentRow, isValid: dailyValid }
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
      const draft = await buildDraft(tx, userId, goal, input, clock, now)
      const verdict = await judgeCheckin(tx, userId, goal, input, clock)
      const localDate = localDateOf(draft.occurredAt, clock.timeZone, clock.dayStartHour)

      const isSkippedApproved = Boolean(input.skipReason?.trim()) && verdict.isValid
      const effectiveCount =
        isSkippedApproved && goal.targetKind === 'count' ? Math.max(1, goal.targetValue) : 1
      const effectiveDuration =
        isSkippedApproved && goal.targetKind === 'duration'
          ? Math.max(draft.durationSeconds ?? 0, goal.targetValue)
          : draft.durationSeconds

      const noteVal = input.skipReason?.trim()
        ? `[跳过打卡] ${input.skipReason.trim()}`
        : (input.note ?? null)

      // 饮食同日同餐次（或睡眠同日跳过/重记）直接硬覆盖已有行，避免唯一约束冲突或重复餐次
      let existingRow: CheckinRow | undefined
      if (input.module === 'diet' || input.module === 'sleep') {
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
        existingRow =
          input.module === 'diet'
            ? sameDayRows.find(
                (r) => r.payload.module === 'diet' && r.payload.mealType === input.mealType,
              )
            : sameDayRows[0]
      }

      let row: CheckinRow | undefined
      if (existingRow) {
        const [updated] = await tx
          .update(checkins)
          .set({
            ...draft,
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
        row = await reconcileDailyDiet(tx, userId, goal, localDate, row)
        const checkin = toCheckinDto(row)
        await recordRevision(tx, {
          userId,
          action: 'update',
          origin: input.origin,
          reason: '同日餐次硬覆盖更新',
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
          isMakeup: input.isMakeup,
          count: effectiveCount,
          note: noteVal,
          score: verdict.score,
          isValid: verdict.isValid,
          verdict,
        })
        .returning(checkinColumns)
      if (!inserted) throw new Error('createCheckin：写入没有返回行')
      row = await reconcileDailyDiet(tx, userId, goal, localDate, inserted)
      const checkin = toCheckinDto(row)
      await recordRevision(tx, {
        userId,
        action: 'create',
        origin: input.origin,
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
