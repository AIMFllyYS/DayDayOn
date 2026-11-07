import type { Module } from '@/features/shared/schemas'
import { effectiveRules } from '../defaults'
import type { Facts, FactsOf, RefereeTier, Verdict } from '../schemas'
import { buildVerdict, type RefereeExtras } from './common'
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
    /** 手动填写模式下的「跳过本次打卡」理由 */
    skipReason?: string | null
    extras?: RefereeExtras
  }
}[Module]

function factsFor<M extends Module>(module: M, facts: Facts | null): FactsOf<M> | null {
  return facts !== null && facts.module === module ? (facts as FactsOf<M>) : null
}

export function judge(input: JudgeInput): Verdict {
  const skipReason = input.skipReason?.trim()
  if (skipReason && skipReason.length > 0) {
    const approved =
      input.facts === null ? skipReason.length >= 2 : input.facts.skipApproved !== false
    const comment = input.facts?.skipComment ?? null
    return buildVerdict({
      isValid: approved,
      score: input.module === 'diet' ? (approved ? 4.0 : 0) : null,
      scoreMax: input.module === 'diet' ? 5 : null,
      detail: approved
        ? comment || `跳过理由合理（${skipReason}），本次打卡豁免通过`
        : comment || '跳过理由不够充分，请补充具体合理的原因',
      checks: [
        {
          id: 'skip-reason',
          text: approved ? `跳过理由核验通过：${skipReason}` : '跳过理由需要具体合理的原因',
          ok: approved,
        },
      ],
      metrics: {
        skipped: approved ? 1 : 0,
        ...(input.module === 'diet'
          ? {
              kcal: 0,
              protein: 0,
              carb: 0,
              fat: 0,
              fiber: 0,
              sodium: 0,
              gi: 0,
              dishes: 0,
              kcalMin: 300,
              kcalMax: 700,
              passScore: 3,
            }
          : {}),
      },
      facts: input.facts,
      advice: approved
        ? ['好好休息调整状态，准备好后再继续打卡']
        : ['请填写具体客观的跳过理由（如身体不适、生病、外出赶路等）'],
      extras: input.extras,
    })
  }

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
