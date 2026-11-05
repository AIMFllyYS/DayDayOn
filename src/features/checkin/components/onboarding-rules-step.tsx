'use client'

import { useState } from 'react'
import { IconTile } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'
import { moduleMeta } from '@/components/ui/tone'
import { DEFAULT_GOALS } from '@/features/goal/defaults'
import { DEFAULT_RULES } from '@/features/referee/defaults'
import type { RefereeRules, RefereeTier } from '@/features/referee/schemas'
import { MODULES, type Module } from '@/features/shared/schemas'
import { cn } from '@/lib/cn'
import { Collapse } from '../flow/folder-card'
import type { CheckinGoal } from './form-types'
import { moduleDef } from '../modules/registry'
import { suggestTier, TierPicker } from '../modules/tier-picker'

/*
 * 新人引导的「定规则」一步：每个选中的板块一张折叠卡，打开就是目标设置页里同一个规则面板。
 * 不打开、点「跳过」都等于用默认规则；饮食卡里先选人群（体质档位）。
 */

export interface RulesStepValue {
  tier: RefereeTier
  /** 只放用户动过的板块 */
  rules: Partial<Record<Module, RefereeRules>>
}

/** 新人还没有目标 id，规则面板只需要板块和字段定义 */
function draftGoal(module: Module): CheckinGoal {
  const g = DEFAULT_GOALS[module]
  return {
    id: `draft-${module}`,
    module,
    title: g.title,
    target: g.target,
    fields: g.fields ? structuredClone(g.fields) : null,
    fieldVersion: null,
  } as CheckinGoal
}

export function RulesStep({
  modules,
  value,
  onChange,
  heightCm,
  weightKg,
}: {
  modules: readonly Module[]
  value: RulesStepValue
  onChange: (next: RulesStepValue) => void
  heightCm: number | null
  weightKg: number | null
}) {
  const ordered = MODULES.filter((m) => modules.includes(m))
  const [open, setOpen] = useState<Module | null>(ordered[0] ?? null)
  const suggested = suggestTier(heightCm, weightKg)

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-tiny text-muted">
        每张卡都可以不填，不填就用推荐的默认规则；之后在「我的 → 目标设置」里随时改。
      </p>
      {ordered.map((m) => {
        const def = moduleDef(m)
        const goal = draftGoal(m)
        const rules = value.rules[m] ?? DEFAULT_RULES[m]
        const isOpen = open === m
        const Editor = def.RulesEditor
        return (
          <section key={m} className="border-border bg-surface min-w-0 rounded-2xl border">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : m)}
              className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2 text-left"
            >
              <IconTile icon={moduleMeta[m].icon} tone={m} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-caption font-bold">{goal.title}</span>
                <span className="text-tiny text-muted truncate">
                  {def.docs(rules as never, goal).glance.threshold}
                </span>
              </span>
              {value.rules[m] && <Icon name="check" size={16} className="text-success shrink-0" />}
              <Icon
                name="chevron-down"
                size={16}
                className={cn('text-subtle shrink-0 transition-transform', isOpen && 'rotate-180')}
              />
            </button>
            <Collapse open={isOpen}>
              <div className="flex flex-col gap-3 px-3.5 pb-3.5">
                {m === 'diet' && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-tiny text-muted font-semibold">你是哪一类人群</span>
                    <TierPicker
                      value={value.tier}
                      suggested={suggested}
                      onChange={(tier) => onChange({ ...value, tier })}
                    />
                  </div>
                )}
                <Editor
                  rules={rules as never}
                  goal={goal}
                  onChange={(r) =>
                    onChange({ ...value, rules: { ...value.rules, [m]: r as RefereeRules } })
                  }
                />
              </div>
            </Collapse>
          </section>
        )
      })}
    </div>
  )
}
