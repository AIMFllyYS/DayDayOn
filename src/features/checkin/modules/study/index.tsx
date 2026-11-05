'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/field'
import { NumberField } from '@/components/ui/number-field'
import type { RulesOf, Verdict } from '@/features/referee/schemas'
import type { CreateCheckinInput } from '../../schemas'
import type { SmartRecognitionDraft } from '../../smart-schemas'
import { InlineRow, PointsEditor } from '../../flow/fields/inputs'
import { FavoritesSheet, TagRow, useFavorites } from '../../flow/fields/tags'
import type { FillSectionSpec, FolderSpec, ReportSpec } from '../../flow/types'
import { StudyRulesEditor } from '../rules-editors'
import type { CheckinModuleDef, ModuleDocs, ModuleFormApi } from '../types'

/*
 * 学一点（Playbook study-flow）：主题（输入 + 常学标签）→ 专注时长（单行）→ 要点逐条添加。
 * Agent 判断要点是否有实质内容、累加今天的碎片时长，并提炼学科与摘要。
 */

const DEFAULT_FAVS = ['算法', '数学', '英语', '单词', '专业课', '阅读', '写作']

function useStudyForm(): ModuleFormApi {
  const [topic, setTopic] = useState('')
  const [minutes, setMinutes] = useState<number | null>(null)
  const [points, setPoints] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [sheet, setSheet] = useState(false)
  const { favs, setFavs, resetFavs } = useFavorites('study', DEFAULT_FAVS)

  const sections: FillSectionSpec[] = [
    {
      id: 'topic',
      label: '学了什么',
      icon: 'study',
      filled: topic.trim().length > 0,
      summary: topic.trim() || '写一下学习主题',
      onLongPress: () => setSheet(true),
      content: (
        <>
          <TagRow
            tags={favs}
            selected={[topic.trim()]}
            onToggle={(t) => setTopic((cur) => (cur.trim() === t ? '' : t))}
            tone="study"
            label="常学的主题"
          />
          <Input
            aria-label="学习主题"
            value={topic}
            maxLength={60}
            placeholder="例如：二叉树遍历"
            onChange={(e) => setTopic(e.target.value)}
          />
          <InlineRow label="专注">
            <NumberField
              size="sm"
              ariaLabel="专注时长"
              unit="分钟"
              min={1}
              max={1440}
              value={minutes}
              onValueChange={setMinutes}
            />
          </InlineRow>
        </>
      ),
    },
    {
      id: 'points',
      label: '要点',
      icon: 'bulb',
      filled: points.length > 0,
      summary: points.length > 0 ? `${points.length} 条` : '写下具体的收获，一条一条加',
      content: <PointsEditor points={points} onChange={setPoints} />,
    },
    {
      id: 'note',
      label: '备注',
      icon: 'pen',
      filled: note.length > 0,
      summary: note || '可选',
      content: (
        <Input
          aria-label="备注"
          value={note}
          maxLength={200}
          placeholder="例如：在图书馆"
          onChange={(e) => setNote(e.target.value)}
        />
      ),
    },
  ]

  return {
    sections,
    overlay: sheet ? (
      <FavoritesSheet
        title="我常学的主题"
        hint="这些会作为快捷标签出现在主题上方。"
        placeholder="添加，如：线性代数"
        favs={favs}
        tone="study"
        onChange={setFavs}
        onReset={resetFavs}
        onClose={() => setSheet(false)}
      />
    ) : null,
    canSubmit: topic.trim().length > 0 && (minutes ?? 0) > 0,
    aiSummary: `${topic.trim() || '学习'} · ${minutes ?? 0} 分钟 · ${points.length} 条要点`,
    toInput: () => studyInput(topic, minutes, points, note),
    applySmart: (draft: SmartRecognitionDraft) => {
      const d = draft.study
      if (!d) return null
      const pts = d.note
        ? d.note
            .split(/[\n；;]+/)
            .map((x) => x.trim().slice(0, 80))
            .filter(Boolean)
            .slice(0, 10)
        : points
      const mins = d.durationMinutes ?? minutes
      setTopic(d.what)
      setMinutes(mins)
      setPoints(pts)
      return studyInput(d.what, mins, pts, note)
    },
  }
}

