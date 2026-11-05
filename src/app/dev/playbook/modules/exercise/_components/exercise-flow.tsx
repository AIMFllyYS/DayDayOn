'use client'

import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Input } from '@/components/ui/field'
import { NumberField } from '@/components/ui/number-field'
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
import { ExerciseVerdictComparisonMatrix, ExerciseThresholdMatrix } from './exercise-demos'

/**
 * 运动打卡：运动类型由用户自己写，不再限定快走 / 跑步 / 力量；一次打卡可以有多项运动（+ 添加）。
 * 每项运动是一张「运动内容」卡片，系统用一组简单正则识别「怎么计量」：
 *   distance = 按时间 + 距离（跑、走、骑、游泳……）
 *   count    = 按时间 + 组数（深蹲、俯卧撑、平板、核心……）
 * 识别错了，卡片上的小按钮可以手动切换。强度只是一条备注，不参与判定。
 * 「高级选项」收在每张运动卡片里面，默认折叠，不写没有影响。
 */
type Calc = 'distance' | 'count'

const CALC_LABEL: Record<Calc, string> = { distance: '按时间 + 距离', count: '按时间 + 组数' }

const COUNT_RE =
  /力量|深蹲|卧推|硬拉|俯卧撑|引体|平板|核心|哑铃|杠铃|仰卧|臀桥|撸铁|健身|拉伸|普拉提|瑜伽/
const DISTANCE_RE = /跑|走|骑|游泳|徒步|爬山|登山|划船|滑雪|散步|远足|竞走/

/** 识别不出来返回 null，按时间 + 距离兜底 */
function detectCalc(text: string): Calc | null {
  if (COUNT_RE.test(text)) return 'count'
  if (DISTANCE_RE.test(text)) return 'distance'
  return null
}

const MET_RULES: [RegExp, number][] = [
  [/跑/, 8],
  [/骑/, 6.8],
  [/游泳/, 7],
  [/爬山|登山/, 6.5],
  [/走|散步|徒步/, 3.8],
]

function metOf(text: string, calc: Calc): number {
  return MET_RULES.find(([re]) => re.test(text))?.[1] ?? (calc === 'count' ? 5 : 4.5)
}

interface Item {
  id: string
  /** 运动类型，用户自己写 */
  text: string
  calc: Calc
  /** 手动切换过计量方式后，不再被识别结果覆盖 */
  calcManual: boolean
  minutes: number | null
  km: number | null
  sets: number | null
  /** 强度：统一的备注，随便写 */
  effort: string
  // 高级选项（不写没有影响；智能识别手表截图时会自动补）
  advKcal: number | null
  advHr: number | null
  feel: string
}

interface Data {
  items: Item[]
  note: string
}

function blankItem(id: string): Item {
  return {
    id,
    text: '',
    calc: 'distance',
    calcManual: false,
    minutes: null,
    km: null,
    sets: null,
    effort: '',
    advKcal: null,
    advHr: null,
    feel: '',
  }
}

const SCENARIOS: (FlowScenario & { data: Data })[] = [
  {
    id: 'a',
    code: 'A',
    title: '户外慢跑',
    description: '跑步 25 分钟 4.2 公里；手表截图自带消耗和心率，Agent 自动补进高级选项。',
    passed: true,
    data: {
      note: '',
      items: [
        {
          ...blankItem('a1'),
          text: '户外慢跑',
          minutes: 25,
          km: 4.2,
          effort: '中等配速，后半程有点喘',
          advKcal: 196,
          advHr: 142,
          feel: '状态不错',
        },
      ],
    },
  },
  {
    id: 'b',
    code: 'B',
    title: '饭后散步',
    description: '散步 10 分钟 0.6 公里：只记为日常活动，不盖章。',
    passed: false,
    data: {
      note: '',
      items: [{ ...blankItem('b1'), text: '饭后散步', minutes: 10, km: 0.6, effort: '轻松' }],
    },
  },
  {
    id: 'c',
    code: 'C',
    title: '深蹲 + 热身慢跑',
    description: '一次打卡两项运动：深蹲 5 组达标、热身慢跑没到线；任一项达标就盖章。',
    passed: true,
    data: {
      note: '',
      items: [
        {
          ...blankItem('c1'),
          text: '深蹲',
          calc: 'count',
          minutes: 12,
          sets: 5,
          effort: '每组 15 次，最后两组很吃力',
          advKcal: 88,
          advHr: 128,
          feel: '腿酸',
        },
        { ...blankItem('c2'), text: '热身慢跑', minutes: 8, km: 1.1, effort: '很轻松' },
      ],
    },
  },
  {
    id: 'd',
    code: 'D',
    title: '平板支撑',
    description: '核心训练：6 分钟 2 组，时长和组数都没到线。',
    passed: false,
    data: {
      note: '',
      items: [
        {
          ...blankItem('d1'),
          text: '平板支撑',
          calc: 'count',
          minutes: 6,
          sets: 2,
          effort: '每组 1 分钟',
        },
      ],
    },
  },
]

