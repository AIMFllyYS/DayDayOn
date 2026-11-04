'use client'

import { useState } from 'react'
import { Input, Textarea } from '@/components/ui/field'
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

interface Data {
  topic: string
  minutes: number | null
  notes: string
}

const EMPTY: Data = { topic: '', minutes: null, notes: '' }
const POMODORO = 25
const MIN_NOTE_CHARS = 10

const SCENARIOS: (FlowScenario & { data: Data })[] = [
  {
    id: 'a',
    code: 'A',
    title: '二叉树复习',
    description: '专注 45 分钟，提炼出 3 条 BFS / DFS 要点：时长和内容都过线。',
    passed: true,
    data: {
      topic: '二叉树遍历',
      minutes: 45,
      notes: 'BFS 用队列，时间复杂度 O(V+E)\nDFS 用栈或递归，空间 O(h)\n层序遍历按层入队',
    },
  },
  {
    id: 'b',
    code: 'B',
    title: '背单词 5 分钟',
    description: '没满一个番茄钟：提示继续专注后再盖章。',
    passed: false,
    data: { topic: '背单词', minutes: 5, notes: '' },
  },
  {
    id: 'c',
    code: 'C',
    title: '时长够、内容空',
    description: '专注 30 分钟，但只写了「看了」：内容不实质，仅存档。',
    passed: false,
    data: { topic: '数学错题', minutes: 30, notes: '看了' },
  },
  {
    id: 'd',
    code: 'D',
    title: '英语精读',
    description: '专注 60 分钟，摘录 2 条长难句要点：达标。',
    passed: true,
    data: {
      topic: '英语精读',
      minutes: 60,
      notes: '虚拟语气：if 从句用过去完成时\n倒装句：Only 位于句首时助动词前置',
    },
  },
]

function evaluate(d: Data) {
  const m = d.minutes ?? 0
  const points = d.notes
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const timeOk = m >= POMODORO
  const contentOk = d.notes.trim().length >= MIN_NOTE_CHARS
  return { m, points, timeOk, contentOk, passed: timeOk && contentOk }
}

const CONFIG: PhoneFlowConfig = {
  tone: 'study',
  title: '专注学习打卡',
  progress: { done: 14, total: 30 },
  rulesDoc: {
    title: '达标规则',
    sections: [
      {
        heading: '双核验',
        items: ['专注时长 ≥ 25 分钟（一个番茄钟）', '要点摘录有实质内容（至少 10 个字）'],
      },
      {
        heading: '没达标怎么办',
        items: ['可以先「暂存碎片学习」，同一天多次累加达标后再盖章', '不报错，记录照常保存'],
      },
    ],
  },
  basisDoc: {
    title: '评判依据',
    sections: [
      {
        heading: '为什么是 25 分钟',
        items: ['番茄工作法的单个专注单元，用来拦住「翻书 3 分钟」糊弄连击'],
      },
      {
        heading: '笔记提纯',
        items: [
          '上传 HTML 先在本地去掉 script、style 和冗余标签，只把正文发给 AI',
          'AI 提炼知识点摘要，先成草稿，确认才入库',
          '不展示 token 数字和内部提示词',
        ],
      },
    ],
  },
}

function buildReport(d: Data): ReportSpec {
  const e = evaluate(d)
  return {
    title: '学习分析',
    folders: [
      {
        id: 'focus',
        title: '专注时长',
        icon: 'clock',
        tone: 'study',
        headline: `${e.m} 分钟 · ${Math.floor(e.m / POMODORO)} 个番茄钟`,
        badge: {
          text: e.timeOk ? '时长够' : '不足 25 分钟',
          tone: e.timeOk ? 'success' : 'warning',
        },
        rows: [
          {
            label: '专注',
            value: `${e.m} 分钟`,
            ratio: e.m / POMODORO,
            tone: e.timeOk ? 'study' : 'warning',
            sub: '门槛 25 分钟',
          },
        ],
      },
      {
        id: 'points',
        title: '知识点摘要',
        icon: 'bulb',
        tone: 'diet',
        headline: e.points.length
          ? `${e.points.length} 条要点 · ${d.topic || '未命名'}`
          : '还没有要点',
        children: e.points.map((p, i) => ({
          id: `p${i}`,
          title: `要点 ${i + 1}`,
          icon: 'check' as const,
          headline: p,
        })),
      },
      {
        id: 'checks',
        title: '校验清单',
        icon: 'shield',
        headline: `${[e.timeOk, e.contentOk, true].filter(Boolean).length}/3 项通过`,
        badge: { text: e.passed ? '达标' : '未达标', tone: e.passed ? 'success' : 'warning' },
        checks: [
          { text: '专注时长 ≥ 25 分钟', ok: e.timeOk },
          { text: '要点摘录有实质内容', ok: e.contentOk },
          { text: '摘要与学习主题一致', ok: true, source: 'AI 语义核对，先成草稿，确认后入库' },
        ],
      },
    ],
  }
}

export function StudyFlowSandbox() {
  const [scenarioId, setScenarioId] = useState('a')
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]!
  const [data, setData] = useState<Data>(SCENARIOS[0]!.data)
  const e = evaluate(data)
  const set = (patch: Partial<Data>) => setData((d) => ({ ...d, ...patch }))
  const ready = data.topic.trim().length > 0 && e.m > 0

  const verdict: Verdict = {
    passed: e.passed,
    detail: e.passed
      ? `专注 ${e.m} 分钟，要点有实质内容`
      : !e.timeOk
        ? `专注 ${e.m} 分钟，未满 25 分钟，可先暂存碎片学习`
        : '要点太少，补充一点再盖章',
  }

  const sections: FillSectionSpec[] = [
    {
      id: 'what',
      label: '学了什么',
      icon: 'study',
      filled: ready,
      summary: ready ? `${data.topic} · ${e.m} 分钟` : '主题与专注时长',
      content: (
        <>
          <FieldRow label="学习主题">
            <Input
              aria-label="学习主题"
              value={data.topic}
              placeholder="例如：二叉树遍历"
              onChange={(ev) => set({ topic: ev.target.value })}
            />
          </FieldRow>
          <FieldRow label="专注时长">
            <NumberField
              size="sm"
              ariaLabel="专注时长"
              unit="分钟"
              min={1}
              max={600}
              step={5}
              value={data.minutes}
              onValueChange={(minutes) => set({ minutes })}
            />
          </FieldRow>
        </>
      ),
    },
    {
      id: 'notes',
      label: '要点摘录',
      icon: 'pen',
      filled: data.notes.trim().length > 0,
      summary: data.notes.trim() ? `${e.points.length} 条` : '一行一条，写下收获',
      content: (
        <Textarea
          aria-label="要点摘录"
          rows={4}
          value={data.notes}
          placeholder="一行一条要点"
          onChange={(ev) => set({ notes: ev.target.value })}
        />
      ),
    },
  ]

  return (
    <FlowStage
      ann="playbook.modules.study.sandbox"
      phoneLabel="手机 · 专注学习打卡"
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
          aiSummary={`${data.topic} · ${e.m} 分钟 · ${e.points.length} 条要点`}
          verdict={verdict}
          canSubmit={ready}
          report={buildReport(data)}
          onModeChange={(mode: FlowMode) => setData(mode === 'manual' ? EMPTY : scenario.data)}
        />
      }
    />
  )
}
