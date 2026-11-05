import type { Module } from '@/features/shared/schemas'
import { RefereeRulesSchema, type RefereeRules, type RulesOf } from './schemas'

/*
 * 各板块的默认裁判规则（goals.referee_rules 为空时使用）。
 * 数字只写在 schemas.ts 的 default() 里，这里只负责按板块解析出来，避免两处各写一遍。
 */

export const DEFAULT_RULES: { [M in Module]: RulesOf<M> } = {
  diet: RefereeRulesSchema.parse({ module: 'diet' }) as RulesOf<'diet'>,
  exercise: RefereeRulesSchema.parse({ module: 'exercise' }) as RulesOf<'exercise'>,
  sleep: RefereeRulesSchema.parse({ module: 'sleep' }) as RulesOf<'sleep'>,
  study: RefereeRulesSchema.parse({ module: 'study' }) as RulesOf<'study'>,
  custom: RefereeRulesSchema.parse({ module: 'custom' }) as RulesOf<'custom'>,
}

/** 目标存的规则（可能为空或属于别的板块）→ 该板块实际生效的规则 */
export function effectiveRules<M extends Module>(module: M, stored: unknown): RulesOf<M> {
  if (stored !== null && stored !== undefined) {
    const parsed = RefereeRulesSchema.safeParse(stored)
    if (parsed.success && parsed.data.module === module) return parsed.data as RulesOf<M>
  }
  return DEFAULT_RULES[module]
}

export function isDefaultRules(rules: RefereeRules): boolean {
  return JSON.stringify(rules) === JSON.stringify(DEFAULT_RULES[rules.module])
}