const DEFAULT_FAVS = ['慢跑', '快走', '骑行', '游泳', '深蹲', '平板支撑', '俯卧撑']

function evalItem(it: Item) {
  const m = it.minutes ?? 0
  const km = it.km ?? 0
  const sets = it.sets ?? 0
  const checks: ReportCheck[] =
    it.calc === 'count'
      ? [{ text: '时长 ≥ 15 分钟 或 组数 ≥ 4 组', ok: m >= 15 || sets >= 4 }]
      : [{ text: '时长 ≥ 20 分钟 或 距离 ≥ 2.0 公里', ok: m >= 20 || km >= 2 }]
  const met = metOf(it.text, it.calc)
  const kcal = it.advKcal ?? Math.round(met * m)
  return {
    name: it.text.trim() || '运动',
    passed: checks.every((c) => c.ok),
    checks,
    met,
    kcal,
    fromWatch: it.advKcal !== null,
    m,
    km,
    sets,
  }
}

function evaluate(d: Data) {
  const list = d.items.filter((i) => i.text.trim()).map((i) => ({ item: i, ev: evalItem(i) }))
  const kcal = list.reduce((a, x) => a + x.ev.kcal, 0)
  const minutes = list.reduce((a, x) => a + x.ev.m, 0)
  const load = kcal / 400
  const loadText = load < 0.3 ? '轻' : load < 0.7 ? '适中' : '较高'
  const hr = Math.max(0, ...list.map((x) => x.item.advHr ?? 0))
  const state =
    hr > 150
      ? '心率偏高，注意恢复'
      : load >= 0.7
        ? '强度不低，今晚早点休息'
        : load >= 0.3
          ? '状态在线，可以继续保持'
          : '活动量偏少，可以再动一动'
  return {
    list,
    passed: list.some((x) => x.ev.passed),
    kcal,
    minutes,
    load,
    loadText,
    state,
    fromWatch: list.length > 0 && list.every((x) => x.ev.fromWatch),
  }
}

const CONFIG: PhoneFlowConfig = {
  tone: 'exercise',
  title: '科学运动打卡',
  progress: { done: 9, total: 21 },
  agentSteps: [
    '读取你写的每一项运动',
    '识别计量方式并核对时长、距离或组数',
    '查询每项运动的代谢当量',
    '评估消耗、相对压力与整体状态',
  ],
  rulesDoc: {
    title: '达标规则',
    sections: [
      {
        heading: '按计量方式判定',
        items: [
          '按时间 + 距离（跑、走、骑、游泳等）：时长 ≥ 20 分钟 或 距离 ≥ 2.0 公里',
          '按时间 + 组数（力量、核心等）：时长 ≥ 15 分钟 或 组数 ≥ 4 组',
          '运动类型不限，识别错了可以手动切换计量方式',
          '一次打卡可以添加多项运动，任一项达标就盖有效章',
        ],
      },
      {
        heading: '没达标怎么办',
        items: ['照常保存，记为日常活动，不盖有效章', '不报错，也不删数据'],
      },
      {
        heading: '强度与高级选项',
        items: ['强度只是一条备注，不参与判定', '消耗、心率、感受都可不写，不写没有影响'],
      },
    ],
  },
  basisDoc: {
    title: '评判依据',
    sections: [
      {
        heading: '代谢当量（MET）',
        items: [
          '跑步 8.0，骑行 6.8，游泳 7.0，快走 3.8，力量 5.0，其余按 4.5 估算',
          '消耗 ≈ 代谢当量 × 体重 × 小时，按 60kg 体重估算；手表给了数据就直接用手表的',
        ],
      },
      {
        heading: '识别',
        items: [
          '运动类型用简单规则识别计量方式，识别不出按时间 + 距离兜底',
          '华为等手机、手表的运动截图识别后，会先让你确认再保存',
          '你的截图只用于识别，不会被保存',
        ],
      },
    ],
  },
}

