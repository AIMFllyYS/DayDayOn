import type { FactsOf, RulesOf, Verdict, CustomCondition } from '../schemas'
import { buildVerdict, hhmmToMinutes, type JudgeContext } from './common'

/*
 * 我的小目标：用户自己拼字段、自己定条件（Playbook custom-flow）。
 * 每条条件对一个字段比较；全部满足才有效。设了 aiCriteria 时，Agent 判卷不通过也算未达标。
 * 一条条件都没设时，填了任意字段就算有效（诚实打卡）。
 */

export type CustomValue = number | string | string[] | boolean

export interface CustomFieldBrief {
  key: string
  label: string
  type: string
  unit?: string
}

export interface CustomSubject {
  fields: CustomFieldBrief[]
  values: Record<string, CustomValue | undefined>
}

const OP_SYM = { gte: '≥', lte: '≤', eq: '=' } as const

function isFilled(v: CustomValue | undefined): boolean {
  if (v === undefined) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (Array.isArray(v)) return v.length > 0
  return true
}

/** 字段值 → 用来比较的数：时长按分钟，时间点按当天分钟，列表按条数，布尔按 0/1 */
function comparable(field: CustomFieldBrief, v: CustomValue | undefined): number | null {
  if (v === undefined) return null
  if (typeof v === 'number') return field.type === 'duration' ? v / 60 : v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (Array.isArray(v)) return v.length
  if (field.type === 'time') return hhmmToMinutes(v)
  return null
}

function targetOf(field: CustomFieldBrief, c: CustomCondition): number | null {
  if (c.value === undefined) return null
  if (typeof c.value === 'number') return c.value
  return field.type === 'time' ? hhmmToMinutes(c.value) : null
}

function unitOf(field: CustomFieldBrief): string {
  if (field.type === 'duration') return '分钟'
  if (field.type === 'rating') return '星'
  if (field.type === 'points' || field.type === 'multi-select') return '条'
  return field.unit ?? ''
}

export function conditionText(field: CustomFieldBrief, c: CustomCondition): string {
  if (c.op === 'filled') return `${field.label} 已填写`
  if (field.type === 'time' && typeof c.value === 'string') {
    return `${field.label} ${c.op === 'gte' ? '不早于' : c.op === 'lte' ? '不晚于' : '正好'} ${c.value}`
  }
  if (field.type === 'boolean') return `${field.label}：${c.value === 0 ? '否' : '是'}`
  return `${field.label} ${OP_SYM[c.op]} ${String(c.value ?? '')} ${unitOf(field)}`.trim()
}

function evalCondition(field: CustomFieldBrief, v: CustomValue | undefined, c: CustomCondition) {
  if (c.op === 'filled') return isFilled(v)
  const actual = comparable(field, v)
  const target = targetOf(field, c)
  if (actual === null || target === null) return false
  if (c.op === 'gte') return actual >= target
  if (c.op === 'lte') return actual <= target
  return actual === target
}

export function judgeCustom(
  subject: CustomSubject,
  ctx: JudgeContext<RulesOf<'custom'>, FactsOf<'custom'>>,
): Verdict {
  const { rules, facts, extras } = ctx
  const byKey = new Map(subject.fields.map((f) => [f.key, f]))
  const checks = rules.conditions.flatMap((c, i) => {
    const field = byKey.get(c.key)
    if (!field) return []
    return [
      {
        id: `cond-${i}`,
        text: conditionText(field, c),
        ok: evalCondition(field, subject.values[c.key], c),
      },
    ]
  })
  const anyFilled = subject.fields.some((f) => isFilled(subject.values[f.key]))
  const ai = rules.aiCriteria && facts ? facts.aiPass : null
  if (rules.aiCriteria) {
    checks.push({
      id: 'ai',
      text: `判卷标准：${rules.aiCriteria}`,
      ok: ai !== false,
      ...(facts?.aiComment ? { source: facts.aiComment } : {}),
    })
  }
  const ruleChecks = checks.filter((c) => c.id !== 'ai')
  const rulesOk = ruleChecks.length > 0 ? ruleChecks.every((c) => c.ok) : anyFilled
  const isValid = rulesOk && ai !== false
  const failed = checks.filter((c) => !c.ok)

  return buildVerdict({
    isValid,
    detail: isValid
      ? checks.length > 0
        ? `${checks.length} 项条件全部满足`
        : '已记录，没有设置达标条件'
      : failed.length > 0
        ? `还差：${failed.map((c) => c.text).join('；')}`
        : '还没有填写任何内容',
    checks,
    metrics: {
      conditions: checks.length,
      passed: checks.length - failed.length,
      filled: subject.fields.filter((f) => isFilled(subject.values[f.key])).length,
    },
    facts,
    advice: failed.length > 0 ? [`先补上「${failed[0]!.text}」再盖章`] : [],
    extras,
  })
}
