import 'server-only'
import type { CreateCheckin } from '@/features/checkin/schemas'
import { effectiveRules } from '@/features/referee/defaults'
import { subjectOf } from '@/features/referee/subject'
import { formatTime, localDateOf } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import { streamReferee } from '@/server/ai/referee'
import { db } from '@/server/db/client'
import { loadClock } from '@/server/services/checkins/clock'
import { loadFields, loadGoal } from '@/server/services/checkins/goal'
import { latestWeightGrams } from '@/server/services/metrics/weight'
import { loadRefereeTier } from './context'

/*
 * POST /goals/{goalId}/referee：对一条还没入库的打卡做 Agent 裁判，流式返回。
 * 不写任何业务表；用户确认后前端再调创建打卡接口，带上 facts 与 refereeRunId（checkin-modules.md 第 4 节）。
 */

const TIER_LABEL = {
  'strict-fat-loss': '减脂严管（偏胖 / 减脂期）',
  'balanced-glycemic': '控糖均衡（标准体型）',
  'gentle-gain': '增肌温和（偏瘦 / 增肌期）',
} as const

export async function startReferee(input: {
  userId: string
  ip: string
  idempotencyKey: string
  goalId: string
  checkin: CreateCheckin
  now?: Date
}): Promise<Response> {
  const now = input.now ?? new Date()
  const goal = await loadGoal(db, input.userId, input.goalId)
  if (goal.status !== 'active') {
    throw new ApiError('VALIDATION_FAILED', '这个目标已经归档了', {
      fields: { goalId: ['这个目标已经归档了'] },
    })
  }
  if (goal.module !== input.checkin.module) {
    throw new ApiError('VALIDATION_FAILED', '板块和目标不一致', {
      fields: { module: ['板块和目标不一致'] },
    })
  }
  const [clock, tier, weightGrams, fields] = await Promise.all([
    loadClock(db, input.userId),
    loadRefereeTier(db, input.userId),
    latestWeightGrams(db, input.userId),
    goal.module === 'custom' && goal.fieldVersion !== null
      ? loadFields(db, goal.id, goal.fieldVersion)
      : Promise.resolve(null),
  ])
  const subject = subjectOf(input.checkin, { timeZone: clock.timeZone, fields })
  const rules = effectiveRules(goal.module, goal.refereeRules)
  const today = localDateOf(now, clock.timeZone, clock.dayStartHour)

  return streamReferee({
    db,
    userId: input.userId,
    ip: input.ip,
    idempotencyKey: input.idempotencyKey,
    goalId: goal.id,
    module: goal.module,
    today,
    timeZone: clock.timeZone,
    weightKg: weightGrams !== null && weightGrams > 0 ? weightGrams / 1000 : null,
    judgeBase: { ...subject, storedRules: goal.refereeRules, tier },
    brief: {
      板块: goal.module,
      目标: goal.title,
      用户当地时间: `${today} ${formatTime(now, clock.timeZone)}`,
      个人体质: TIER_LABEL[tier],
      达标规则: rules,
      待裁判的记录: subject.subject,
      ...(input.checkin.note ? { 备注: input.checkin.note } : {}),
    },
    now,
  })
}