function buildReport(d: Data): ReportSpec {
  const e = evaluate(d)
  const multi = e.list.length > 1

  const items: FolderSpec[] = e.list.map(({ item, ev }) => {
    const pace =
      item.calc === 'distance' && ev.km > 0 ? `${(ev.m / ev.km).toFixed(1)} 分钟/公里` : null
    return {
      id: `item-${item.id}`,
      defaultOpen: true,
      title: ev.name,
      icon: 'exercise',
      headline:
        item.calc === 'count'
          ? `${ev.m} 分钟 · ${ev.sets} 组 · ${ev.kcal} kcal`
          : `${ev.m} 分钟 · ${ev.km} 公里 · ${ev.kcal} kcal`,
      badge: { text: ev.passed ? '达标' : '未达标', tone: ev.passed ? 'success' : 'warning' },
      rows: [
        { label: '计量方式', value: CALC_LABEL[item.calc] },
        {
          label: '时长',
          value: `${ev.m} 分钟`,
          ratio: ev.m / (item.calc === 'count' ? 15 : 20),
          tone: 'exercise',
          sub: item.calc === 'count' ? '门槛 15 分钟' : '门槛 20 分钟',
        },
        item.calc === 'count'
          ? {
              label: '组数',
              value: `${ev.sets} 组`,
              ratio: ev.sets / 4,
              tone: 'exercise' as const,
              sub: '门槛 4 组',
            }
          : {
              label: '距离',
              value: `${ev.km} 公里`,
              ratio: ev.km / 2,
              tone: 'exercise' as const,
              sub: '门槛 2.0 公里',
            },
        ...(pace ? [{ label: '配速', value: pace }] : []),
        {
          label: '消耗',
          value: `${ev.kcal} kcal`,
          ratio: ev.kcal / 400,
          tone: 'diet' as const,
          sub: ev.fromWatch ? '来自手表截图' : `代谢当量 ${ev.met.toFixed(1)} × 60kg 估算`,
        },
        ...(item.advHr ? [{ label: '平均心率', value: `${item.advHr} bpm` }] : []),
        { label: '强度（备注）', value: item.effort.trim() || '未填写' },
        ...(item.feel.trim() ? [{ label: '你的感受', value: item.feel.trim() }] : []),
      ],
    }
  })

  const assess: FolderSpec = {
    id: 'assess',
    defaultOpen: true,
    title: '整体评估',
    icon: 'flame',
    tone: 'diet',
    headline: `约 ${e.kcal} kcal · 压力${e.loadText}`,
    badge: { text: e.fromWatch ? '手表数据' : '估算', tone: e.fromWatch ? 'success' : 'warning' },
    rows: [
      {
        label: '合计消耗',
        value: `${e.kcal} kcal`,
        ratio: e.kcal / 400,
        tone: 'diet',
        sub: `共 ${e.minutes} 分钟`,
      },
      {
        label: '相对压力',
        value: e.loadText,
        ratio: Math.min(1, e.load),
        tone: e.load >= 0.7 ? 'warning' : 'success',
        sub: '消耗占一次中等训练（400 kcal）的比例',
      },
      { label: '整体状态', value: e.state },
      ...(d.note.trim() ? [{ label: '备注', value: d.note.trim() }] : []),
    ],
  }

  const detail: FolderSpec = {
    id: 'items',
    defaultOpen: true,
    title: '逐项分析',
    icon: 'exercise',
    tone: 'exercise',
    headline: `${e.list.length} 项运动 · 达标 ${e.list.filter((x) => x.ev.passed).length} 项`,
    children: items,
    note: '每一项运动的数值都在这里；任一项达标就盖有效章。',
  }

  const checks: ReportCheck[] = [
    ...e.list.flatMap(({ ev }) =>
      ev.checks.map((c) => ({ ...c, text: multi ? `${ev.name}：${c.text}` : c.text })),
    ),
    { text: '识别数据与手填一致', ok: true, source: '手机 / 手表运动截图' },
  ]
  const okCount = checks.filter((c) => c.ok).length
  const checkFolder: FolderSpec = {
    id: 'checks',
    title: '校验清单',
    icon: 'shield',
    headline: `${okCount}/${checks.length} 项通过`,
    badge: { text: e.passed ? '达标' : '未达标', tone: e.passed ? 'success' : 'warning' },
    checks,
  }

  return {
    title: `${e.list.map((x) => x.ev.name).join('、') || '运动'}分析`,
    folders: [assess, detail, checkFolder],
  }
}

