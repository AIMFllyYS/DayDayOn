'use client'

import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Input } from '@/components/ui/field'
import { NumberField } from '@/components/ui/number-field'
import { cn } from '@/lib/cn'
import { FlowStage } from '../../_components/flow/flow-stage'
import type {
  FillSectionSpec,
  FlowMode,
  FlowScenario,
  FolderSpec,
  PhoneFlowConfig,
  ReportSpec,
  Verdict,
} from '../../_components/flow/flow-types'
import { PhoneFlow } from '../../_components/flow/phone-flow'
import { StudyRefereeComparisonMatrix, StudyDualMechanismDemo } from './study-module-demos'

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

const DEFAULT_FAVS = ['算法', '数学', '英语', '单词', '专业课', '阅读', '写作']

/** 学习主题 → 学科类别与复习建议（简单关键词识别；Agent 联网核对后给出） */
function classify(topic: string): { subject: string; review: string } {
  if (/树|图|算法|代码|编程|数据结构|leetcode|力扣|java|python/i.test(topic))
    return { subject: '计算机 · 算法与数据结构', review: '明天做 2 道同类题，3 天后再复盘一次' }
  if (/数学|错题|微积分|线代|概率|几何/.test(topic))
    return { subject: '数学 · 错题整理', review: '明天重做错题，一周后抽查' }
  if (/英语|单词|词汇|语法|阅读|长难句|雅思|托福|四六级/.test(topic))
    return { subject: '语言 · 英语', review: '今晚睡前扫一遍，明天、3 天后各复习一次' }
  return { subject: '综合学习', review: '明天花 5 分钟回顾要点，一周后再看一遍' }
}

const CONFIG: PhoneFlowConfig = {
  tone: 'study',
  title: '专注学习打卡',
  progress: { done: 14, total: 30 },
  agentSteps: [
    '读取你的学习主题、专注时长和要点',
    '翻看你今天已有的学习记录，累加碎片时长',
    '联网核对主题相关资料，判断要点是否有实质内容',
    '生成分析结果',
  ],
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
        heading: '笔记整理',
        items: [
          '上传的笔记会先整理出正文，再提炼要点',
          '提炼出的知识点摘要，需要你确认后才保存',
          '摘要需要和你填写的学习主题一致',
        ],
      },
    ],
  },
}

function buildReport(d: Data): ReportSpec {
  const e = evaluate(d)
  const cls = classify(d.topic)
  const chars = d.notes.replace(/\s/g, '').length
  const pointFolders: FolderSpec[] = e.points.map((p, i) => {
    const len = p.replace(/\s/g, '').length
    const good = len >= 12
    return {
      id: `p${i}`,
      defaultOpen: true,
      title: `要点 ${i + 1}`,
      icon: 'check' as const,
      headline: p,
      badge: good
        ? { text: '清晰', tone: 'success' as const }
        : { text: len < 6 ? '太简略' : '可再具体', tone: 'warning' as const },
      note: good
        ? '写出了方法和原因，复习时一眼能想起来。'
        : '建议补上「为什么」或一个小例子，之后更好回忆。',
    }
  })
  return {
    title: '学习分析',
    folders: [
      {
        id: 'focus',
        defaultOpen: true,
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
            label: '本次专注',
            value: `${e.m} 分钟`,
            ratio: e.m / POMODORO,
            tone: e.timeOk ? 'study' : 'warning',
            sub: '门槛 25 分钟（一个番茄钟）',
          },
          {
            label: '番茄钟',
            value: `${Math.floor(e.m / POMODORO)} 个`,
            sub: e.timeOk ? '' : '可以先暂存，同一天累加到 25 分钟再盖章',
          },
        ],
      },
      {
        id: 'topic',
        defaultOpen: true,
        title: '主题分析',
        icon: 'study',
        tone: 'diet',
        headline: d.topic || '未命名',
        badge: { text: cls.subject.split(' · ')[0]!, tone: 'study' },
        rows: [
          { label: '学科类别', value: cls.subject },
          {
            label: '内容充实度',
            value: `${e.points.length} 条 · ${chars} 字`,
            ratio: Math.min(1, chars / 60),
            tone: e.contentOk ? 'success' : 'warning',
            sub: '至少 10 个字才算有实质内容',
          },
          { label: '复习建议', value: cls.review },
        ],
      },
      {
        id: 'points',
        defaultOpen: true,
        title: '逐条要点',
        icon: 'bulb',
        tone: 'study',
        headline: e.points.length ? `${e.points.length} 条要点` : '还没有要点',
        children: pointFolders,
        note: e.points.length
          ? '每条要点单独评估是否清晰、能否帮你日后回忆。'
          : '写下至少一条收获再提交。',
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
          { text: '摘要与学习主题一致', ok: true, source: '与你填写的学习主题核对一致' },
        ],
      },
    ],
  }
}

