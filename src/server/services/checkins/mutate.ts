import 'server-only'
import { and, eq } from 'drizzle-orm'
import { isAgentEditable } from '@/features/checkin/edit-window'
import type {
  Checkin,
  CheckinPayload,
  CreateCheckin,
  DeleteCheckinQuery,
  UpdateCheckin,
} from '@/features/checkin/schemas'
import type { Verdict } from '@/features/referee/schemas'
import { localDateOf } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import type { db as Database, DbOrTx } from '@/server/db/client'
import { checkins } from '@/server/db/schema'
import { buildDraft, judgeCheckin, reconcileDailyDiet, reconcileDailyStudy } from './create'
import { loadClock } from './clock'
import { checkinColumns, loadGoal, toCheckinDto, type CheckinRow, type GoalRow } from './goal'
import { recordRevision } from './revisions'
import { intakeKcalOf, isUniqueViolation, type Clock } from './rules'
import { todayStudyMinutes } from '@/server/services/referee/read'

/*
 * 修改与删除打卡（checkin-modules.md 第 7 节）。
 * - 内容变了就按新内容重算裁判结论（分数、是否有效），统计跟着变。
 * - origin = agent 时只能动今天和昨天的打卡（草稿工具也拦一层）。
 * - 每次改动和删除在同一个事务里写留痕。
 */

function invalid(field: string, message: string): ApiError {
  return new ApiError('VALIDATION_FAILED', message, { fields: { [field]: [message] } })
}

async function loadOwnCheckin(
  db: DbOrTx,
  userId: string,
  checkinId: string,
  lock = true,
): Promise<CheckinRow> {
  const query = db
    .select(checkinColumns)
    .from(checkins)
    .where(and(eq(checkins.id, checkinId), eq(checkins.userId, userId)))
    .limit(1)
  const [row] = lock ? await query.for('update') : await query
  if (!row) throw new ApiError('CHECKIN_NOT_FOUND', '打卡不存在')
  return row
}

export { loadOwnCheckin }

function assertWindow(origin: 'manual' | 'agent', localDate: string, clock: Clock, now: Date) {
  if (origin !== 'agent') return
  const today = localDateOf(now, clock.timeZone, clock.dayStartHour)
  if (!isAgentEditable(localDate, today)) {
    throw new ApiError('CHECKIN_LOCKED', '只能改、删今天和昨天的打卡')
  }
}

export { assertWindow as assertAgentWindow }

/**
 * 用一份完整的创建请求体替换内容：打卡日、补卡标记、来源不变；睡眠按「今天 / 昨天」校验新时刻，
 * 且新时刻必须还落在原来的打卡日。裁判结论按新内容重算。修改接口和 Agent 草稿预览共用。
 */
export async function planReplace(
  db: DbOrTx,
  userId: string,
  goal: GoalRow,
  current: CheckinRow,
  replaceInput: CreateCheckin,
  clock: Clock,
  now: Date,
  noteOverride?: string | null,
): Promise<{ set: Partial<typeof checkins.$inferInsert>; verdict: Verdict }> {
  if (goal.status !== 'active') throw invalid('goalId', '这个目标已经归档了，不能再改')
  if (replaceInput.module !== current.module) throw invalid('replace', '板块不能改')
  if (
    current.payload.module === 'diet' &&
    replaceInput.module === 'diet' &&
    replaceInput.mealType !== current.payload.mealType
  ) {
    const sameDay = await db
      .select({ id: checkins.id, payload: checkins.payload })
      .from(checkins)
      .where(
        and(
          eq(checkins.userId, userId),
          eq(checkins.goalId, goal.id),
          eq(checkins.localDate, current.localDate),
        ),
      )
      .limit(20)
    const collision = sameDay.find(
      (r) =>
        r.id !== current.id &&
        r.payload.module === 'diet' &&
        r.payload.mealType === replaceInput.mealType,
    )
    if (collision) {
      throw new ApiError('CHECKIN_EXISTS', '这一天的该餐次已经记过了，请直接修改那一条记录')
    }
  }
  const today = localDateOf(now, clock.timeZone, clock.dayStartHour)
  const effectiveNote =
    noteOverride !== undefined
      ? noteOverride
      : replaceInput.note !== undefined
        ? replaceInput.note
        : current.note
  const replace: CreateCheckin = {
    ...replaceInput,
    note: effectiveNote,
    isMakeup: current.localDate !== today,
    source: current.source,
    aiRunId: current.aiRunId ?? undefined,
    parsedText: current.parsedText ?? undefined,
  }
  const draft = await buildDraft(db, userId, goal, replace, clock, now)
  const priorMinutesToday =
    current.module === 'study'
      ? await todayStudyMinutes(db, userId, goal.id, current.localDate, current.id)
      : undefined
  const verdict = await judgeCheckin(db, userId, goal, replace, clock, {
    localDate: current.localDate,
    priorMinutesToday,
  })
  const set: Partial<typeof checkins.$inferInsert> = {
    payload: draft.payload,
    durationSeconds: draft.durationSeconds,
    intakeKcal: draft.intakeKcal,
    burnKcal: draft.burnKcal,
    fieldVersion: draft.fieldVersion,
    score: verdict.score,
    isValid: verdict.isValid,
    verdict,
  }
  if (current.module === 'sleep') {
    const day = localDateOf(draft.occurredAt, clock.timeZone, clock.dayStartHour)
    if (day !== current.localDate) {
      throw invalid('replace', '改了以后不在原来那天了；记错了日子就删掉重记')
    }
    set.occurredAt = draft.occurredAt
  }
  if (replaceInput.note !== undefined) set.note = replaceInput.note
  return { set, verdict }
}

