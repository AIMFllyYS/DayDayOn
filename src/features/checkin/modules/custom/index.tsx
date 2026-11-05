'use client'

import { useState } from 'react'
import type { IconName } from '@/components/ui/icon'
import { Input } from '@/components/ui/field'
import { buildSchema } from '@/features/goal/build-schema'
import { FieldControl } from '@/features/goal/components/schema-form'
import type { FieldDef, FieldValue, FieldValues } from '@/features/goal/schemas'
import { conditionText } from '@/features/referee/rules/custom'
import type { RulesOf, Verdict } from '@/features/referee/schemas'
import type { CheckinGoal } from '../../components/form-types'
import type { CreateCheckinInput } from '../../schemas'
import type { SmartRecognitionDraft } from '../../smart-schemas'
import type { FillSectionSpec, ReportSpec } from '../../flow/types'
import type { CheckinModuleDef, ModuleDocs, ModuleFormApi, ModuleFormProps } from '../types'

/*
 * 我的小目标（Playbook custom-flow）：用户在目标设置里拼好的字段，每个字段一个分区；
 * 达标条件也在目标设置里定，这里只填值。字段与条件的编辑器在 goal 领域（目标设置页）。
 */

const ICON_OF: Record<FieldDef['type'], IconName> = {
  number: 'diet',
  text: 'pen',
  'single-select': 'check',
  'multi-select': 'check-double',
  boolean: 'check',
  duration: 'clock',
  rating: 'smile',
}

function display(field: FieldDef, v: FieldValue | undefined): string | null {
  if (v === undefined) return null
  if (Array.isArray(v)) return v.join('、')
  if (typeof v === 'boolean') return v ? '是' : '否'
  if (field.type === 'duration' && typeof v === 'number') return `${Math.round(v / 60)} 分钟`
  if (field.type === 'rating') return `${String(v)} 星`
  if (field.type === 'number') return `${String(v)}${field.unit ? ` ${field.unit}` : ''}`
  return String(v)
}

function useCustomForm({ goal }: ModuleFormProps): ModuleFormApi {
  const fields = goal.fields ?? []
  const [values, setValues] = useState<FieldValues>({})
  const [note, setNote] = useState('')
  const parsed = buildSchema(fields).safeParse(values)
  const filled = fields.filter((f) => values[f.key] !== undefined)

  const sections: FillSectionSpec[] = [
    ...fields.map((f) => ({
      id: `field-${f.key}`,
      label: f.label,
      icon: ICON_OF[f.type],
      filled: values[f.key] !== undefined,
      summary: display(f, values[f.key]) ?? (f.required ? '必填' : '可选'),
      content: (
        <FieldControl
          id={`cf-${f.key}`}
          field={f}
          value={values[f.key]}
          invalid={false}
          onChange={(v) => setValues((cur) => ({ ...cur, [f.key]: v }))}
        />
      ),
    })),
    {
      id: 'note',
      label: '备注',
      icon: 'pen' as const,
      filled: note.length > 0,
      summary: note || '可选',
      content: (
        <Input
          aria-label="备注"
          value={note}
          maxLength={200}
          placeholder="想记点什么都可以"
          onChange={(e) => setNote(e.target.value)}
        />
      ),
    },
  ]

  return {
    sections,
    canSubmit: goal.fieldVersion !== null && parsed.success && filled.length > 0,
    aiSummary: filled.map((f) => `${f.label} ${display(f, values[f.key])}`).join(' · '),
    toInput: () => customInput(values, note),
    applySmart: (draft: SmartRecognitionDraft) => {
      const d = draft.custom
      if (!d) return null
      const known = new Set(fields.map((f) => f.key))
      const next = Object.fromEntries(Object.entries(d.values).filter(([k]) => known.has(k)))
      setValues(next)
      if (d.note) setNote(d.note)
      return customInput(next, d.note ?? note)
    },
  }

  function customInput(v: FieldValues, n: string): CreateCheckinInput | null {
    const p = buildSchema(fields).safeParse(v)
    if (!p.success || goal.fieldVersion === null) return null
    const clean = Object.fromEntries(
      Object.entries(p.data).filter((e): e is [string, FieldValue] => e[1] !== undefined),
    )
    if (Object.keys(clean).length === 0) return null
    return {
      module: 'custom',
      fieldVersion: goal.fieldVersion,
      values: clean,
      note: n.trim() || null,
    }
  }
}

