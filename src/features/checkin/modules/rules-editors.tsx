'use client'

import type { ReactNode } from 'react'
import { NumberField } from '@/components/ui/number-field'
import { cn } from '@/lib/cn'
import { InlineRow } from '../flow/fields/inputs'
import { TimePicker } from '../flow/time-picker'
import type { RulesEditorProps } from './types'

/*
 * 四个固定板块的规则面板（目标设置页、新人引导共用）。每个面板只改自己板块的阈值，
 * 改完由调用方 PATCH /goals/{goalId} 的 refereeRules；「我的小目标」的面板在 custom/ 里。
 */

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-tiny text-subtle leading-snug">{children}</p>
}

export function DietRulesEditor({ rules, onChange }: RulesEditorProps<'diet'>) {
  return (
    <div className="flex flex-col gap-2">
      <InlineRow label="有效线">
        <NumberField
          size="sm"
          ariaLabel="有效分数线"
          unit="分"
          min={1}
          max={4.5}
          step={0.5}
          value={rules.passScore}
          onValueChange={(v) => onChange({ ...rules, passScore: v ?? 3 })}
        />
      </InlineRow>
      <Hint>Agent 评分高于这个分数才算有效（满分 5 分），默认 3.0。</Hint>
    </div>
  )
}

export function ExerciseRulesEditor({ rules, onChange }: RulesEditorProps<'exercise'>) {
  const num = (k: keyof typeof rules, label: string, unit: string, step = 1, max = 300) => (
    <InlineRow label={label}>
      <NumberField
        size="sm"
        ariaLabel={label}
        unit={unit}
        min={step < 1 ? 0.1 : 1}
        max={max}
        step={step}
        value={rules[k] as number}
        onValueChange={(v) => v !== null && onChange({ ...rules, [k]: v })}
      />
    </InlineRow>
  )
  return (
    <div className="flex flex-col gap-2">
      <span className="text-tiny text-muted font-semibold">跑、走、骑、游（任一达标）</span>
      {num('distanceMinMinutes', '时长', '分钟')}
      {num('distanceMinKm', '距离', '公里', 0.5, 100)}
      <span className="text-tiny text-muted pt-1 font-semibold">力量、核心（任一达标）</span>
      {num('countMinMinutes', '时长', '分钟')}
      {num('countMinSets', '组数', '组', 1, 50)}
    </div>
  )
}

const HOUR_OPTIONS = [6, 6.5, 7, 7.5, 8] as const

export function SleepRulesEditor({ rules, onChange }: RulesEditorProps<'sleep'>) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1">
        <span className="text-tiny text-muted font-semibold">几点前睡（入睡红线）</span>
        <TimePicker
          label="入睡红线"
          tone="sleep"
          value={rules.bedtimeBy}
          onChange={(bedtimeBy) => onChange({ ...rules, bedtimeBy })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-tiny text-muted font-semibold">至少睡几个小时</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="最短睡眠时长">
          {HOUR_OPTIONS.map((h) => (
            <button
              key={h}
              type="button"
              role="radio"
              aria-checked={rules.minHours === h}
              onClick={() =>
                onChange({ ...rules, minHours: h, maxHours: Math.max(rules.maxHours, h + 1) })
              }
              className={cn(
                'text-tiny min-h-8 rounded-full border px-3 font-semibold transition-colors',
                rules.minHours === h
                  ? 'border-sleep bg-sleep-soft text-sleep-ink'
                  : 'border-border text-muted hover:text-foreground',
              )}
            >
              {h} 小时
            </button>
          ))}
        </div>
      </div>
      <Hint>入睡不晚于红线、且睡够时长才算早睡；睡超过 {rules.maxHours} 小时也不算有效。</Hint>
    </div>
  )
}

export function StudyRulesEditor({ rules, onChange }: RulesEditorProps<'study'>) {
  return (
    <div className="flex flex-col gap-2">
      <InlineRow label="专注">
        <NumberField
          size="sm"
          ariaLabel="每天至少专注"
          unit="分钟"
          min={1}
          max={240}
          step={5}
          value={rules.minFocusMinutes}
          onValueChange={(v) => v !== null && onChange({ ...rules, minFocusMinutes: v })}
        />
      </InlineRow>
      <InlineRow label="要点">
        <NumberField
          size="sm"
          ariaLabel="要点至少字数"
          unit="字"
          min={0}
          max={200}
          step={5}
          value={rules.minNoteChars}
          onValueChange={(v) => v !== null && onChange({ ...rules, minNoteChars: v })}
        />
      </InlineRow>
      <Hint>同一天的碎片学习会累加；要点还要被 Agent 判定为有实质内容。</Hint>
    </div>
  )
}
