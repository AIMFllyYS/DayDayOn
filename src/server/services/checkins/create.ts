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
import type { LocalDate } from '@/features/shared/schemas'
import { localDateOf, secondsBetween } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import type { db as Database, DbOrTx } from '@/server/db/client'
import { aiRuns, checkins } from '@/server/db/schema'
import { goalDayProgress } from '@/server/services/stats'
import { latestWeightGrams } from '../metrics/weight'
import { loadClock } from './clock'
import {
  checkinColumns,
  loadFields,
  loadGoal,
  loadTargetHistory,
  targetFor,
  toCheckinDto,
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

/** 按板块组装要写入的列；需要查库的校验（自定义字段、AI 记录、体重）也在这里 */
async function buildDraft(
  db: DbOrTx,
  userId: string,
  goal: GoalRow,
  input: CreateCheckin,
  clock: Clock,
  now: Date,
): Promise<Draft> {
  const base = {
    occurredAt: serverOccurredAt(now, clock, input.isMakeup),
    durationSeconds: null,
    intakeKcal: null,
    burnKcal: null,
    fieldVersion: null,
    source: 'manual' as const,
    aiRunId: null,
    parsedText: null,
  }
  switch (input.module) {
    case 'exercise': {
      const weight = await latestWeightGrams(db, userId)
      return {
        ...base,
        module: 'exercise',
        durationSeconds: input.durationSeconds,
        burnKcal: estimateBurnKcal(input.category, input.intensity, input.durationSeconds, weight),
        payload: { module: 'exercise', category: input.category, intensity: input.intensity },
      }
    }
    case 'diet': {
      if (input.source === 'ai' && input.aiRunId !== undefined) {
        // 只认自己的识别记录；一次识别只能确认一次由唯一索引保证
        const [run] = await db
          .select({ id: aiRuns.id })
          .from(aiRuns)
          .where(and(eq(aiRuns.id, input.aiRunId), eq(aiRuns.userId, userId)))
          .limit(1)
        if (!run) throw invalid('aiRunId', '找不到这次识别记录')
      }
      return {
        ...base,
        module: 'diet',
        intakeKcal: intakeKcalOf(input.items),
        payload: {
          module: 'diet',
          method: input.method,
          mealType: input.mealType,
          items: input.items,
        },
        source: input.source,
        aiRunId: input.source === 'ai' ? (input.aiRunId ?? null) : null,
        parsedText: input.source === 'ai' ? (input.parsedText ?? null) : null,
      }
    }
    case 'sleep': {
      const bedAt = new Date(input.bedAt)
      const wakeAt = new Date(input.wakeAt)
      const check = checkSleepTimes(bedAt, wakeAt, now, clock, input.isMakeup)
      if (!check.ok) throw new ApiError('MAKEUP_NOT_ALLOWED', check.reason)
      return {
        ...base,
        module: 'sleep',
        occurredAt: check.occurredAt,
        durationSeconds: secondsBetween(bedAt, wakeAt),
        payload: {
          module: 'sleep',
          bedAt: bedAt.toISOString(),
          wakeAt: wakeAt.toISOString(),
          quality: input.quality,
        },
      }
    }
    case 'study':
      return {
        ...base,
        module: 'study',
        durationSeconds: input.durationSeconds ?? null,
        payload: { module: 'study', what: input.what },
      }
    case 'custom': {
      if (goal.fieldVersion === null || input.fieldVersion !== goal.fieldVersion) {
        throw invalid('fieldVersion', '目标的字段已经改过了，刷新后再记')
      }
      const fields = await loadFields(db, goal.id, goal.fieldVersion)
      if (!fields) throw invalid('fieldVersion', '找不到这个字段版本')
      const parsed = buildSchema(fields).safeParse(input.values)
      if (!parsed.success) {
        throw new ApiError('VALIDATION_FAILED', '自定义字段校验失败', {
          fields: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
        })
      }
      // 去掉 undefined：jsonb 里只放填了的字段
      const values = Object.fromEntries(
        Object.entries(parsed.data).filter(
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
 * POST /goals/{goalId}/checkins（PRD 2.4、3、7.2）。
 * 打卡日 = localDateOf(occurredAt, 资料时区, 日切换时间)；补卡只能补昨天（isMakeup）。
 * 睡眠每天一条、一次 AI 识别只能确认一次：唯一索引冲突映射为 409 CHECKIN_EXISTS。
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
      const localDate = localDateOf(draft.occurredAt, clock.timeZone, clock.dayStartHour)
      const [row] = await tx
        .insert(checkins)
        .values({
          ...draft,
          userId,
          goalId,
          localDate,
          isMakeup: input.isMakeup,
          count: 1,
          note: input.note ?? null,
        })
        .returning(checkinColumns)
      if (!row) throw new Error('createCheckin：写入没有返回行')
      const progress = await goalProgressOn(tx, userId, goal, localDate)
      return { checkin: toCheckinDto(row), progress }
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError('CHECKIN_EXISTS', '这一天已经记过，或这次识别已经确认过')
    }
    throw error
  }
}
