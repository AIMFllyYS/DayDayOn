'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/field'
import { NumberField } from '@/components/ui/number-field'
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
import { CustomRefereeComparisonMatrix, CustomGoalRuleDesignerDemo } from './custom-module-demos'

interface Data {
  water: number | null
  sugar: number | null
  note: string
}

const EMPTY: Data = { water: null, sugar: null, note: '' }
const TOTAL_DAYS = 21
const START_DONE = 5

const SCENARIOS: (FlowScenario & { data: Data })[] = [
  {
    id: 'a',
    code: 'A',
    title: '双条件达成',
    description: '温水 7 杯，含糖饮料 0 杯：两条自定义规则都满足。',
    passed: true,
    data: { water: 7, sugar: 0, note: '' },
  },
  {
    id: 'b',
    code: 'B',
    title: '踩了红线',
    description: '水喝够了，但下午喝了 1 杯全糖奶茶：违反「含糖 = 0」。',
    passed: false,
    data: { water: 7, sugar: 1, note: '下午的奶茶' },
  },
  {
    id: 'c',
    code: 'C',
    title: '水没喝够',
    description: '只喝了 4 杯，含糖 0：没达到「温水 ≥ 6 杯」。',
    passed: false,
    data: { water: 4, sugar: 0, note: '' },
  },
  {
    id: 'd',
    code: 'D',
    title: '喝得很好',
    description: '温水 8 杯，含糖 0：超额完成。',
    passed: true,
    data: { water: 8, sugar: 0, note: '' },
  },
]

function evaluate(d: Data) {
  const water = d.water ?? 0
  const sugar = d.sugar ?? 0
  const waterOk = water >= 6
  const sugarOk = sugar === 0
  return { water, sugar, waterOk, sugarOk, passed: waterOk && sugarOk }
}

const CONFIG: PhoneFlowConfig = {
  tone: 'custom',
  title: '自定义目标打卡',
  progress: { done: START_DONE, total: TOTAL_DAYS },
  rulesDoc: {
    title: '达标规则',
    sections: [
      {
        heading: '当前目标：戒糖饮水挑战',
        items: ['温水 ≥ 6 杯', '含糖饮料 = 0 杯', '两条同时满足才盖章'],
      },
      {
        heading: '自己定规则',
        items: ['每个目标独立设置起止日期和达标条件', '没达标照常存档，鼓励明天继续'],
      },
    ],
  },
  basisDoc: {
    title: '评判依据',
    sections: [
      {
        heading: '字段怎么来',
        items: [
          '数字、文本、单选、多选、布尔、时长、评分，7 类字段自由拼装',
          '打卡页只渲染当前目标用到的字段',
        ],
      },
      {
        heading: '裁判怎么判',
        items: ['按你设定的条件逐项打勾，全部满足才算有效', '识别结果会先让你确认，确认后才保存'],
      },
    ],
  },
}

function buildReport(d: Data): ReportSpec {
  const e = evaluate(d)
  const day = START_DONE + 1
  return {
    title: '目标分析',
    folders: [
      {
        id: 'conditions',
        title: '规则逐项',
        icon: 'check-double',
        tone: 'custom',
        headline: `${[e.waterOk, e.sugarOk].filter(Boolean).length}/2 条满足`,
        badge: { text: e.passed ? '达标' : '未达标', tone: e.passed ? 'success' : 'warning' },
        children: [
          {
            id: 'c-water',
            title: '温水 ≥ 6 杯',
            icon: 'heart',
            headline: `今天 ${e.water} 杯`,
            badge: { text: e.waterOk ? '达成' : '未达成', tone: e.waterOk ? 'success' : 'warning' },
          },
          {
            id: 'c-sugar',
            title: '含糖饮料 = 0 杯',
            icon: 'alert',
            headline: `今天 ${e.sugar} 杯`,
            badge: { text: e.sugarOk ? '达成' : '未达成', tone: e.sugarOk ? 'success' : 'warning' },
          },
        ],
      },
      {
        id: 'cycle',
        title: '周期进度',
        icon: 'calendar',
        tone: 'primary',
        headline: `第 ${e.passed ? day : START_DONE} / ${TOTAL_DAYS} 天`,
        rows: [
          {
            label: '有效天数',
            value: `${e.passed ? day : START_DONE} 天`,
            ratio: (e.passed ? day : START_DONE) / TOTAL_DAYS,
            tone: 'custom',
            sub: `剩余 ${TOTAL_DAYS - (e.passed ? day : START_DONE)} 天`,
          },
        ],
      },
      {
        id: 'checks',
        title: '校验清单',
        icon: 'shield',
        headline: `${[e.waterOk, e.sugarOk, true].filter(Boolean).length}/3 项通过`,
        checks: [
          { text: '温水 ≥ 6 杯', ok: e.waterOk },
          { text: '含糖饮料 = 0 杯', ok: e.sugarOk },
          { text: '识别数据与手填一致', ok: true, source: '水杯照片' },
        ],
      },
    ],
  }
}

export function CustomFlowSandbox() {
  const [scenarioId, setScenarioId] = useState('a')
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]!
  const [data, setData] = useState<Data>(SCENARIOS[0]!.data)
  const e = evaluate(data)
  const set = (patch: Partial<Data>) => setData((d) => ({ ...d, ...patch }))
  const ready = data.water !== null && data.sugar !== null

  const verdict: Verdict = {
    passed: e.passed,
    detail: e.passed
      ? '两条自定义规则都满足'
      : !e.sugarOk
        ? '含糖饮料不为 0，违反红线，诚实存档'
        : `温水 ${e.water} 杯，未达 6 杯`,
  }

  const sections: FillSectionSpec[] = [
    {
      id: 'today',
      label: '今日数据 · 戒糖饮水',
      icon: 'custom',
      filled: ready,
      summary: ready ? `温水 ${e.water} 杯 · 含糖 ${e.sugar} 杯` : '填温水和含糖饮料',
      content: (
        <>
          <FieldRow label="温水">
            <NumberField
              size="sm"
              ariaLabel="温水"
              unit="杯"
              min={0}
              max={30}
              step={1}
              value={data.water}
              onValueChange={(water) => set({ water })}
            />
          </FieldRow>
          <FieldRow label="含糖饮料">
            <NumberField
              size="sm"
              ariaLabel="含糖饮料"
              unit="杯"
              min={0}
              max={30}
              step={1}
              value={data.sugar}
              onValueChange={(sugar) => set({ sugar })}
            />
          </FieldRow>
        </>
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
          placeholder="例如：下午的奶茶"
          onChange={(ev) => set({ note: ev.target.value })}
        />
      ),
    },
  ]

  return (
    <FlowStage
      ann="playbook.modules.custom.sandbox"
      phoneLabel="手机 · 自定义目标打卡"
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
          rulesPage={<CustomGoalRuleDesignerDemo />}
          basisPage={<CustomRefereeComparisonMatrix />}
          sections={sections}
          aiSummary={`温水 ${e.water} 杯 · 含糖 ${e.sugar} 杯`}
          verdict={verdict}
          canSubmit={ready}
          report={buildReport(data)}
          onModeChange={(mode: FlowMode) => setData(mode === 'manual' ? EMPTY : scenario.data)}
        />
      }
    />
  )
}