/** 数字字段：标签在左、输入在右，一行搞定 */
function InlineRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-tiny text-muted w-12 shrink-0 font-semibold">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** 运动卡片里的「高级选项」：默认折叠，点开才看到；不写没有影响 */
function AdvancedBox({ item, onChange }: { item: Item; onChange: (p: Partial<Item>) => void }) {
  const [open, setOpen] = useState(false)
  const filled = [item.advKcal !== null, item.advHr !== null, item.feel.length > 0].filter(
    Boolean,
  ).length
  return (
    <div className="border-border flex flex-col gap-3 border-t pt-2.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="text-tiny text-muted hover:text-foreground flex min-h-7 items-center gap-1.5 font-semibold"
      >
        <Icon name="sliders" size={13} />
        高级选项
        <span className="text-subtle font-normal">{filled > 0 ? `已填 ${filled} 项` : '可选'}</span>
        <Icon
          name="chevron-down"
          size={14}
          className={cn('ml-auto transition-transform duration-(--dur-base)', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="animate-fade-up flex flex-col gap-3">
          <InlineRow label="消耗">
            <NumberField
              size="sm"
              ariaLabel="消耗"
              unit="kcal"
              min={0}
              max={3000}
              step={10}
              value={item.advKcal}
              onValueChange={(advKcal) => onChange({ advKcal })}
            />
          </InlineRow>
          <InlineRow label="平均心率">
            <NumberField
              size="sm"
              ariaLabel="平均心率"
              unit="bpm"
              min={40}
              max={220}
              step={1}
              value={item.advHr}
              onValueChange={(advHr) => onChange({ advHr })}
            />
          </InlineRow>
          <FieldRow label="整体感受">
            <Input
              aria-label="整体感受"
              value={item.feel}
              placeholder="例如：状态不错、有点累"
              onChange={(ev) => onChange({ feel: ev.target.value })}
            />
          </FieldRow>
        </div>
      )}
    </div>
  )
}

