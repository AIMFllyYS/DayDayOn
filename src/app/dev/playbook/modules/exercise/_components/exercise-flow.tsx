'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/field'
import { NumberField } from '@/components/ui/number-field'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { FieldRow } from '../../_components/flow/fill-section'
import { FlowStage } from '../../_components/flow/flow-stage'
import type {
  FillSectionSpec,
  FlowMode,
  FlowScenario,
  PhoneFlowConfig,
  ReportCheck,
  ReportSpec,
  Verdict,
} from '../../_components/flow/flow-types'
import { PhoneFlow } from '../../_components/flow/phone-flow'

type Kind = 'walk' | 'run' | 'strength'
type Effort = 'easy' | 'mid' | 'hard'

const KIND_LABEL: Record<Kind, string> = { walk: '快走', run: '跑步', strength: '力量' }
const EFFORT_LABEL: Record<Effort, string> = { easy: '轻松', mid: '适中', hard: '吃力' }
const MET: Record<Kind, number> = { walk: 3.8, run: 8, strength: 5 }
const EFFORT_FACTOR: Record<Effort, number> = { easy: 0.9, mid: 1, hard: 1.15 }

interface Data {
  kind: Kind
  minutes: number | null
  km: number | null
  sets: number | null
  reps: number | null
  effort: Effort
  note: string
}

const EMPTY: Data = {
  kind: 'run',
  minutes: null,
  km: null,
  sets: null,
  reps: null,
  effort: 'mid',
  note: '',
}

const SCENARIOS: (FlowScenario & { data: Data })[] = [
  {
    id: 'a',
    code: 'A',
    title: '户外慢跑',
    description: '跑步 25 分钟 4.2 公里：时长和距离都过线。',
    passed: true,
    data: { kind: 'run', minutes: 25, km: 4.2, sets: null, reps: null, effort: 'mid', note: '' },
  },
  {
    id: 'b',
    code: 'B',
    title: '饭后慢走',
    description: '快走 10 分钟 0.6 公里：只记为日常活动，不盖章。',
    passed: false,
    data: { kind: 'walk', minutes: 10, km: 0.6, sets: null, reps: null, effort: 'easy', note: '' },
  },
  {
    id: 'c',
    code: 'C',
    title: '深蹲 5 组',
    description: '力量训练 12 分钟，5 组 × 15 次：动作容量达标。',
    passed: true,
    data: { kind: 'strength', minutes: 12, km: null, sets: 5, reps: 15, effort: 'hard', note: '' },
  },
  {
    id: 'd',
    code: 'D',
    title: '快走差一点',
    description: '快走 22 分钟 2.6 公里：距离够了，时长差 3 分钟。',
    passed: false,
    data: { kind: 'walk', minutes: 22, km: 2.6, sets: null, reps: null, effort: 'mid', note: '' },
  },
]

function evaluate(d: Data) {
  const m = d.minutes ?? 0
  const km = d.km ?? 0
  const volume = (d.sets ?? 0) * (d.reps ?? 0)
  const checks: ReportCheck[] = []
  let passed = false
  if (d.kind === 'walk') {
    checks.push({ text: '时长 ≥ 25 分钟', ok: m >= 25 }, { text: '距离 ≥ 2.0 公里', ok: km >= 2 })
    passed = m >= 25 && km >= 2
  } else if (d.kind === 'run') {
    checks.push({ text: '时长 ≥ 15 分钟 或 距离 ≥ 2.0 公里', ok: m >= 15 || km >= 2 })
    passed = m >= 15 || km >= 2
  } else {
    checks.push({ text: '时长 ≥ 15 分钟 或 动作容量 ≥ 60 次', ok: m >= 15 || volume >= 60 })
    passed = m >= 15 || volume >= 60
  }
  const kcal = Math.round(MET[d.kind] * EFFORT_FACTOR[d.effort] * 60 * (m / 60))
  return { passed, checks, kcal, volume, m, km }
}