function buildCustomReport(
  verdict: Verdict,
  input: CreateCheckinInput,
  goal: CheckinGoal,
): ReportSpec {
  const facts = verdict.facts?.module === 'custom' ? verdict.facts : null
  const values = input.module === 'custom' ? input.values : {}
  const labelOf = new Map((goal.fields ?? []).map((f) => [f.key, f]))
  return {
    title: `小目标分析 · ${verdict.isValid ? '达标' : '诚实存档'}`,
    folders: [
      {
        id: 'checks',
        title: '达标条件',
        icon: 'shield',
        tone: 'custom',
        defaultOpen: true,
        headline: verdict.detail,
        badge: verdict.isValid
          ? { text: '达标', tone: 'success' }
          : { text: '未达标', tone: 'warning' },
        checks: verdict.checks.map((c) => ({ text: c.text, ok: c.ok, source: c.source })),
      },
      {
        id: 'values',
        title: '这次填了',
        icon: 'pen',
        tone: 'primary',
        headline: `${Object.keys(values).length} 项`,
        rows: Object.entries(values).map(([k, v]) => {
          const f = labelOf.get(k)
          return {
            label: f?.label ?? k,
            value: (f ? display(f, v) : null) ?? (Array.isArray(v) ? v.join('、') : String(v)),
          }
        }),
      },
      ...(facts?.aiComment
        ? [
            {
              id: 'ai',
              title: 'Agent 判卷',
              icon: 'sparkles' as const,
              tone: 'study' as const,
              headline: facts.aiComment,
            },
          ]
        : []),
    ],
  }
}

function customDocs(rules: RulesOf<'custom'>, goal: CheckinGoal): ModuleDocs {
  const byKey = new Map((goal.fields ?? []).map((f) => [f.key, f]))
  const conds = rules.conditions.flatMap((c) => {
    const f = byKey.get(c.key)
    return f ? [conditionText({ key: f.key, label: f.label, type: f.type }, c)] : []
  })
  return {
    glance: {
      threshold:
        conds.length > 0 || rules.aiCriteria
          ? `全部满足才盖章：${[...conds, ...(rules.aiCriteria ? [rules.aiCriteria] : [])].join('；')}`
          : '还没设达标条件：填了就算，去「目标设置」里加条件',
      tagline: '独立期限 + 自拼字段 + 自定义裁判',
      pass: '戒糖饮水：温水 7 杯 + 含糖饮料 0 杯',
      block: '喝水 7 杯但加了 1 杯全糖奶茶，诚实存档',
    },
    rulesDoc: {
      title: '达标规则',
      sections: [
        {
          heading: '你定的条件',
          items: conds.length > 0 ? conds : ['还没有条件：填了任意一项就算有效'],
        },
        ...(rules.aiCriteria
          ? [{ heading: '判卷标准', items: [rules.aiCriteria, '由 Agent 按这句话判断'] }]
          : []),
        {
          heading: '没达标怎么办',
          items: ['照常保存，诚实存档，不盖章', '条件在「我的 → 目标设置」里改'],
        },
      ],
    },
    basisDoc: {
      title: '评判依据',
      sections: [
        {
          heading: '怎么判',
          items: [
            '数值、时长、评分按你定的比较方式逐条核验',
            '文字类的判卷标准交给 Agent，它会说明理由',
          ],
        },
      ],
    },
  }
}

export const customModule: CheckinModuleDef<'custom'> = {
  module: 'custom',
  tone: 'custom',
  title: '我的小目标',
  agentSteps: ['读取你填的内容', '对照你定的条件', '按判卷标准核对'],
  useForm: useCustomForm,
  docs: customDocs,
  buildReport: buildCustomReport,
}
