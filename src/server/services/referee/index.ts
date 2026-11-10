import 'server-only'
import type { CreateCheckin } from '@/features/checkin/schemas'
import { effectiveRules } from '@/features/referee/defaults'
import { subjectOf } from '@/features/referee/subject'
import { formatTime, localDateOf } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import { streamReferee, type RefereeConversation } from '@/server/ai/referee'
import { db } from '@/server/db/client'
import { loadClock } from '@/server/services/checkins/clock'
import { loadFields, loadGoal } from '@/server/services/checkins/goal'
import { targetDayOf } from '@/server/services/checkins/rules'
import { latestWeightGrams } from '@/server/services/metrics/weight'
import { loadPetName } from '@/server/services/agent/pet-name'
import { loadRefereeTier } from './context'
import { todayDietMeals } from './read'

/*
 * POST /goals/{goalId}/referee：对一条还没入库的打卡做 Agent 裁判，流式返回。
 * 不写打卡表；用户确认后前端再调创建打卡接口，带上 facts 与 refereeRunId（checkin-modules.md 第 4 节）。
 * 带 conversation 时把这次分析存成一个 Agent 会话（标题「目标名 · 打卡分析」），对话框里能接着问。
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
  conversation?: RefereeConversation | null
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
  const [clock, tier, weightGrams, fields, petName] = await Promise.all([
    loadClock(db, input.userId),
    loadRefereeTier(db, input.userId),
    latestWeightGrams(db, input.userId),
    goal.module === 'custom' && goal.fieldVersion !== null
      ? loadFields(db, goal.id, goal.fieldVersion)
      : Promise.resolve(null),
    loadPetName(db, input.userId),
  ])
  const subject = subjectOf(input.checkin, { timeZone: clock.timeZone, fields })
  const rules = effectiveRules(goal.module, goal.refereeRules)
  const today = localDateOf(now, clock.timeZone, clock.dayStartHour)
  const targetDay = targetDayOf(now, clock, input.checkin.isMakeup)
  const currentMeal = input.checkin.module === 'diet' ? input.checkin.mealType : null
  const priorDietMeals =
    currentMeal !== null
      ? (await todayDietMeals(db, input.userId, goal.id, targetDay)).filter(
          (m) => m.mealType !== currentMeal,
        )
      : undefined

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
    judgeBase: {
      ...subject,
      storedRules: goal.refereeRules,
      tier,
      skipReason: input.checkin.skipReason ?? null,
      ...(priorDietMeals ? { priorDietMeals } : {}),
    },
    petName,
    conversation: input.conversation
      ? { ...input.conversation, title: `${goal.title} · 打卡分析` }
      : null,
    brief: {
      板块: goal.module,
      目标: goal.title,
      用户当地时间: `${today} ${formatTime(now, clock.timeZone)}`,
      个人体质: TIER_LABEL[tier],
      达标规则: rules,
      待裁判的记录: subject.subject,
      ...(priorDietMeals && priorDietMeals.length > 0
        ? {
            今日已打卡其他餐次: priorDietMeals.map((m) => ({
              mealType: m.mealType,
              items: m.items.map((i) => i.name),
            })),
          }
        : {}),
      ...(input.checkin.note ? { 备注_最高优先级上下文: input.checkin.note } : {}),
      ...(input.checkin.skipReason ? { 跳过本次打卡理由: input.checkin.skipReason } : {}),
    },
    now,
  })
}