const CONFIG: PhoneFlowConfig = {
  tone: 'exercise',
  title: '科学运动打卡',
  progress: { done: 9, total: 21 },
  rulesDoc: {
    title: '达标规则',
    sections: [
      {
        heading: '按运动类型分级',
        items: [
          '快走：时长 ≥ 25 分钟 且 距离 ≥ 2.0 公里',
          '跑步：时长 ≥ 15 分钟 或 距离 ≥ 2.0 公里',
          '力量：时长 ≥ 15 分钟 或 动作容量 ≥ 60 次（组数 × 每组次数）',
        ],
      },
      {
        heading: '没达标怎么办',
        items: ['照常保存，记为日常活动，不盖有效章', '不报错，也不删数据'],
      },
    ],
  },
  basisDoc: {
    title: '评判依据',
    sections: [
      {
        heading: '代谢当量（MET）',
        items: [
          '快走 3.8，跑步 8.0，力量 5.0',
          '消耗 ≈ MET × 体重 × 小时，演示按 60kg 估算',
          '强度「轻松 / 适中 / 吃力」分别按 0.9 / 1.0 / 1.15 修正',
        ],
      },
      {
        heading: '为什么分级',
        items: [
          '不同运动的有效门槛不同，一个分钟数卡不住所有运动',
          '拦住取快递、通勤骑行这类日常活动混入连击',
        ],
      },
      {
        heading: '识别',
        items: ['表盘与截图由 AI 识别后先成草稿，确认才入库', '照片只在内存压缩，不落盘'],
      },
    ],
  },
}

function buildReport(d: Data): ReportSpec {
  const e = evaluate(d)
  const pace = d.kind !== 'strength' && e.km > 0 ? `${(e.m / e.km).toFixed(1)} 分钟/公里` : '—'
  return {
    title: `${KIND_LABEL[d.kind]}分析`,
    folders: [
      {
        id: 'workout',
        title: '本次运动',
        icon: 'exercise',
        tone: 'exercise',
        headline: `${KIND_LABEL[d.kind]} · ${e.m} 分钟${d.kind === 'strength' ? ` · ${d.sets ?? 0}×${d.reps ?? 0}` : ` · ${e.km} 公里`}`,
        badge: { text: EFFORT_LABEL[d.effort], tone: 'exercise' },
        rows: [
          {
            label: '时长',
            value: `${e.m} 分钟`,
            ratio: e.m / (d.kind === 'walk' ? 25 : 15),
            tone: 'exercise',
            sub: d.kind === 'walk' ? '门槛 25 分钟' : '门槛 15 分钟',
          },
          d.kind === 'strength'
            ? {
                label: '动作容量',
                value: `${e.volume} 次`,
                ratio: e.volume / 60,
                tone: 'exercise' as const,
                sub: '门槛 60 次',
              }
            : {
                label: '距离',
                value: `${e.km} 公里`,
                ratio: e.km / 2,
                tone: 'exercise' as const,
                sub: '门槛 2.0 公里',
              },
          { label: '配速', value: pace },
        ],
      },
      {
        id: 'burn',
        title: '消耗估算',
        icon: 'flame',
        tone: 'diet',
        headline: `约 ${e.kcal} kcal`,
        rows: [
          {
            label: '消耗',
            value: `${e.kcal} kcal`,
            ratio: e.kcal / 400,
            tone: 'diet',
            sub: '按 60kg 估算',
          },
          { label: '代谢当量', value: `${(MET[d.kind] * EFFORT_FACTOR[d.effort]).toFixed(1)} MET` },
          { label: '约等于', value: `${Math.max(1, Math.round(e.kcal / 80))} 个苹果` },
        ],
      },
      {
        id: 'checks',
        title: '校验清单',
        icon: 'shield',
        headline: `${e.checks.filter((c) => c.ok).length}/${e.checks.length + 1} 项通过`,
        badge: { text: e.passed ? '达标' : '未达标', tone: e.passed ? 'success' : 'warning' },
        checks: [
          ...e.checks,
          { text: '识别数据与手填一致', ok: true, source: '表盘 / 截图草稿，确认后入库' },
        ],
      },
    ],
  }
}