function studyInput(
  topic: string,
  minutes: number | null,
  points: string[],
  note: string,
): CreateCheckinInput | null {
  if (!topic.trim() || !minutes) return null
  return {
    module: 'study',
    what: topic.trim().slice(0, 60),
    durationSeconds: Math.max(60, Math.min(86_400, Math.round(minutes * 60))),
    ...(points.length > 0 ? { points } : {}),
    note: note.trim() || null,
  }
}

function buildStudyReport(verdict: Verdict, input: CreateCheckinInput): ReportSpec {
  const m = verdict.metrics
  const facts = verdict.facts?.module === 'study' ? verdict.facts : null
  const points = input.module === 'study' ? (input.points ?? []) : []
  const folders: FolderSpec[] = [
    {
      id: 'focus',
      title: '专注时长',
      icon: 'clock',
      tone: 'study',
      defaultOpen: true,
      headline: `这次 ${m.minutes ?? 0} 分钟 · 今天累计 ${m.totalMinutes ?? 0} 分钟`,
      rows: [
        { label: '今天之前', value: `${m.todayMinutesBefore ?? 0} 分钟` },
        {
          label: '累计',
          value: `${m.totalMinutes ?? 0} 分钟`,
          ratio: Number(m.totalMinutes ?? 0) / 25,
          tone: 'study',
          sub: '一个番茄钟 25 分钟',
        },
      ],
    },
    {
      id: 'content',
      title: '学习内容',
      icon: 'bulb',
      tone: 'primary',
      defaultOpen: true,
      headline: facts
        ? `${facts.subject || '综合学习'} · ${facts.summary}`
        : `${points.length} 条要点`,
      rows: facts?.keyPoints.map((k, i) => ({ label: `要点 ${i + 1}`, value: k })),
      note: facts ? (facts.substantive ? '要点有实质内容' : '要点还不够具体') : undefined,
    },
    {
      id: 'checks',
      title: '校验清单',
      icon: 'shield',
      tone: 'primary',
      headline: `${verdict.checks.filter((c) => c.ok).length}/${verdict.checks.length} 项通过`,
      badge: verdict.isValid
        ? { text: '达标', tone: 'success' }
        : { text: '未达标', tone: 'warning' },
      checks: verdict.checks.map((c) => ({ text: c.text, ok: c.ok, source: c.source })),
    },
  ]
  return { title: `学习分析 · ${verdict.isValid ? '达标' : '碎片学习'}`, folders }
}

function studyDocs(rules: RulesOf<'study'>): ModuleDocs {
  return {
    glance: {
      threshold: `今天累计专注 ≥ ${rules.minFocusMinutes} 分钟，且要点有实质内容`,
      tagline: '专注时长 + 内容实质，双核验',
      pass: '二叉树笔记 + 专注 45 分钟 + 提炼 BFS 复杂度',
      block: '只填「背单词」专注 5 分钟，先暂存为碎片学习',
    },
    rulesDoc: {
      title: '达标规则',
      sections: [
        {
          heading: '双核验',
          items: [
            `今天累计专注 ≥ ${rules.minFocusMinutes} 分钟`,
            `要点有实质内容（至少 ${rules.minNoteChars} 个字）`,
          ],
        },
        {
          heading: '没达标怎么办',
          items: ['先存为碎片学习，同一天多次累加够了再盖章', '不报错，记录照常保存'],
        },
      ],
    },
    basisDoc: {
      title: '评判依据',
      sections: [
        {
          heading: '为什么是番茄钟',
          items: ['番茄工作法的单个专注单元，用来拦住「翻书 3 分钟」糊弄连击'],
        },
        {
          heading: 'Agent 怎么判',
          items: [
            'Agent 读今天已有的学习时长、判断要点是否具体，并提炼学科与摘要',
            '是否达标由规则判断',
            '上传的笔记只提取正文，不会被保存',
          ],
        },
      ],
    },
  }
}

export const studyModule: CheckinModuleDef<'study'> = {
  module: 'study',
  tone: 'study',
  title: '专注学习打卡',
  agentSteps: ['读取主题、时长和要点', '累加今天的学习', '判断内容是否实质'],
  useForm: useStudyForm,
  RulesEditor: StudyRulesEditor,
  docs: studyDocs,
  buildReport: buildStudyReport,
}
