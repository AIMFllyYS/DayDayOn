'use client'

import { useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { IconTile } from '@/components/ui/badge'
import { Icon, type IconName } from '@/components/ui/icon'
import { Input } from '@/components/ui/field'
import { NumberField } from '@/components/ui/number-field'
import { Rating, type RatingValue } from '@/components/ui/rating'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { moduleMeta, type ModuleTone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
import { FieldRow } from '../../_components/flow/fill-section'
import { FlowStage } from '../../_components/flow/flow-stage'
import type {
  FillSectionSpec,
  FlowMode,
  FlowScenario,
  FolderSpec,
  PhoneFlowConfig,
  ReportCheck,
  ReportSpec,
  Verdict,
} from '../../_components/flow/flow-types'
import { PhoneFlow } from '../../_components/flow/phone-flow'
import { TimePicker } from '../../_components/flow/time-picker'
import { InlineRow, PointsEditor } from '../../study/_components/study-flow'
import { CustomRefereeComparisonMatrix, CustomGoalRuleDesignerDemo } from './custom-module-demos'

/**
 * 我的小目标 = 自己拼的打卡。
 * 第一性原理：一个打卡 = 若干「填什么」（组件）+ 「怎么算达标」（条件）+ 一个周期。
 * 前面饮食 / 运动 / 睡眠 / 学习四个板块，其实就是几种固定好的组件组合：
 *   数量（吃了几份、喝了几杯、跑了几公里）· 时长（运动、专注）· 内容 + 常用标签（吃了什么、运动内容、学习主题）
 *   · 时间点（入睡、起床）· 评分（睡得怎么样）· 要点（逐条收获）
 * 右上角「设置」里可以从模板开始，也可以自己加减这些组件、给每个组件定达标条件。
 */
type Kind = 'count' | 'duration' | 'text' | 'time' | 'rating' | 'points'
type Cmp = 'gte' | 'lte' | 'eq'
type TemplateId = 'water' | 'diet' | 'exercise' | 'sleep' | 'study'

interface Block {
  id: string
  kind: Kind
  label: string
  unit: string
  /** 是否作为达标条件 */
  ruled: boolean
  cmp: Cmp
  target: number
  /** 时间点的达标时刻 */
  timeTarget: string
  /** 内容类的常用选项 */
  favs: string[]
}

interface Goal {
  name: string
  template: TemplateId
  blocks: Block[]
}

type Val = number | string | null
type Values = Record<string, Val>

function blk(id: string, kind: Kind, label: string, p: Partial<Block> = {}): Block {
  return {
    id,
    kind,
    label,
    unit: '',
    ruled: true,
    cmp: 'gte',
    target: 1,
    timeTarget: '23:30',
    favs: [],
    ...p,
  }
}

interface Template {
  id: TemplateId
  label: string
  desc: string
  tone: ModuleTone
  name: string
  make: () => Block[]
}

const TEMPLATES: Template[] = [
  {
    id: 'water',
    label: '数量打卡',
    desc: '喝水、做题等计数',
    tone: 'custom',
    name: '戒糖饮水挑战',
    make: () => [
      blk('water', 'count', '温水', { unit: '杯', cmp: 'gte', target: 6 }),
      blk('sugar', 'count', '含糖饮料', { unit: '杯', cmp: 'eq', target: 0 }),
    ],
  },
  {
    id: 'diet',
    label: '饮食型',
    desc: '吃了什么 + 数量',
    tone: 'diet',
    name: '清淡饮食挑战',
    make: () => [
      blk('d-text', 'text', '吃了什么', { favs: ['糙米饭', '清蒸鱼', '青菜', '燕麦粥'] }),
      blk('d-veg', 'count', '蔬菜', { unit: '份', cmp: 'gte', target: 2 }),
      blk('d-sugar', 'count', '含糖饮料', { unit: '杯', cmp: 'eq', target: 0 }),
    ],
  },
  {
    id: 'exercise',
    label: '运动型',
    desc: '运动内容 + 时长',
    tone: 'exercise',
    name: '每日运动挑战',
    make: () => [
      blk('e-text', 'text', '运动内容', { favs: ['慢跑', '快走', '深蹲', '骑行'] }),
      blk('e-min', 'duration', '运动时长', { unit: '分钟', cmp: 'gte', target: 20 }),
      blk('e-km', 'count', '距离', { unit: '公里', cmp: 'gte', target: 2, ruled: false }),
    ],
  },
  {
    id: 'sleep',
    label: '睡眠型',
    desc: '入睡起床 + 评分',
    tone: 'sleep',
    name: '早睡早起挑战',
    make: () => [
      blk('s-bed', 'time', '入睡时间', { cmp: 'lte', timeTarget: '23:30' }),
      blk('s-wake', 'time', '起床时间', { cmp: 'lte', timeTarget: '07:30' }),
      blk('s-rate', 'rating', '睡得怎么样', { cmp: 'gte', target: 3 }),
    ],
  },
  {
    id: 'study',
    label: '学习型',
    desc: '主题 + 时长 + 要点',
    tone: 'study',
    name: '每日学习挑战',
    make: () => [
      blk('l-text', 'text', '学习主题', { favs: ['算法', '数学', '英语'] }),
      blk('l-min', 'duration', '专注时长', { unit: '分钟', cmp: 'gte', target: 25 }),
      blk('l-pts', 'points', '要点', { target: 1 }),
    ],
  },
]

interface PaletteItem {
  kind: Kind
  name: string
  from: string
  tone: ModuleTone
  icon: IconName
  make: (id: string) => Block
}

const PALETTE: PaletteItem[] = [
  {
    kind: 'count',
    name: '数量',
    from: '饮食 · 运动',
    tone: 'diet',
    icon: 'diet',
    make: (id) => blk(id, 'count', '数量', { unit: '次', cmp: 'gte', target: 1 }),
  },
  {
    kind: 'duration',
    name: '时长',
    from: '运动 · 学习',
    tone: 'exercise',
    icon: 'exercise',
    make: (id) => blk(id, 'duration', '时长', { unit: '分钟', cmp: 'gte', target: 20 }),
  },
  {
    kind: 'text',
    name: '内容 + 常用标签',
    from: '饮食 · 运动 · 学习',
    tone: 'study',
    icon: 'pen',
    make: (id) => blk(id, 'text', '内容', { favs: [] }),
  },
  {
    kind: 'time',
    name: '时间点',
    from: '睡眠',
    tone: 'sleep',
    icon: 'clock',
    make: (id) => blk(id, 'time', '时间点', { cmp: 'lte', timeTarget: '23:30' }),
  },
  {
    kind: 'rating',
    name: '评分',
    from: '睡眠',
    tone: 'sleep',
    icon: 'smile',
    make: (id) => blk(id, 'rating', '状态评分', { cmp: 'gte', target: 3 }),
  },
  {
    kind: 'points',
    name: '逐条要点',
    from: '学习',
    tone: 'study',
    icon: 'bulb',
    make: (id) => blk(id, 'points', '要点', { target: 1 }),
  },
]

const KIND_META: Record<Kind, { icon: IconName; tone: ModuleTone; name: string }> = {
  count: { icon: 'diet', tone: 'diet', name: '数量' },
  duration: { icon: 'exercise', tone: 'exercise', name: '时长' },
  text: { icon: 'pen', tone: 'study', name: '内容' },
  time: { icon: 'clock', tone: 'sleep', name: '时间点' },
  rating: { icon: 'smile', tone: 'sleep', name: '评分' },
  points: { icon: 'bulb', tone: 'study', name: '要点' },
}

const CMP_SYM: Record<Cmp, string> = { gte: '≥', lte: '≤', eq: '=' }

function toMin(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

function fromMin(total: number): string {
  const t = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

function pointsOf(v: Val): string[] {
  return typeof v === 'string'
    ? v
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean)
    : []
}

function ruleText(b: Block): string {
  switch (b.kind) {
    case 'count':
    case 'duration':
      return `${b.label} ${CMP_SYM[b.cmp]} ${b.target} ${b.unit}`.trim()
    case 'time':
      return `${b.label} ${b.cmp === 'gte' ? '不早于' : '不晚于'} ${b.timeTarget}`
    case 'rating':
      return `${b.label} ≥ ${b.target} 星`
    case 'points':
      return `${b.label} ≥ ${b.target} 条`
    default:
      return `${b.label} 已填写`
  }
}

interface BlockResult {
  filled: boolean
  ok: boolean
  actual: string
  gap: string
  ratio: number | null
}

function evalBlock(b: Block, v: Val): BlockResult {
  if (b.kind === 'count' || b.kind === 'duration') {
    const n = typeof v === 'number' ? v : null
    if (n === null) return { filled: false, ok: false, actual: '—', gap: '', ratio: null }
    const ok = b.cmp === 'gte' ? n >= b.target : b.cmp === 'lte' ? n <= b.target : n === b.target
    const gap = ok
      ? ''
      : b.cmp === 'gte'
        ? `还差 ${b.target - n} ${b.unit}`
        : b.cmp === 'lte'
          ? `超出 ${n - b.target} ${b.unit}`
          : `需要正好 ${b.target} ${b.unit}`
    const ratio = b.cmp === 'gte' ? (b.target > 0 ? Math.min(1, n / b.target) : 1) : ok ? 1 : 0.2
    return { filled: true, ok, actual: `${n} ${b.unit}`.trim(), gap, ratio }
  }
  if (b.kind === 'time') {
    const s = typeof v === 'string' ? v : ''
    const m = toMin(s)
    const tm = toMin(b.timeTarget)
    if (m === null || tm === null)
      return { filled: false, ok: false, actual: '—', gap: '', ratio: null }
    const ok = b.cmp === 'gte' ? m >= tm : m <= tm
    const gap = ok ? '' : b.cmp === 'gte' ? `早了 ${tm - m} 分钟` : `晚了 ${m - tm} 分钟`
    return { filled: true, ok, actual: s, gap, ratio: null }
  }
  if (b.kind === 'rating') {
    const n = typeof v === 'number' ? v : null
    if (n === null) return { filled: false, ok: false, actual: '—', gap: '', ratio: null }
    const ok = n >= b.target
    return {
      filled: true,
      ok,
      actual: `${n} 星`,
      gap: ok ? '' : `还差 ${b.target - n} 星`,
      ratio: n / 5,
    }
  }
  if (b.kind === 'points') {
    const n = pointsOf(v).length
    const ok = n >= b.target
    return {
      filled: n > 0,
      ok,
      actual: `${n} 条`,
      gap: ok ? '' : `还差 ${b.target - n} 条`,
      ratio: b.target > 0 ? Math.min(1, n / b.target) : 1,
    }
  }
  const s = typeof v === 'string' ? v.trim() : ''
  return { filled: s.length > 0, ok: s.length > 0, actual: s || '—', gap: '', ratio: null }
}

function evaluate(goal: Goal, values: Values) {
  const results = goal.blocks.map((b) => ({ b, r: evalBlock(b, values[b.id] ?? null) }))
  const ruled = results.filter((x) => x.b.ruled)
  const passed = ruled.length > 0 && ruled.every((x) => x.r.ok)
  const ready = ruled.length > 0 ? ruled.every((x) => x.r.filled) : results.some((x) => x.r.filled)
  return { results, ruled, passed, ready }
}

interface Scenario extends FlowScenario {
  /** 默认「戒糖饮水」模板下的取值；换了组件后缺的取值由系统模拟 */
  values: Values
}

const SCENARIOS: Scenario[] = [
  {
    id: 'a',
    code: 'A',
    title: '全部达标',
    description:
      '默认的戒糖饮水：温水 7 杯、含糖 0 杯，两条条件都满足；换成别的类型也会自动模拟一组达标数据。',
    passed: true,
    values: { water: 7, sugar: 0 },
  },
  {
    id: 'b',
    code: 'B',
    title: '踩了红线',
    description: '水喝够了，但下午喝了 1 杯全糖奶茶：违反「含糖 = 0」。',
    passed: false,
    values: { water: 7, sugar: 1 },
  },
  {
    id: 'c',
    code: 'C',
    title: '差一点',
    description: '只喝了 4 杯，含糖 0：没达到「温水 ≥ 6 杯」。',
    passed: false,
    values: { water: 4, sugar: 0 },
  },
  {
    id: 'd',
    code: 'D',
    title: '超额完成',
    description: '温水 8 杯，含糖 0：超额完成。',
    passed: true,
    values: { water: 8, sugar: 0 },
  },
]

/** 没有现成取值的组件，按场景模拟一个：通过的场景全部满足，没通过的让第一条条件不满足 */
function mockValue(b: Block, bad: boolean): Val {
  switch (b.kind) {
    case 'count':
    case 'duration': {
      const step = b.kind === 'duration' ? 5 : 1
      if (b.cmp === 'gte') return bad ? Math.max(0, b.target - step * 2) : b.target + step
      if (b.cmp === 'lte') return bad ? b.target + step : Math.max(0, b.target - 0)
      return bad ? b.target + 1 : b.target
    }
    case 'time': {
      const tm = toMin(b.timeTarget) ?? 0
      const delta = b.cmp === 'gte' ? 15 : -15
      return fromMin(bad ? tm - delta * 3 : tm + delta)
    }
    case 'rating':
      return bad ? Math.max(1, b.target - 1) : Math.min(5, Math.max(b.target, 4))
    case 'points': {
      const n = bad ? Math.max(0, b.target - 1) : Math.max(b.target, 1)
      return Array.from({ length: n }, (_, i) => `今天的收获 ${i + 1}`).join('\n')
    }
    default:
      return b.favs[0] ?? '今日内容'
  }
}

function scenarioValues(sc: Scenario, goal: Goal): Values {
  const out: Values = {}
  let violated = sc.passed
  for (const b of goal.blocks) {
    if (sc.values[b.id] !== undefined) {
      out[b.id] = sc.values[b.id] ?? null
      continue
    }
    const bad = !violated && b.ruled && b.kind !== 'text'
    if (bad) violated = true
    out[b.id] = mockValue(b, bad)
  }
  return out
}

const TOTAL_DAYS = 21
const START_DONE = 5

const CONFIG: PhoneFlowConfig = {
  tone: 'custom',
  title: '自定义目标打卡',
  progress: { done: START_DONE, total: TOTAL_DAYS },
  agentSteps: [
    '读取你的目标设置和今天填的内容',
    '查看这个目标的周期和已打卡天数',
    '逐项对照你定的达标条件',
    '生成分析结果',
  ],
  rulesDoc: {
    title: '达标规则',
    sections: [{ heading: '自己定规则', items: ['每个目标独立设置达标条件'] }],
  },
  basisDoc: {
    title: '评判依据',
    sections: [{ heading: '裁判怎么判', items: ['按你设定的条件逐项打勾，全部满足才算有效'] }],
  },
}

function buildReport(goal: Goal, values: Values): ReportSpec {
  const e = evaluate(goal, values)
  const okCount = e.ruled.filter((x) => x.r.ok).length
  const done = e.passed ? START_DONE + 1 : START_DONE

  const conditions: FolderSpec = {
    id: 'conditions',
    defaultOpen: true,
    title: '规则逐项',
    icon: 'check-double',
    tone: 'custom',
    headline: e.ruled.length ? `${okCount}/${e.ruled.length} 条满足` : '还没有设置达标条件',
    badge: { text: e.passed ? '达标' : '未达标', tone: e.passed ? 'success' : 'warning' },
    children: e.ruled.map(({ b, r }) => ({
      id: `c-${b.id}`,
      defaultOpen: true,
      title: ruleText(b),
      icon: KIND_META[b.kind].icon,
      tone: KIND_META[b.kind].tone,
      headline: `今天 ${r.actual}`,
      badge: {
        text: r.ok ? '达成' : '未达成',
        tone: r.ok ? ('success' as const) : ('warning' as const),
      },
      rows: [
        { label: '目标', value: ruleText(b).replace(`${b.label} `, '') },
        {
          label: '实际',
          value: r.actual,
          ...(r.ratio !== null ? { ratio: r.ratio } : {}),
          tone: r.ok ? ('success' as const) : ('warning' as const),
        },
        ...(r.gap ? [{ label: '差距', value: r.gap }] : []),
      ],
    })),
    note: '每一条都是你自己设定的条件，全部满足才盖有效章。',
  }

  const records = e.results.filter(
    (x) => !x.b.ruled || x.b.kind === 'text' || x.b.kind === 'points',
  )
  const recordFolder: FolderSpec | null = records.length
    ? {
        id: 'records',
        defaultOpen: true,
        title: '今日记录',
        icon: 'pen',
        tone: 'study',
        headline: `${records.filter((x) => x.r.filled).length}/${records.length} 项已记录`,
        rows: records.map(({ b, r }) => ({
          label: b.label,
          value: b.kind === 'points' ? pointsOf(values[b.id]).join('；') || '—' : r.actual,
        })),
      }
    : null

  const cycle: FolderSpec = {
    id: 'cycle',
    title: '周期进度',
    icon: 'calendar',
    tone: 'primary',
    headline: `第 ${done} / ${TOTAL_DAYS} 天`,
    rows: [
      {
        label: '有效天数',
        value: `${done} 天`,
        ratio: done / TOTAL_DAYS,
        tone: 'custom',
        sub: `剩余 ${TOTAL_DAYS - done} 天`,
      },
    ],
  }

  const checks: ReportCheck[] = [
    ...e.ruled.map(({ b, r }) => ({ text: ruleText(b), ok: r.ok })),
    { text: '识别数据与手填一致', ok: true, source: '你上传的照片或文本' },
  ]
  const checkFolder: FolderSpec = {
    id: 'checks',
    title: '校验清单',
    icon: 'shield',
    headline: `${checks.filter((c) => c.ok).length}/${checks.length} 项通过`,
    checks,
  }

  return {
    title: '目标分析',
    folders: [conditions, ...(recordFolder ? [recordFolder] : []), cycle, checkFolder],
  }
}

/** 时间点字段：一个时间格，点开在下面展开我们自己的时间选择器 */
function TimeField({
  value,
  onChange,
  fallback,
  label,
}: {
  value: string
  onChange: (v: string) => void
  fallback: string
  label: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          if (!open && !value) onChange(fallback)
          setOpen((o) => !o)
        }}
        className={cn(
          'text-caption flex min-h-9 items-center justify-between gap-2 rounded-lg border px-3 font-semibold tabular-nums transition-colors',
          open
            ? 'border-primary bg-primary-soft text-primary-ink'
            : 'border-border bg-surface-sunken',
        )}
      >
        <span>{value || '--:--'}</span>
        <Icon name="clock" size={14} />
      </button>
      {open && (
        <div className="animate-fade-up">
          <TimePicker label={label} value={value || fallback} onChange={onChange} />
        </div>
      )}
    </div>
  )
}

/** 设置页里的小开关 */
function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-6 w-10 shrink-0 rounded-full transition-colors',
        on ? 'bg-primary' : 'bg-border-strong',
      )}
    >
      <span
        className={cn(
          'bg-surface absolute top-0.5 size-5 rounded-full shadow-sm transition-all',
          on ? 'left-[1.1rem]' : 'left-0.5',
        )}
      />
    </button>
  )
}