export function ExerciseFlowSandbox() {
  const [scenarioId, setScenarioId] = useState('a')
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]!
  const [data, setData] = useState<Data>(SCENARIOS[0]!.data)
  const e = evaluate(data)
  const ready = (data.minutes ?? 0) > 0
  const set = (patch: Partial<Data>) => setData((d) => ({ ...d, ...patch }))

  const verdict: Verdict = {
    passed: e.passed,
    detail: e.passed
      ? `${KIND_LABEL[data.kind]}达标，约消耗 ${e.kcal} kcal`
      : `${KIND_LABEL[data.kind]}未达有效阈值，记为日常活动`,
  }

  const sections: FillSectionSpec[] = [
    {
      id: 'work',
      label: '运动内容',
      icon: 'exercise',
      filled: ready,
      summary: ready
        ? `${KIND_LABEL[data.kind]} · ${data.minutes} 分钟${data.kind === 'strength' ? ` · ${(data.sets ?? 0) * (data.reps ?? 0)} 次` : data.km ? ` · ${data.km} 公里` : ''}`
        : '类型、时长、距离',
      content: (
        <>
          <FieldRow label="时长">
            <NumberField
              size="sm"
              ariaLabel="时长"
              unit="分钟"
              min={1}
              max={300}
              step={1}
              value={data.minutes}
              onValueChange={(minutes) => set({ minutes })}
            />
          </FieldRow>
          {data.kind === 'strength' ? (
            <>
              <FieldRow label="组数">
                <NumberField
                  size="sm"
                  ariaLabel="组数"
                  unit="组"
                  min={1}
                  max={30}
                  step={1}
                  value={data.sets}
                  onValueChange={(sets) => set({ sets })}
                />
              </FieldRow>
              <FieldRow label="每组次数">
                <NumberField
                  size="sm"
                  ariaLabel="每组次数"
                  unit="次"
                  min={1}
                  max={100}
                  step={1}
                  value={data.reps}
                  onValueChange={(reps) => set({ reps })}
                />
              </FieldRow>
            </>
          ) : (
            <FieldRow label="距离">
              <NumberField
                size="sm"
                ariaLabel="距离"
                unit="公里"
                min={0}
                max={100}
                step={0.1}
                format={{ maximumFractionDigits: 1 }}
                value={data.km}
                onValueChange={(km) => set({ km })}
              />
            </FieldRow>
          )}
        </>
      ),
    },
    {
      id: 'effort',
      label: '强度',
      icon: 'bolt',
      filled: true,
      summary: EFFORT_LABEL[data.effort],
      content: (
        <SegmentedControl
          size="sm"
          label="强度"
          value={data.effort}
          onValueChange={(effort) => set({ effort })}
          options={[
            { value: 'easy', label: '轻松' },
            { value: 'mid', label: '适中' },
            { value: 'hard', label: '吃力' },
          ]}
        />
      ),
    },
    {
      id: 'note',
      label: '备注',
      icon: 'pen',
      filled: data.note.length > 0,
      summary: data.note || '可选',
      content: (
        <Input
          aria-label="备注"
          value={data.note}
          placeholder="例如：操场 · 阴天"
          onChange={(ev) => set({ note: ev.target.value })}
        />
      ),
    },
  ]

  const selector = (
    <SegmentedControl
      size="sm"
      label="运动类型"
      value={data.kind}
      onValueChange={(kind) => set({ kind })}
      options={[
        { value: 'walk', label: '快走' },
        { value: 'run', label: '跑步' },
        { value: 'strength', label: '力量' },
      ]}
    />
  )

  return (
    <FlowStage
      ann="playbook.modules.exercise.sandbox"
      phoneLabel="手机 · 科学运动打卡"
      scenarios={SCENARIOS}
      activeId={scenarioId}
      onSelect={(id) => {
        setScenarioId(id)
        setData(SCENARIOS.find((s) => s.id === id)?.data ?? EMPTY)
      }}
      phone={
        <PhoneFlow
          key={scenarioId}
          config={CONFIG}
          selector={selector}
          sections={sections}
          aiSummary={`${KIND_LABEL[data.kind]} · ${data.minutes ?? 0} 分钟`}
          verdict={verdict}
          canSubmit={ready}
          report={buildReport(data)}
          onModeChange={(mode: FlowMode) => setData(mode === 'manual' ? EMPTY : scenario.data)}
        />
      }
    />
  )
}
