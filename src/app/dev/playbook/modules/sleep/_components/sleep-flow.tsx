'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/field'
import { Rating, type RatingValue } from '@/components/ui/rating'
import { formatSpanMinutes, TimeRangeField, timeRangeSpan } from '@/components/ui/time-range-field'
import { FieldRow } from '../../_components/flow/fill-section'
import { FlowStage } from '../../_components/flow/flow-stage'
import type {
  FillSectionSpec,
  FlowMode,
  FlowScenario,
  PhoneFlowConfig,
  ReportSpec,
  Verdict,
} from '../../_components/flow/flow-types'
import { PhoneFlow } from '../../_components/flow/phone-flow'

interface Data {
  start: string
  end: string
  quality: RatingValue | null
  /** 深睡占比，手环识别得到；手填时按 22% 估算 */
  deep: number
  note: string
}

const EMPTY: Data = { start: '', end: '', quality: null, deep: 22, note: '' }
const REDLINE = 23 * 60 + 30

const SCENARIOS: (FlowScenario & { data: Data })[] = [
  {
    id: 'a',
    code: 'A',
    title: '按时入睡',
    description: '23:15 入睡，07:10 起，7 小时 55 分：早于红线、时长够。',
    passed: true,
    data: { start: '23:15', end: '07:10', quality: 4, deep: 24, note: '' },
  },
  {
    id: 'b',
    code: 'B',
    title: '熬夜补觉',
    description: '02:15 入睡，10:30 起：睡够了但属熬夜补觉，仅存档。',
    passed: false,
    data: { start: '02:15', end: '10:30', quality: 3, deep: 18, note: '' },
  },
  {
    id: 'c',
    code: 'C',
    title: '按时但太短',
    description: '23:05 入睡，03:30 醒：入睡早，但只睡了 4 小时 25 分。',
    passed: false,
    data: { start: '23:05', end: '03:30', quality: 2, deep: 20, note: '' },
  },
  {
    id: 'd',
    code: 'D',
    title: '早睡早起',
    description: '22:40 入睡，06:20 起：7 小时 40 分，比红线早 50 分钟。',
    passed: true,
    data: { start: '22:40', end: '06:20', quality: 5, deep: 23, note: '' },
  },
]