function SettingGroup({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <h3 className="text-caption font-bold">{title}</h3>
        {hint && <span className="text-tiny text-subtle">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

/** 一个组件的设置卡：名称、单位、是否作为达标条件及具体条件 */
function BlockCard({
  b,
  onChange,
  onRemove,
}: {
  b: Block
  onChange: (p: Partial<Block>) => void
  onRemove: () => void
}) {
  const meta = KIND_META[b.kind]
  const hasUnit = b.kind === 'count' || b.kind === 'duration'
  return (
    <div className="border-border bg-surface flex flex-col gap-2.5 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <IconTile icon={meta.icon} tone={meta.tone} size="sm" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Input
            aria-label="组件名称"
            value={b.label}
            onChange={(ev) => onChange({ label: ev.target.value })}
          />
        </div>
        <span className="text-tiny text-subtle shrink-0">{meta.name}</span>
        <button
          type="button"
          aria-label={`删除${b.label}`}
          onClick={onRemove}
          className="text-subtle hover:text-danger-ink grid size-7 shrink-0 place-items-center rounded-full"
        >
          <Icon name="trash" size={14} />
        </button>
      </div>

      {hasUnit && (
        <InlineRow label="单位">
          <Input
            aria-label="单位"
            value={b.unit}
            placeholder="例如：杯、分钟"
            onChange={(ev) => onChange({ unit: ev.target.value })}
          />
        </InlineRow>
      )}

      {b.kind === 'text' && (
        <InlineRow label="常用选项">
          <Input
            aria-label="常用选项"
            value={b.favs.join('、')}
            placeholder="用顿号分隔，如：慢跑、深蹲"
            onChange={(ev) =>
              onChange({
                favs: ev.target.value
                  .split(/[、,，]/)
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
          />
        </InlineRow>
      )}

      <div className="border-border flex items-center justify-between gap-2 border-t pt-2.5">
        <span className="text-tiny font-semibold">作为达标条件</span>
        <Toggle
          on={b.ruled}
          onChange={(ruled) => onChange({ ruled })}
          label={`${b.label}作为达标条件`}
        />
      </div>

      {b.ruled && (
        <div className="bg-surface-sunken animate-fade-up flex flex-col gap-2.5 rounded-lg p-2.5">
          {(b.kind === 'count' || b.kind === 'duration') && (
            <>
              <SegmentedControl
                size="sm"
                label="比较方式"
                value={b.cmp}
                onValueChange={(cmp) => onChange({ cmp })}
                options={[
                  { value: 'gte', label: '至少 ≥' },
                  { value: 'lte', label: '最多 ≤' },
                  { value: 'eq', label: '正好 =' },
                ]}
              />
              <InlineRow label="目标">
                <NumberField
                  size="sm"
                  ariaLabel="目标数值"
                  unit={b.unit}
                  min={0}
                  max={9999}
                  step={1}
                  value={b.target}
                  onValueChange={(v) => onChange({ target: v ?? 0 })}
                />
              </InlineRow>
            </>
          )}
          {b.kind === 'time' && (
            <>
              <SegmentedControl
                size="sm"
                label="比较方式"
                value={b.cmp === 'gte' ? 'gte' : 'lte'}
                onValueChange={(cmp) => onChange({ cmp })}
                options={[
                  { value: 'lte', label: '不晚于' },
                  { value: 'gte', label: '不早于' },
                ]}
              />
              <InlineRow label="时刻">
                <TimeField
                  label={`${b.label}达标时刻`}
                  value={b.timeTarget}
                  fallback="23:30"
                  onChange={(timeTarget) => onChange({ timeTarget })}
                />
              </InlineRow>
            </>
          )}
          {b.kind === 'rating' && (
            <InlineRow label="至少">
              <NumberField
                size="sm"
                ariaLabel="至少几星"
                unit="星"
                min={1}
                max={5}
                step={1}
                value={b.target}
                onValueChange={(v) => onChange({ target: v ?? 1 })}
              />
            </InlineRow>
          )}
          {b.kind === 'points' && (
            <InlineRow label="至少">
              <NumberField
                size="sm"
                ariaLabel="至少几条"
                unit="条"
                min={1}
                max={20}
                step={1}
                value={b.target}
                onValueChange={(v) => onChange({ target: v ?? 1 })}
              />
            </InlineRow>
          )}
          {b.kind === 'text' && <p className="text-tiny text-muted">填写了内容就算达成。</p>}
          <p className="text-tiny text-primary-ink font-semibold">{ruleText(b)}</p>
        </div>
      )}
    </div>
  )
}

/** 设置页：先选类型（模板），再自己加减组件、定达标条件；改动立即生效 */
function GoalSettings({
  goal,
  onChange,
  onAdd,
  onClose,
}: {
  goal: Goal
  onChange: (g: Goal) => void
  onAdd: (item: PaletteItem) => void
  onClose: () => void
}) {
  const patchBlock = (id: string, p: Partial<Block>) =>
    onChange({ ...goal, blocks: goal.blocks.map((b) => (b.id === id ? { ...b, ...p } : b)) })
  return (
    <>
      <SettingGroup title="目标名称">
        <Input
          aria-label="目标名称"
          value={goal.name}
          placeholder="例如：戒糖饮水挑战"
          onChange={(ev) => onChange({ ...goal, name: ev.target.value })}
        />
      </SettingGroup>

      <SettingGroup title="选择打卡类型" hint="换类型会重置下面的组件">
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATES.map((t) => {
            const on = goal.template === t.id
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => onChange({ name: t.name, template: t.id, blocks: t.make() })}
                className={cn(
                  'flex min-h-14 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                  on
                    ? 'border-primary bg-primary-soft'
                    : 'border-border bg-surface hover:bg-surface-sunken',
                )}
              >
                <IconTile icon={moduleMeta[t.tone].icon} tone={t.tone} size="sm" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-caption truncate font-bold">{t.label}</span>
                  <span className="text-tiny text-muted truncate">{t.desc}</span>
                </span>
              </button>
            )
          })}
        </div>
      </SettingGroup>

      <SettingGroup title="打卡组件" hint={`${goal.blocks.length} 个`}>
        {goal.blocks.length === 0 && (
          <p className="text-tiny text-subtle bg-surface-sunken rounded-lg px-3 py-4 text-center">
            还没有组件，从下面添加一个
          </p>
        )}
        {goal.blocks.map((b) => (
          <BlockCard
            key={b.id}
            b={b}
            onChange={(p) => patchBlock(b.id, p)}
            onRemove={() => onChange({ ...goal, blocks: goal.blocks.filter((x) => x.id !== b.id) })}
          />
        ))}
      </SettingGroup>

      <SettingGroup title="添加组件" hint="都是前面几个板块用过的">
        <div className="grid grid-cols-2 gap-2">
          {PALETTE.map((p) => (
            <button
              key={p.kind}
              type="button"
              onClick={() => onAdd(p)}
              className="border-border-strong text-foreground hover:bg-surface-sunken flex min-h-14 items-center gap-2 rounded-lg border border-dashed px-2.5 py-2 text-left transition-colors"
            >
              <IconTile icon={p.icon} tone={p.tone} size="sm" />
              <span className="flex min-w-0 flex-col">
                <span className="text-caption truncate font-bold">{p.name}</span>
                <span className="text-tiny text-muted truncate">来自{p.from}</span>
              </span>
            </button>
          ))}
        </div>
      </SettingGroup>

      <Button className="w-full" icon="check" onClick={onClose}>
        完成设置
      </Button>
    </>
  )
}

export function CustomFlowSandbox() {
  const [scenarioId, setScenarioId] = useState('a')
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]!
  const [goal, setGoal] = useState<Goal>(() => {
    const t = TEMPLATES[0]!
    return { name: t.name, template: t.id, blocks: t.make() }
  })
  const [values, setValues] = useState<Values>(() =>
    scenarioValues(SCENARIOS[0]!, { name: '', template: 'water', blocks: TEMPLATES[0]!.make() }),
  )
  const idRef = useRef(1)

  const e = evaluate(goal, values)
  const setVal = (id: string, v: Val) => setValues((cur) => ({ ...cur, [id]: v }))

  const firstBad = e.ruled.find((x) => !x.r.ok)
  const verdict: Verdict = {
    passed: e.passed,
    detail: e.passed
      ? `${e.ruled.length} 条自定义规则都满足`
      : !firstBad
        ? '还没有设置达标条件'
        : `${ruleText(firstBad.b)}：今天 ${firstBad.r.actual}${firstBad.r.gap ? `，${firstBad.r.gap}` : ''}`,
  }

  function changeGoal(g: Goal) {
    // 换了类型：旧的取值作废
    if (g.template !== goal.template) setValues({})
    setGoal(g)
  }

  function addBlock(item: PaletteItem) {
    const id = `b${idRef.current++}`
    setGoal((g) => ({ ...g, blocks: [...g.blocks, item.make(id)] }))
  }

  // —— 填写页：数量 / 时长 / 时间点 / 评分 合并成一块「今日数据」，内容和要点各自一块 ——
  const numeric = goal.blocks.filter((b) =>
    ['count', 'duration', 'time', 'rating'].includes(b.kind),
  )
  const sections: FillSectionSpec[] = []
  if (numeric.length > 0) {
    const filledNum = numeric.filter((b) => evalBlock(b, values[b.id] ?? null).filled)
    sections.push({
      id: 'today',
      label: `今日数据 · ${goal.name || '我的目标'}`,
      icon: 'custom',
      filled: filledNum.length === numeric.length,
      summary: filledNum.length
        ? filledNum
            .map((b) => `${b.label} ${evalBlock(b, values[b.id] ?? null).actual}`)
            .join(' · ')
        : `填${numeric.map((b) => b.label).join('、')}`,
      content: (
        <>
          {numeric.map((b) => {
            const v = values[b.id] ?? null
            if (b.kind === 'rating')
              return (
                <FieldRow key={b.id} label={b.label}>
                  <Rating
                    label={b.label}
                    tone="custom"
                    value={typeof v === 'number' ? (v as RatingValue) : null}
                    onValueChange={(n) => setVal(b.id, n)}
                  />
                </FieldRow>
              )
            if (b.kind === 'time')
              return (
                <InlineRow key={b.id} label={b.label}>
                  <TimeField
                    label={b.label}
                    value={typeof v === 'string' ? v : ''}
                    fallback={b.timeTarget}
                    onChange={(s) => setVal(b.id, s)}
                  />
                </InlineRow>
              )
            return (
              <InlineRow key={b.id} label={b.label}>
                <NumberField
                  size="sm"
                  ariaLabel={b.label}
                  unit={b.unit}
                  min={0}
                  max={9999}
                  step={b.kind === 'duration' ? 5 : 1}
                  value={typeof v === 'number' ? v : null}
                  onValueChange={(n) => setVal(b.id, n)}
                />
              </InlineRow>
            )
          })}
        </>
      ),
    })
  }
  for (const b of goal.blocks.filter((x) => x.kind === 'text')) {
    const v = typeof values[b.id] === 'string' ? (values[b.id] as string) : ''
    sections.push({
      id: `text-${b.id}`,
      label: b.label,
      icon: 'pen',
      filled: v.trim().length > 0,
      summary: v.trim() || '写下内容',
      content: (
        <>
          {b.favs.length > 0 && (
            <div
              className="flex [scrollbar-width:none] gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden"
              role="group"
              aria-label={`常用${b.label}`}
            >
              {b.favs.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={v.trim() === f}
                  onClick={() => setVal(b.id, f)}
                  className={cn(
                    'text-tiny min-h-7 shrink-0 rounded-full border px-2.5 font-semibold whitespace-nowrap transition-colors',
                    v.trim() === f
                      ? 'border-primary bg-primary-soft text-primary-ink'
                      : 'border-border bg-surface-sunken text-muted hover:text-foreground',
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
          <Input
            aria-label={b.label}
            value={v}
            placeholder={`写下${b.label}`}
            onChange={(ev) => setVal(b.id, ev.target.value)}
          />
        </>
      ),
    })
  }
  for (const b of goal.blocks.filter((x) => x.kind === 'points')) {
    const v = typeof values[b.id] === 'string' ? (values[b.id] as string) : ''
    sections.push({
      id: `points-${b.id}`,
      label: b.label,
      icon: 'pen',
      filled: pointsOf(v).length > 0,
      summary: pointsOf(v).length ? `${pointsOf(v).length} 条` : '一次写一条',
      content: <PointsEditor notes={v} onChange={(s) => setVal(b.id, s)} />,
    })
  }
  sections.push({
    id: 'note',
    label: '备注',
    icon: 'pen',
    filled: typeof values.__note === 'string' && values.__note.length > 0,
    summary: (typeof values.__note === 'string' && values.__note) || '可选',
    content: (
      <Input
        aria-label="备注"
        value={typeof values.__note === 'string' ? values.__note : ''}
        placeholder="例如：下午的奶茶"
        onChange={(ev) => setVal('__note', ev.target.value)}
      />
    ),
  })

  function selectScenario(id: string) {
    setScenarioId(id)
    setValues(scenarioValues(SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]!, goal))
  }

  return (
    <FlowStage
      ann="playbook.modules.custom.sandbox"
      phoneLabel="手机 · 自定义目标打卡"
      scenarios={SCENARIOS}
      activeId={scenarioId}
      onSelect={selectScenario}
      extraDefaults={[
        {
          name: '自定义 · 目标设置（右上角「设置」）',
          state: '独立子页，改动立即生效',
          open: true,
        },
        { name: '自定义 · 规则逐项 / 今日记录', state: '全部展开（含每一条）', open: true },
      ]}
      phone={
        <PhoneFlow
          key={scenarioId}
          config={{ ...CONFIG, title: goal.name.trim() || CONFIG.title }}
          rulesPage={<CustomGoalRuleDesignerDemo />}
          basisPage={<CustomRefereeComparisonMatrix />}
          settingsPage={(close) => (
            <GoalSettings goal={goal} onChange={changeGoal} onAdd={addBlock} onClose={close} />
          )}
          sections={sections}
          aiSummary={`${goal.blocks.filter((b) => evalBlock(b, values[b.id] ?? null).filled).length} 项已填`}
          verdict={verdict}
          canSubmit={e.ready}
          report={buildReport(goal, values)}
          onModeChange={(mode: FlowMode) =>
            setValues(mode === 'manual' ? {} : scenarioValues(scenario, goal))
          }
        />
      }
    />
  )
}
