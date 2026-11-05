import type { Module } from '@/features/shared/schemas'
import { effectiveRules } from '../defaults'
import type { Facts, FactsOf, RefereeTier, Verdict } from '../schemas'
import type { RefereeExtras } from './common'
import { judgeCustom, type CustomSubject } from './custom'
import { judgeDiet, type DietSubject } from './diet'
import { judgeExercise, type ExerciseSubject } from './exercise'
import { judgeSleep, type SleepSubject } from './sleep'
import { judgeStudy, type StudySubject } from './study'

/*
 * 裁判分发：唯一按 Module 分支的规则入口（checkin-modules.md 第 2 节）。
 * 前端预览与服务端入库都调这里；facts 不属于该板块时按离线处理。
 */

export interface SubjectByModule {
  diet: DietSubject
  exercise: ExerciseSubject
  sleep: SleepSubject
  study: StudySubject
  custom: CustomSubject
}

export type JudgeInput = {
  [M in Module]: {
    module: M
    subject: SubjectByModule[M]
    /** goals.referee_rules（可空） */
    storedRules: unknown
    facts: Facts | null
    tier: RefereeTier
    extras?: RefereeExtras
  }
}[Module]

function factsFor<M extends Module>(module: M, facts: Facts | null): FactsOf<M> | null {
  return facts !== null && facts.module === module ? (facts as FactsOf<M>) : null
}

export function judge(input: JudgeInput): Verdict {
  const base = { tier: input.tier, extras: input.extras }
  switch (input.module) {
    case 'diet':
      return judgeDiet(input.subject, {
        ...base,
        rules: effectiveRules('diet', input.storedRules),
        facts: factsFor('diet', input.facts),
      })
    case 'exercise':
      return judgeExercise(input.subject, {
        ...base,
        rules: effectiveRules('exercise', input.storedRules),
        facts: factsFor('exercise', input.facts),
      })
    case 'sleep':
      return judgeSleep(input.subject, {
        ...base,
        rules: effectiveRules('sleep', input.storedRules),
        facts: factsFor('sleep', input.facts),
      })
    case 'study':
      return judgeStudy(input.subject, {
        ...base,
        rules: effectiveRules('study', input.storedRules),
        facts: factsFor('study', input.facts),
      })
    case 'custom':
      return judgeCustom(input.subject, {
        ...base,
        rules: effectiveRules('custom', input.storedRules),
        facts: factsFor('custom', input.facts),
      })
  }
}

export type { CustomSubject, DietSubject, ExerciseSubject, SleepSubject, StudySubject }
export type { RefereeExtras } from './common'
