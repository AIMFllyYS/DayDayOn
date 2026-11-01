import { DEFAULT_GOALS } from '@/features/goal/defaults'
import type { CreateGoal } from '@/features/goal/schemas'
import type { Onboarding } from '@/features/me/schemas'
import { MODULES } from '@/features/shared/schemas'

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
    healthConsentAt: Date
    onboardedAt: Date
  }
  /** 每个选中的板块一个默认目标，按 MODULES 的固定顺序（sortOrder 稳定，与勾选顺序无关） */
  goals: CreateGoal[]
  /** 填了体重才写一条记录 */
  weightGrams: number | null
}

/** 默认目标的深拷贝：DEFAULT_GOALS 是共享常量，不让下游改到它 */
function defaultGoal(module: (typeof MODULES)[number]): CreateGoal {
  return structuredClone(DEFAULT_GOALS[module])
}

export function planOnboarding(input: Onboarding, now: Date): OnboardingPlan {
  const chosen = new Set(input.modules)
  return {
    profile: {
      nickname: input.nickname,
      avatar: input.avatar,
      gender: input.gender,
      birthYear: input.birthYear,
      heightCm: input.heightCm,
      timeZone: input.timeZone,
      leaderboardOptIn: input.leaderboardOptIn,
      healthConsentAt: now,
      onboardedAt: now,
    },
    goals: MODULES.filter((m) => chosen.has(m)).map(defaultGoal),
    weightGrams: input.weightGrams,
  }
}