function toMin(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

function evaluate(d: Data) {
  const span = timeRangeSpan(d.start, d.end)
  const bed = toMin(d.start)
  // 中午前的入睡时刻算「过了午夜」，轴上加 24 小时
  const axis = bed === null ? null : bed < 12 * 60 ? bed + 1440 : bed
  const earlyOk = axis !== null && axis <= REDLINE
  const durOk = span !== null && span.minutes >= 390 && span.minutes <= 570
  return { span, axis, earlyOk, durOk, passed: earlyOk && durOk }
}

const CONFIG: PhoneFlowConfig = {
  tone: 'sleep',
  title: '早睡打卡',
  progress: { done: 7, total: 21 },
  rulesDoc: {
    title: '达标规则',
    sections: [
      {
        heading: '双门槛，缺一不可',
        items: ['入睡不晚于红线（默认 23:30）', '有效睡眠 6.5–9.5 小时'],
      },
      {
        heading: '没达标怎么办',
        items: ['熬夜补觉照常存档，进睡眠趋势图', '主按钮降级为「仅保存记录」，不报错'],
      },
    ],
  },
  basisDoc: {
    title: '评判依据',
    sections: [
      {
        heading: '昼夜节律',
        items: [
          '褪黑素分泌高峰和慢波深睡修复，集中在前半夜',
          '所以不能只看总时长：凌晨 3 点睡到中午也算「睡够」，但不算早睡',
        ],
      },
      {
        heading: '跨午夜时间',
        items: ['起床早于入睡，自动记为次日，实时算时长', '中午前的入睡时刻视为已过午夜'],
      },
      { heading: '免责', items: ['睡眠分期为估算结果，非医疗建议'] },
    ],
  },
}

function buildReport(d: Data): ReportSpec {
  const e = evaluate(d)
  const minutes = e.span?.minutes ?? 0
  const diff = e.axis === null ? 0 : Math.abs(e.axis - REDLINE)
  const deepMin = Math.round((minutes * d.deep) / 100)
  const remMin = Math.round(minutes * 0.2)
  return {
    title: '睡眠分析',
    folders: [
      {
        id: 'duration',
        title: '睡眠时长',
        icon: 'clock',
        tone: 'sleep',
        headline: `${e.span ? formatSpanMinutes(minutes) : '—'} · ${d.start} → ${d.end}${e.span?.nextDay ? '（次日）' : ''}`,
        badge: {
          text: e.durOk ? '时长够' : minutes < 390 ? '偏短' : '偏长',
          tone: e.durOk ? 'success' : 'warning',
        },
        rows: [
          {
            label: '总时长',
            value: e.span ? formatSpanMinutes(minutes) : '—',
            ratio: minutes / 570,
            tone: e.durOk ? 'sleep' : 'warning',
            sub: '有效范围 6.5–9.5 小时',
          },
        ],
      },
      {
        id: 'bedtime',
        title: '入睡时刻',
        icon: 'sleep',
        tone: 'study',
        headline: `${d.start} 入睡 · ${e.earlyOk ? `早于红线 ${diff} 分钟` : `晚于红线 ${diff} 分钟`}`,
        badge: { text: e.earlyOk ? '早睡' : '偏晚', tone: e.earlyOk ? 'success' : 'warning' },
        rows: [
          { label: '入睡红线', value: '23:30' },
          { label: '实际入睡', value: d.start || '—' },
        ],
      },
      {
        id: 'stages',
        title: '睡眠结构',
        icon: 'heart',
        tone: 'custom',
        headline: `深睡 ${d.deep}% · ${formatSpanMinutes(Math.max(deepMin, 1))}`,
        rows: [
          {
            label: '深睡',
            value: `${d.deep}%`,
            ratio: d.deep / 30,
            tone: 'sleep',
            sub: `约 ${deepMin} 分钟`,
          },
          {
            label: '快速眼动',
            value: '20%',
            ratio: 0.2 / 0.3,
            tone: 'study',
            sub: `约 ${remMin} 分钟`,
          },
          {
            label: '浅睡',
            value: `${100 - d.deep - 20}%`,
            ratio: (100 - d.deep - 20) / 60,
            tone: 'neutral',
          },
        ],
        note: '估算结果，非医疗建议。',
      },
      {
        id: 'checks',
        title: '校验清单',
        icon: 'shield',
        headline: `${[e.earlyOk, e.durOk, true].filter(Boolean).length}/3 项通过`,
        badge: { text: e.passed ? '达标' : '未达标', tone: e.passed ? 'success' : 'warning' },
        checks: [
          { text: '入睡不晚于 23:30', ok: e.earlyOk },
          { text: '睡眠时长在 6.5–9.5 小时', ok: e.durOk },
          { text: '识别时刻与表盘一致', ok: true, source: '手环 / 截图草稿，确认后入库' },
        ],
      },
    ],
  }
}

export function SleepFlowSandbox() {
  const [scenarioId, setScenarioId] = useState('a')
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]!
  const [data, setData] = useState<Data>(SCENARIOS[0]!.data)
  const e = evaluate(data)
  const set = (patch: Partial<Data>) => setData((d) => ({ ...d, ...patch }))
  const ready = e.span !== null

  const verdict: Verdict = {
    passed: e.passed,
    detail: e.passed
      ? `${e.span ? formatSpanMinutes(e.span.minutes) : ''}，早于 23:30 红线，有效早睡`
      : !e.earlyOk
        ? '入睡晚于 23:30 红线，属熬夜补觉，仅存档'
        : '睡眠时长不在 6.5–9.5 小时，仅存档',
  }

  const sections: FillSectionSpec[] = [
    {
      id: 'range',
      label: '入睡与起床',
      icon: 'sleep',
      filled: ready,
      summary: ready
        ? `${data.start} → ${data.end}${e.span?.nextDay ? '（次日）' : ''} · ${formatSpanMinutes(e.span?.minutes ?? 0)}`
        : '设置入睡与起床时间',
      content: (
        <TimeRangeField
          label="睡眠时段"
          tone="sleep"
          start={data.start}
          end={data.end}
          onStartChange={(start) => set({ start })}
          onEndChange={(end) => set({ end })}
          minMinutes={30}
          maxMinutes={20 * 60}
        />
      ),
    },
    {
      id: 'quality',
      label: '睡得怎么样',
      icon: 'smile',
      filled: data.quality !== null,
      summary: data.quality
        ? ['很糟', '不太好', '一般', '不错', '超棒'][data.quality - 1]!
        : '选一个表情',
      content: (
        <FieldRow label="今早的状态">
          <Rating
            label="睡眠质量"
            tone="sleep"
            value={data.quality}
            onValueChange={(quality) => set({ quality })}
          />
        </FieldRow>
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
          placeholder="例如：半夜醒了一次"
          onChange={(ev) => set({ note: ev.target.value })}
        />
      ),
    },
  ]

  return (
    <FlowStage
      ann="playbook.modules.sleep.sandbox"
      phoneLabel="手机 · 早睡打卡"
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
          sections={sections}
          aiSummary={`${data.start} 入睡 · ${data.end} 起床`}
          verdict={verdict}
          canSubmit={ready}
          report={buildReport(data)}
          onModeChange={(mode: FlowMode) => setData(mode === 'manual' ? EMPTY : scenario.data)}
        />
      }
    />
  )
}
