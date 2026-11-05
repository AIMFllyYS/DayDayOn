import 'server-only'
import { and, eq } from 'drizzle-orm'
import * as z from 'zod'
import {
  CreateCheckinSchema,
  type Checkin,
  type CreateCheckin,
  type CreateCheckinInput,
} from '@/features/checkin/schemas'
import type { FieldDef } from '@/features/goal/schemas'
import type { Verdict } from '@/features/referee/schemas'
import { localDateOf } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import type { DbOrTx } from '@/server/db/client'
import { checkins } from '@/server/db/schema'
import { buildDraft, judgeCheckin } from './create'
import { loadClock } from './clock'
import { loadFields, loadGoal, toCheckinDto, type GoalRow } from './goal'
import { assertAgentWindow, loadOwnCheckin, planReplace } from './mutate'

/*
 * Agent 草稿预览（checkin-modules.md 第 8 节）：和真正写入走同一套校验与裁判，但不写库。
 * 草稿卡上看到的「达标 / 分数」就是这里算的；用户确认后服务端再算一次，不信前端带回来的结论。
 */

function validationError(error: z.ZodError): ApiError {
  return new ApiError('VALIDATION_FAILED', z.prettifyError(error), {
    fields: z.flattenError(error).fieldErrors as Record<string, string[]>,
  })
}

export interface CreatePreview {
  goal: GoalRow
  input: CreateCheckin
  /** 预览用的 Checkin（id 为空串，不入库） */
  checkin: Checkin
  verdict: Verdict
  fields: FieldDef[] | null
}

/** 新增打卡的预览：目标归属、板块、字段、睡眠时刻、补卡规则全按创建接口校验 */
export async function previewCreate(
  db: DbOrTx,
  userId: string,
  goalId: string,
  raw: CreateCheckinInput,
  now: Date,
): Promise<CreatePreview> {
  const goal = await loadGoal(db, userId, goalId)
  if (goal.status !== 'active') {
    throw new ApiError('VALIDATION_FAILED', `目标「${goal.title}」已经归档了，不能再打卡`)
  }
  if (goal.module !== raw.module) {
    throw new ApiError(
      'VALIDATION_FAILED',
      `目标「${goal.title}」是 ${goal.module} 板块，不能记成 ${raw.module}`,
    )
  }
  const parsed = CreateCheckinSchema.safeParse(raw)
  if (!parsed.success) throw validationError(parsed.error)
  const input = parsed.data
  const clock = await loadClock(db, userId)
  const draft = await buildDraft(db, userId, goal, input, clock, now)
  const verdict = await judgeCheckin(db, userId, goal, input, clock)
  const localDate = localDateOf(draft.occurredAt, clock.timeZone, clock.dayStartHour)
  if (goal.module === 'sleep') {
    const [exists] = await db
      .select({ id: checkins.id })
      .from(checkins)
      .where(and(eq(checkins.goalId, goal.id), eq(checkins.localDate, localDate)))
      .limit(1)
    if (exists) {
      throw new ApiError(
        'CHECKIN_EXISTS',
        `${localDate} 已经记过睡眠了（checkinId ${exists.id}），要改就用 draftUpdateCheckin`,
      )
    }
  }
  const fields =
    goal.module === 'custom' && goal.fieldVersion !== null
      ? await loadFields(db, goal.id, goal.fieldVersion)
      : null
  const checkin: Checkin = {
    id: '',
    goalId: goal.id,
    module: goal.module,
    localDate,
    occurredAt: draft.occurredAt.toISOString(),
    source: draft.source,
    isMakeup: input.isMakeup,
    durationSeconds: draft.durationSeconds,
    count: 1,
    intakeKcal: draft.intakeKcal,
    burnKcal: draft.burnKcal,
    note: input.note ?? null,
    parsedText: draft.parsedText,
    payload: draft.payload,
    fieldVersion: draft.fieldVersion,
    aiRunId: draft.aiRunId,
    score: verdict.score,
    isValid: verdict.isValid,
    verdict,
    createdAt: now.toISOString(),
  }
  return { goal, input, checkin, verdict, fields }
}

export interface ChangePreview {
  goal: GoalRow
  current: Checkin
  /** 改后的样子；只改备注时内容和结论不变 */
  next: Checkin
  verdict: Verdict | null
  fields: FieldDef[] | null
}

/** 修改的预览（Agent 专用：只能改今天和昨天） */
export async function previewUpdate(
  db: DbOrTx,
  userId: string,
  checkinId: string,
  change: { replace?: CreateCheckinInput; note?: string | null },
  now: Date,
): Promise<ChangePreview> {
  const row = await loadOwnCheckin(db, userId, checkinId, false)
  const clock = await loadClock(db, userId)
  assertAgentWindow('agent', row.localDate, clock, now)
  const goal = await loadGoal(db, userId, row.goalId)
  const current = toCheckinDto(row)
  let next: Checkin = { ...current }
  let verdict: Verdict | null = null
  if (change.replace !== undefined) {
    const parsed = CreateCheckinSchema.safeParse(change.replace)
    if (!parsed.success) throw validationError(parsed.error)
    const plan = await planReplace(db, userId, goal, row, parsed.data, clock, now)
    verdict = plan.verdict
    next = {
      ...next,
      payload: plan.set.payload ?? next.payload,
      durationSeconds: plan.set.durationSeconds ?? null,
      intakeKcal: plan.set.intakeKcal ?? null,
      burnKcal: plan.set.burnKcal ?? null,
      fieldVersion: plan.set.fieldVersion ?? null,
      score: verdict.score,
      isValid: verdict.isValid,
      verdict,
      ...(plan.set.occurredAt ? { occurredAt: plan.set.occurredAt.toISOString() } : {}),
      ...(plan.set.note !== undefined ? { note: plan.set.note ?? null } : {}),
    }
  } else if (goal.status !== 'active') {
    throw new ApiError('VALIDATION_FAILED', `目标「${goal.title}」已经归档了，不能再改`)
  }
  if (change.note !== undefined) next = { ...next, note: change.note }
  const fieldVersion = next.fieldVersion ?? current.fieldVersion
  const fields =
    goal.module === 'custom' && fieldVersion !== null
      ? await loadFields(db, goal.id, fieldVersion)
      : null
  return { goal, current, next, verdict, fields }
}

/** 删除的预览（Agent 专用：只能删今天和昨天） */
export async function previewDelete(
  db: DbOrTx,
  userId: string,
  checkinId: string,
  now: Date,
): Promise<Omit<ChangePreview, 'next' | 'verdict'>> {
  const row = await loadOwnCheckin(db, userId, checkinId, false)
  const clock = await loadClock(db, userId)
  assertAgentWindow('agent', row.localDate, clock, now)
  const goal = await loadGoal(db, userId, row.goalId)
  const current = toCheckinDto(row)
  const fields =
    goal.module === 'custom' && current.fieldVersion !== null
      ? await loadFields(db, goal.id, current.fieldVersion)
      : null
  return { goal, current, fields }
}