/** 数字字段：标签在左、输入在右，一行搞定 */
export function InlineRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-tiny text-muted w-14 shrink-0 font-semibold">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** 要点摘录：一次写一条，回车或点「添加」；每条可以单独移除 */
export function PointsEditor({
  notes,
  onChange,
}: {
  notes: string
  onChange: (v: string) => void
}) {
  const [draft, setDraft] = useState('')
  const points = notes
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
  function add() {
    const t = draft.trim()
    if (!t) return
    onChange([...points, t].join('\n'))
    setDraft('')
  }
  return (
    <>
      <div className="flex gap-2">
        <Input
          aria-label="要点"
          value={draft}
          placeholder="写一条收获，回车添加"
          onChange={(ev) => setDraft(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') {
              ev.preventDefault()
              add()
            }
          }}
        />
        <Button variant="soft" size="sm" icon="plus" disabled={!draft.trim()} onClick={add}>
          添加
        </Button>
      </div>
      {points.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          {points.map((p, i) => (
            <li
              key={`${i}-${p}`}
              className="bg-surface-sunken animate-fade-up flex items-start gap-2 rounded-lg px-2.5 py-2"
            >
              <span className="bg-study-soft text-study-ink text-tiny mt-px grid size-5 shrink-0 place-items-center rounded-md leading-none font-bold">
                {i + 1}
              </span>
              <span className="text-tiny min-w-0 flex-1 leading-snug break-words">{p}</span>
              <button
                type="button"
                aria-label={`移除要点 ${i + 1}`}
                onClick={() => onChange(points.filter((_, j) => j !== i).join('\n'))}
                className="text-subtle hover:text-foreground grid size-5 shrink-0 place-items-center rounded-full"
              >
                <Icon name="x" size={12} />
              </button>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}

export function StudyFlowSandbox() {
  const [scenarioId, setScenarioId] = useState('a')
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]!
  const [data, setData] = useState<Data>(SCENARIOS[0]!.data)
  const [favs, setFavs] = useState<string[]>(DEFAULT_FAVS)
  const [sheet, setSheet] = useState(false)
  const [draftFav, setDraftFav] = useState('')
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
      summary: ready ? `${data.topic} · ${e.m} 分钟` : '写下主题与专注时长',
      onLongPress: () => setSheet(true),
      content: (
        <>
          <div
            className="flex [scrollbar-width:none] gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="常学的主题"
          >
            {favs.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={data.topic.trim() === f}
                onClick={() => set({ topic: f })}
                className={cn(
                  'text-tiny min-h-7 shrink-0 rounded-full border px-2.5 font-semibold whitespace-nowrap transition-colors',
                  data.topic.trim() === f
                    ? 'border-study bg-study-soft text-study-ink'
                    : 'border-border bg-surface-sunken text-muted hover:text-foreground',
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <Input
            aria-label="学习主题"
            value={data.topic}
            placeholder="例如：二叉树遍历"
            onChange={(ev) => set({ topic: ev.target.value })}
          />
          <InlineRow label="专注时长">
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
          </InlineRow>
        </>
      ),
    },
    {
      id: 'notes',
      label: '要点摘录',
      icon: 'pen',
      filled: e.points.length > 0,
      summary: e.points.length ? `${e.points.length} 条要点` : '一次写一条收获',
      content: <PointsEditor notes={data.notes} onChange={(notes) => set({ notes })} />,
    },
  ]

  const overlay = sheet ? (
    <div
      className="bg-foreground/30 absolute inset-0 z-30 flex items-end"
      role="dialog"
      aria-label="自定义常学的主题"
    >
      <div className="bg-surface animate-fade-up flex w-full flex-col gap-3 rounded-t-xl px-4 pt-4 pb-5">
        <div className="flex flex-col gap-0.5">
          <span className="text-subhead font-bold">我常学的主题</span>
          <span className="text-tiny text-muted">这些会作为快捷标签出现在「学了什么」上方。</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {favs.map((f) => (
            <span
              key={f}
              className="text-tiny bg-study-soft text-study-ink inline-flex min-h-7 items-center gap-1 rounded-full pr-1.5 pl-2.5 font-semibold"
            >
              {f}
              <button
                type="button"
                aria-label={`移除${f}`}
                onClick={() => setFavs((l) => l.filter((x) => x !== f))}
                className="grid size-4 place-items-center rounded-full hover:bg-black/10"
              >
                <Icon name="x" size={10} />
              </button>
            </span>
          ))}
          {favs.length === 0 && <span className="text-tiny text-subtle">还没有，添加一个吧</span>}
        </div>
        <div className="flex gap-2">
          <Input
            aria-label="添加常学的主题"
            value={draftFav}
            placeholder="添加，如：线性代数"
            onChange={(ev) => setDraftFav(ev.target.value)}
          />
          <Button
            variant="soft"
            icon="plus"
            disabled={!draftFav.trim() || favs.includes(draftFav.trim())}
            onClick={() => {
              setFavs((l) => [...l, draftFav.trim()])
              setDraftFav('')
            }}
          >
            添加
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setFavs(DEFAULT_FAVS)}>
            恢复系统推荐
          </Button>
          <Button className="flex-1" onClick={() => setSheet(false)}>
            完成
          </Button>
        </div>
      </div>
    </div>
  ) : null

  return (
    <FlowStage
      ann="playbook.modules.study.sandbox"
      phoneLabel="手机 · 专注学习打卡"
      scenarios={SCENARIOS}
      activeId={scenarioId}
      extraDefaults={[
        { name: '学习 · 主题分析 / 逐条要点', state: '全部展开（含每一条）', open: true },
      ]}
      onSelect={(id) => {
        setScenarioId(id)
        setData(SCENARIOS.find((s) => s.id === id)?.data ?? EMPTY)
      }}
      phone={
        <PhoneFlow
          key={scenarioId}
          config={CONFIG}
          rulesPage={<StudyDualMechanismDemo />}
          basisPage={<StudyRefereeComparisonMatrix />}
          sections={sections}
          overlay={overlay}
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