/** 只改了饮食条目或备注时，用原记录拼出一份创建请求体给裁判重算（旧事实对不上新条目时按规则离线判定） */
export function dietReplay(
  current: CheckinRow,
  items: NonNullable<UpdateCheckin['items']>,
  note?: string | null,
): CreateCheckin {
  const payload = current.payload as Extract<CheckinPayload, { module: 'diet' }>
  const storedFacts = current.verdict?.facts?.module === 'diet' ? current.verdict.facts : undefined
  return {
    module: 'diet',
    method: payload.method,
    mealType: payload.mealType,
    items,
    ...(payload.snackTime ? { snackTime: payload.snackTime } : {}),
    ...(note !== undefined ? { note } : { note: current.note }),
    ...(storedFacts && items === payload.items ? { facts: storedFacts } : {}),
    isMakeup: current.isMakeup,
    source: current.source,
    origin: 'manual',
  }
}

/** PATCH /checkins/{checkinId} */
export async function updateCheckin(
  db: typeof Database,
  userId: string,
  checkinId: string,
  input: UpdateCheckin,
  now: Date,
): Promise<Checkin> {
  try {
    return await db.transaction(async (tx) => {
      const current = await loadOwnCheckin(tx, userId, checkinId)
      const clock = await loadClock(tx, userId)
      assertWindow(input.origin, current.localDate, clock, now)
      const goal = await loadGoal(tx, userId, current.goalId)
      const set: Partial<typeof checkins.$inferInsert> = {}

      if (input.replace !== undefined) {
        const plan = await planReplace(
          tx,
          userId,
          goal,
          current,
          input.replace,
          clock,
          now,
          input.note,
        )
        Object.assign(set, plan.set)
      } else if (input.items !== undefined) {
        if (current.payload.module !== 'diet') throw invalid('items', '只有饮食打卡能改条目')
        const replay = dietReplay(current, input.items, input.note)
        const verdict = await judgeCheckin(tx, userId, goal, replay, clock, {
          localDate: current.localDate,
        })
        set.payload = { ...current.payload, items: input.items }
        set.intakeKcal = intakeKcalOf(input.items)
        set.score = verdict.score
        set.isValid = verdict.isValid
        set.verdict = verdict
      }
      if (input.note !== undefined) set.note = input.note

      const [row] = await tx
        .update(checkins)
        .set(set)
        .where(and(eq(checkins.id, checkinId), eq(checkins.userId, userId)))
        .returning(checkinColumns)
      if (!row) throw new ApiError('CHECKIN_NOT_FOUND', '打卡不存在')
      let reconciled = row
      if (goal.module === 'diet') {
        reconciled = (await reconcileDailyDiet(tx, userId, goal, row.localDate, row)) ?? row
      } else if (goal.module === 'study') {
        reconciled = (await reconcileDailyStudy(tx, userId, goal, row.localDate, row)) ?? row
      }
      const after = toCheckinDto(reconciled)
      await recordRevision(tx, {
        userId,
        action: 'update',
        origin: input.origin,
        reason: input.reason,
        before: toCheckinDto(current),
        after,
      })
      return after
    })
  } catch (error) {
    if (isUniqueViolation(error)) throw new ApiError('CHECKIN_EXISTS', '这一天已经记过了')
    throw error
  }
}

/** DELETE /checkins/{checkinId}：不存在或不属于当前用户 404；留痕保留 */
export async function deleteCheckin(
  db: typeof Database,
  userId: string,
  checkinId: string,
  query: DeleteCheckinQuery,
  now: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    const current = await loadOwnCheckin(tx, userId, checkinId)
    const clock = await loadClock(tx, userId)
    assertWindow(query.origin, current.localDate, clock, now)
    await tx.delete(checkins).where(and(eq(checkins.id, checkinId), eq(checkins.userId, userId)))
    if (current.module === 'diet') {
      const goal = await loadGoal(tx, userId, current.goalId)
      await reconcileDailyDiet(tx, userId, goal, current.localDate, null)
    } else if (current.module === 'study') {
      const goal = await loadGoal(tx, userId, current.goalId)
      await reconcileDailyStudy(tx, userId, goal, current.localDate, null)
    }
    await recordRevision(tx, {
      userId,
      action: 'delete',
      origin: query.origin,
      reason: query.reason,
      before: toCheckinDto(current),
      after: null,
    })
  })
}
