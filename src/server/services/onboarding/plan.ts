import { DEFAULT_GOALS } from '@/features/goal/defaults'
import { deadlineFromDays } from '@/features/goal/period'
import { isTargetKindAllowed, type CreateGoal } from '@/features/goal/schemas'
import type { Onboarding, OnboardingGoalPlan } from '@/features/me/schemas'
import type { RefereeRules, RefereeTier } from '@/features/referee/schemas'
import { MODULES, type LocalDate } from '@/features/shared/schemas'
import { localDateOf } from '@/lib/time'
import type { RemindMode } from '@/server/db/schema'

/*
 * 新人引导的提交 → 要写入的内容（PRD 2.2、7.1）。纯函数，带单测；onboarding/index.ts 在事务里执行。
 */

export interface OnboardingPlan {
  profile: {
    nickname: string
    avatar: string | null
    gender: 'female' | 'male' | 'other' | null
    birthYear: number | null
    heightCm: number | null
    timeZone: string
    leaderboardOptIn: boolean
    refereeTier: RefereeTier
    remindAt?: string | null
    remindMode?: RemindMode
    healthConsentAt: Date
    onboardedAt: Date
  }
  /** 每个选中的板块一个默认目标，按 MODULES 的固定顺序（sortOrder 稳定，与勾选顺序无关） */
  goals: CreateGoal[]
  /** 填了体重才写一条记录 */
  weightGrams: number | null
}

/** 默认目标的深拷贝：DEFAULT_GOALS 是共享常量，不让下游改到它；引导里定了规则 / 周期 / 目标量就带上 */
function defaultGoal(
  module: (typeof MODULES)[number],
  rules: readonly RefereeRules[],
  plans: readonly OnboardingGoalPlan[] | undefined,
  deadlineDate: LocalDate | undefined,
): CreateGoal {
  const goal = structuredClone(DEFAULT_GOALS[module])
  const p = plans?.find((x) => x.module === module)
  if (p?.target && isTargetKindAllowed(module, p.target.kind)) {
    goal.target = structuredClone(p.target)
  }
  if (p?.weekdays && p.weekdays.length > 0) {
    goal.weekdays = [...p.weekdays]
  }
  if (p?.plannedTime !== undefined) {
    goal.plannedTime = p.plannedTime
  }
  if (deadlineDate !== undefined) {
    goal.deadlineDate = deadlineDate
  }
  const r = rules.find((x) => x.module === module)
  return r ? { ...goal, refereeRules: structuredClone(r) } : goal
}

export function planOnboarding(input: Onboarding, now: Date): OnboardingPlan {
  const chosen = new Set(input.modules)
  const today = localDateOf(now, input.timeZone, 4)
  const deadlineDate = input.deadlineDate
    ? input.deadlineDate
    : input.periodDays
      ? deadlineFromDays(today, input.periodDays)
      : undefined
  return {
    profile: {
      nickname: input.nickname,
      avatar: input.avatar,
      gender: input.gender,
      birthYear: input.birthYear,
      heightCm: input.heightCm,
      timeZone: input.timeZone,
      leaderboardOptIn: input.leaderboardOptIn,
      refereeTier: input.refereeTier,
      ...(input.remindAt !== undefined
        ? {
            remindAt: input.remindAt,
            remindMode: input.remindAt ? ('in-app' as const) : ('off' as const),
          }
        : {}),
      healthConsentAt: now,
      onboardedAt: now,
    },
    goals: MODULES.filter((m) => chosen.has(m)).map((m) =>
      defaultGoal(m, input.goalRules, input.goalPlans, deadlineDate),
    ),
    weightGrams: input.weightGrams,
  }
}