export function ExerciseFlowSandbox() {
  const [scenarioId, setScenarioId] = useState('a')
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]!
  const [data, setData] = useState<Data>(SCENARIOS[0]!.data)
  const [favs, setFavs] = useState<string[]>(DEFAULT_FAVS)
  const [sheet, setSheet] = useState(false)
  const [draftFav, setDraftFav] = useState('')
  const [counter, setCounter] = useState(1)
  const [focusId, setFocusId] = useState<string | null>(null)

  const e = evaluate(data)
  const ready = e.list.length > 0 && e.list.some((x) => x.ev.m > 0 || x.ev.km > 0 || x.ev.sets > 0)
  const names = e.list.map((x) => x.ev.name).join('、') || '运动'

  const verdict: Verdict = {
    passed: e.passed,
    detail: e.passed ? `${names}达标，约消耗 ${e.kcal} kcal` : `${names}未达有效阈值，记为日常活动`,
  }

  function patchItem(id: string, patch: Partial<Item>) {
    setData((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))
  }

  /** 写运动类型：没手动切换过计量方式时，用正则重新识别 */
  function changeText(id: string, text: string) {
    setData((d) => ({
      ...d,
      items: d.items.map((i) => {
        if (i.id !== id) return i
        const hit = detectCalc(text)
        return { ...i, text, calc: i.calcManual ? i.calc : (hit ?? i.calc) }
      }),
    }))
  }

  function addItem() {
    const id = `n${counter}`
    setCounter((c) => c + 1)
    setData((d) => ({ ...d, items: [...d.items, blankItem(id)] }))
    setFocusId(`work-${id}`)
  }

  function removeItem(id: string) {
    setData((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }))
  }

  const sections: FillSectionSpec[] = [
    ...data.items.map((item, idx): FillSectionSpec => {
      const ev = evalItem(item)
      const typed = item.text.trim().length > 0
      const detected = detectCalc(item.text)
      const filled = typed && (ev.m > 0 || ev.km > 0 || ev.sets > 0)
      return {
        id: `work-${item.id}`,
        label: data.items.length > 1 ? `运动内容 ${idx + 1}` : '运动内容',
        icon: 'exercise',
        filled,
        summary: typed
          ? `${ev.name} · ${ev.m || '—'} 分钟${item.calc === 'count' ? (ev.sets ? ` · ${ev.sets} 组` : '') : ev.km ? ` · ${ev.km} 公里` : ''}`
          : '写下你做了什么运动',
        onLongPress: () => setSheet(true),
        content: (
          <>
            <div
              className="flex [scrollbar-width:none] gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden"
              role="group"
              aria-label="常做的运动"
            >
              {favs.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={item.text.trim() === f}
                  onClick={() => changeText(item.id, f)}
                  className={cn(
                    'text-tiny min-h-7 shrink-0 rounded-full border px-2.5 font-semibold whitespace-nowrap transition-colors',
                    item.text.trim() === f
                      ? 'border-exercise bg-exercise-soft text-exercise-ink'
                      : 'border-border bg-surface-sunken text-muted hover:text-foreground',
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            <Input
              aria-label="运动类型"
              value={item.text}
              placeholder="例如：户外慢跑、深蹲、骑行"
              onChange={(ev) => changeText(item.id, ev.target.value)}
            />
            {typed && (
              <div className="bg-surface-sunken animate-fade-up flex flex-col gap-3 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-tiny text-exercise-ink inline-flex items-center gap-1 font-bold">
                    <Icon name="sparkles" size={12} />
                    {CALC_LABEL[item.calc]}
                    {!item.calcManual && !detected && (
                      <span className="text-subtle font-semibold">（未识别，默认）</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      patchItem(item.id, {
                        calc: item.calc === 'count' ? 'distance' : 'count',
                        calcManual: true,
                      })
                    }
                    className="text-tiny border-border bg-surface text-muted hover:text-foreground inline-flex min-h-7 items-center gap-1 rounded-full border px-2.5 font-semibold transition-colors"
                  >
                    <Icon name="arrow" size={12} />
                    改为{item.calc === 'count' ? '按距离' : '按组数'}
                  </button>
                </div>
                <InlineRow label="时长">
                  <NumberField
                    size="sm"
                    ariaLabel="时长"
                    unit="分钟"
                    min={1}
                    max={300}
                    step={1}
                    value={item.minutes}
                    onValueChange={(minutes) => patchItem(item.id, { minutes })}
                  />
                </InlineRow>
                {item.calc === 'count' ? (
                  <InlineRow label="组数">
                    <NumberField
                      size="sm"
                      ariaLabel="组数"
                      unit="组"
                      min={1}
                      max={50}
                      step={1}
                      value={item.sets}
                      onValueChange={(sets) => patchItem(item.id, { sets })}
                    />
                  </InlineRow>
                ) : (
                  <InlineRow label="距离">
                    <NumberField
                      size="sm"
                      ariaLabel="距离"
                      unit="公里"
                      min={0}
                      max={200}
                      step={0.1}
                      format={{ maximumFractionDigits: 1 }}
                      value={item.km}
                      onValueChange={(km) => patchItem(item.id, { km })}
                    />
                  </InlineRow>
                )}
                <FieldRow label="强度（备注）">
                  <Input
                    aria-label="强度"
                    value={item.effort}
                    placeholder="例如：轻松、中等配速、最后两组很吃力"
                    onChange={(ev) => patchItem(item.id, { effort: ev.target.value })}
                  />
                </FieldRow>
                <AdvancedBox item={item} onChange={(p) => patchItem(item.id, p)} />
              </div>
            )}
            {data.items.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="text-tiny text-muted hover:text-danger-ink inline-flex min-h-7 items-center gap-1 self-start font-semibold transition-colors"
              >
                <Icon name="trash" size={12} />
                移除这项运动
              </button>
            )}
          </>
        ),
      }
    }),
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
          onChange={(ev) => setData((d) => ({ ...d, note: ev.target.value }))}
        />
      ),
    },
  ]

  function onModeChange(mode: FlowMode) {
    // 手动：只带上运动内容，高级选项留空（不写没有影响）；智能：手表截图里有的都补进来
    setData(
      mode === 'manual'
        ? {
            ...scenario.data,
            items: scenario.data.items.map((i) => ({
              ...i,
              advKcal: null,
              advHr: null,
              feel: '',
            })),
          }
        : scenario.data,
    )
  }

  function selectScenario(id: string) {
    setScenarioId(id)
    setData(SCENARIOS.find((s) => s.id === id)?.data ?? SCENARIOS[0]!.data)
  }

  const addButton = (
    <button
      type="button"
      onClick={addItem}
      className="border-border-strong text-muted hover:text-foreground text-caption flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed font-semibold transition-colors"
    >
      <Icon name="plus" size={14} />
      添加一项运动
    </button>
  )

  const overlay = sheet ? (
    <div
      className="bg-foreground/30 absolute inset-0 z-30 flex items-end"
      role="dialog"
      aria-label="自定义常做的运动"
    >
      <div className="bg-surface animate-fade-up flex w-full flex-col gap-3 rounded-t-xl px-4 pt-4 pb-5">
        <div className="flex flex-col gap-0.5">
          <span className="text-subhead font-bold">我常做的运动</span>
          <span className="text-tiny text-muted">这些会作为快捷标签出现在「运动内容」上方。</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {favs.map((f) => (
            <span
              key={f}
              className="text-tiny bg-exercise-soft text-exercise-ink inline-flex min-h-7 items-center gap-1 rounded-full pr-1.5 pl-2.5 font-semibold"
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
            aria-label="添加常做的运动"
            value={draftFav}
            placeholder="添加，如：羽毛球"
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
      ann="playbook.modules.exercise.sandbox"
      phoneLabel="手机 · 科学运动打卡"
      scenarios={SCENARIOS}
      activeId={scenarioId}
      onSelect={selectScenario}
      extraDefaults={[
        { name: '运动 · 高级选项（在运动内容卡片里）', state: '折叠；不写没有影响', open: false },
        { name: '运动 · 整体评估 / 逐项分析', state: '全部展开（含每一项）', open: true },
      ]}
      phone={
        <PhoneFlow
          key={scenarioId}
          config={CONFIG}
          rulesPage={<ExerciseThresholdMatrix />}
          basisPage={<ExerciseVerdictComparisonMatrix />}
          sections={sections}
          afterSections={addButton}
          autoOpen={focusId}
          aiSummary={`${names} · ${e.minutes} 分钟`}
          verdict={verdict}
          canSubmit={ready}
          report={buildReport(data)}
          onModeChange={onModeChange}
          overlay={overlay}
        />
      }
    />
  )
}
