'use client'

import { useState } from 'react'
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
  PhoneFlowConfig,
  ReportCheck,
  ReportSpec,
  Verdict,
} from '../../_components/flow/flow-types'
import { PhoneFlow } from '../../_components/flow/phone-flow'

/**
 * 运动打卡：运动类型由用户自己写，不再限定快走 / 跑步 / 力量。
 * 系统用一组简单正则识别「怎么计量」：
 *   distance = 按时间 + 距离（跑、走、骑、游泳……）
 *   count    = 按时间 + 组数（深蹲、俯卧撑、平板、核心……）
 * 识别错了，卡片上的小按钮可以手动切换。强度只是一条备注，不参与判定。
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

interface Data {
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

const EMPTY_ADV = { advKcal: null, advHr: null, feel: '' }

const SCENARIOS: (FlowScenario & { data: Data })[] = [
  {
    id: 'a',
    code: 'A',
    title: '户外慢跑',
    description: '跑步 25 分钟 4.2 公里；手表截图自带消耗和心率，Agent 自动补进高级选项。',
    passed: true,
    data: {
      text: '户外慢跑',
      calc: 'distance',
      calcManual: false,
      minutes: 25,
      km: 4.2,
      sets: null,
      effort: '中等配速，后半程有点喘',
      advKcal: 196,
      advHr: 142,
      feel: '状态不错',
    },
  },
  {
    id: 'b',
    code: 'B',
    title: '饭后散步',
    description: '散步 10 分钟 0.6 公里：只记为日常活动，不盖章。',
    passed: false,
    data: {
      text: '饭后散步',
      calc: 'distance',
      calcManual: false,
      minutes: 10,
      km: 0.6,
      sets: null,
      effort: '轻松',
      advKcal: null,
      advHr: null,
      feel: '',
    },
  },
  {
    id: 'c',
    code: 'C',
    title: '深蹲训练',
    description: '深蹲被识别为按组数计量：12 分钟 5 组，达标。',
    passed: true,
    data: {
      text: '深蹲',
      calc: 'count',
      calcManual: false,
      minutes: 12,
      km: null,
      sets: 5,
      effort: '每组 15 次，最后两组很吃力',
      advKcal: 88,
      advHr: 128,
      feel: '腿酸',
    },
  },
  {
    id: 'd',
    code: 'D',
    title: '平板支撑',
    description: '核心训练：6 分钟 2 组，时长和组数都没到线。',
    passed: false,
    data: {
      text: '平板支撑',
      calc: 'count',
      calcManual: false,
      minutes: 6,
      km: null,
      sets: 2,
      effort: '每组 1 分钟',
      advKcal: null,
      advHr: null,
      feel: '',
    },
  },
]

const DEFAULT_FAVS = ['慢跑', '快走', '骑行', '游泳', '深蹲', '平板支撑', '俯卧撑']

function evaluate(d: Data) {
  const m = d.minutes ?? 0
  const km = d.km ?? 0
  const sets = d.sets ?? 0
  const checks: ReportCheck[] =
    d.calc === 'count'
      ? [{ text: '时长 ≥ 15 分钟 或 组数 ≥ 4 组', ok: m >= 15 || sets >= 4 }]
      : [{ text: '时长 ≥ 20 分钟 或 距离 ≥ 2.0 公里', ok: m >= 20 || km >= 2 }]
  const passed = checks.every((c) => c.ok)
  const met = metOf(d.text, d.calc)
  const estimated = Math.round(met * m)
  const kcal = d.advKcal ?? estimated
  const load = kcal / 400
  const loadText = load < 0.3 ? '轻' : load < 0.7 ? '适中' : '较高'
  const state =
    d.advHr && d.advHr > 150
      ? '心率偏高，注意恢复'
      : load >= 0.7
        ? '强度不低，今晚早点休息'
        : load >= 0.3
          ? '状态在线，可以继续保持'
          : '活动量偏少，可以再动一动'
  return {
    passed,
    checks,
    met,
    kcal,
    fromWatch: d.advKcal !== null,
    load,
    loadText,
    state,
    m,
    km,
    sets,
  }
}

const CONFIG: PhoneFlowConfig = {
  tone: 'exercise',
  title: '科学运动打卡',
  progress: { done: 9, total: 21 },
  agentSteps: [
    '读取你写的运动内容',
    '识别计量方式并核对时长、距离或组数',
    '查询这项运动的代谢当量',
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
        ],
      },
      {
        heading: '没达标怎么办',
        items: ['照常保存，记为日常活动，不盖有效章', '不报错，也不删数据'],
      },
      {
        heading: '强度与高级选项',
        items: ['强度只是一条备注，不参与判定', '消耗、心率、整体感受都可不写，不写没有影响'],
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
          '消耗 ≈ MET × 体重 × 小时，演示按 60kg 估算；手表给了数据就直接用手表的',
        ],
      },
      {
        heading: '识别',
        items: [
          '运动类型用简单规则识别计量方式，识别不出按时间 + 距离兜底',
          '华为等手机、手表的运动截图由 AI 识别后先成草稿，确认才入库',
          '照片只在内存压缩，不落盘',
        ],
      },
    ],
  },
}

function buildReport(d: Data): ReportSpec {
  const e = evaluate(d)
  const name = d.text.trim() || '运动'
  const pace = d.calc === 'distance' && e.km > 0 ? `${(e.m / e.km).toFixed(1)} 分钟/公里` : null
  return {
    title: `${name}分析`,
    folders: [
      {
        id: 'workout',
        defaultOpen: true,
        title: '本次运动',
        icon: 'exercise',
        tone: 'exercise',
        headline:
          d.calc === 'count'
            ? `${name} · ${e.m} 分钟 · ${e.sets} 组`
            : `${name} · ${e.m} 分钟 · ${e.km} 公里`,
        badge: { text: CALC_LABEL[d.calc], tone: 'exercise' },
        rows: [
          {
            label: '时长',
            value: `${e.m} 分钟`,
            ratio: e.m / (d.calc === 'count' ? 15 : 20),
            tone: 'exercise',
            sub: d.calc === 'count' ? '门槛 15 分钟' : '门槛 20 分钟',
          },
          d.calc === 'count'
            ? {
                label: '组数',
                value: `${e.sets} 组`,
                ratio: e.sets / 4,
                tone: 'exercise' as const,
                sub: '门槛 4 组',
              }
            : {
                label: '距离',
                value: `${e.km} 公里`,
                ratio: e.km / 2,
                tone: 'exercise' as const,
                sub: '门槛 2.0 公里',
              },
          ...(pace ? [{ label: '配速', value: pace }] : []),
          { label: '强度（备注）', value: d.effort.trim() || '未填写' },
        ],
      },
      {
        id: 'assess',
        defaultOpen: true,
        title: '整体评估',
        icon: 'flame',
        tone: 'diet',
        headline: `约 ${e.kcal} kcal · 压力${e.loadText}`,
        badge: {
          text: e.fromWatch ? '手表数据' : '估算',
          tone: e.fromWatch ? 'success' : 'warning',
        },
        rows: [
          {
            label: '消耗',
            value: `${e.kcal} kcal`,
            ratio: e.kcal / 400,
            tone: 'diet',
            sub: e.fromWatch ? '来自手表截图' : `MET ${e.met.toFixed(1)} × 60kg 估算`,
          },
          {
            label: '相对压力',
            value: e.loadText,
            ratio: Math.min(1, e.load),
            tone: e.load >= 0.7 ? 'warning' : 'success',
            sub: '消耗占一次中等训练（400 kcal）的比例',
          },
          ...(d.advHr ? [{ label: '平均心率', value: `${d.advHr} bpm` }] : []),
          { label: '整体状态', value: e.state },
          ...(d.feel.trim() ? [{ label: '你的感受', value: d.feel.trim() }] : []),
        ],
      },
      {
        id: 'checks',
        title: '校验清单',
        icon: 'shield',
        headline: `${e.checks.filter((c) => c.ok).length + 1}/${e.checks.length + 1} 项通过`,
        badge: { text: e.passed ? '达标' : '未达标', tone: e.passed ? 'success' : 'warning' },
        checks: [
          ...e.checks,
          { text: '识别数据与手填一致', ok: true, source: '手机 / 手表运动截图草稿，确认后入库' },
        ],
      },
    ],
  }
}

export function ExerciseFlowSandbox() {
  const [scenarioId, setScenarioId] = useState('a')
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]!
  const [data, setData] = useState<Data>(SCENARIOS[0]!.data)
  const [favs, setFavs] = useState<string[]>(DEFAULT_FAVS)
  const [sheet, setSheet] = useState(false)
  const [draftFav, setDraftFav] = useState('')

  const e = evaluate(data)
  const typed = data.text.trim().length > 0
  const ready = typed && (e.m > 0 || e.km > 0 || e.sets > 0)
  const set = (patch: Partial<Data>) => setData((d) => ({ ...d, ...patch }))
  const name = data.text.trim() || '运动'

  const verdict: Verdict = {
    passed: e.passed,
    detail: e.passed ? `${name}达标，约消耗 ${e.kcal} kcal` : `${name}未达有效阈值，记为日常活动`,
  }

  /** 写运动类型：没手动切换过计量方式时，用正则重新识别 */
  function changeText(text: string) {
    setData((d) => {
      const hit = detectCalc(text)
      return { ...d, text, calc: d.calcManual ? d.calc : (hit ?? d.calc) }
    })
  }

  const detected = detectCalc(data.text)

  const sections: FillSectionSpec[] = [
    {
      id: 'work',
      label: '运动内容',
      icon: 'exercise',
      filled: ready,
      summary: typed
        ? `${name} · ${e.m || '—'} 分钟${data.calc === 'count' ? (e.sets ? ` · ${e.sets} 组` : '') : e.km ? ` · ${e.km} 公里` : ''}`
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
                aria-pressed={data.text.trim() === f}
                onClick={() => changeText(f)}
                className={cn(
                  'text-tiny min-h-7 shrink-0 rounded-full border px-2.5 font-semibold whitespace-nowrap transition-colors',
                  data.text.trim() === f
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
            value={data.text}
            placeholder="例如：户外慢跑、深蹲、骑行"
            onChange={(ev) => changeText(ev.target.value)}
          />
          {typed && (
            <div className="bg-surface-sunken animate-fade-up flex flex-col gap-3 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-tiny text-exercise-ink inline-flex items-center gap-1 font-bold">
                  <Icon name="sparkles" size={12} />
                  {CALC_LABEL[data.calc]}
                  {!data.calcManual && !detected && (
                    <span className="text-subtle font-semibold">（未识别，默认）</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    set({ calc: data.calc === 'count' ? 'distance' : 'count', calcManual: true })
                  }
                  className="text-tiny border-border bg-surface text-muted hover:text-foreground inline-flex min-h-7 items-center gap-1 rounded-full border px-2.5 font-semibold transition-colors"
                >
                  <Icon name="arrow" size={12} />
                  改为{data.calc === 'count' ? '按距离' : '按组数'}
                </button>
              </div>
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
              {data.calc === 'count' ? (
                <FieldRow label="组数">
                  <NumberField
                    size="sm"
                    ariaLabel="组数"
                    unit="组"
                    min={1}
                    max={50}
                    step={1}
                    value={data.sets}
                    onValueChange={(sets) => set({ sets })}
                  />
                </FieldRow>
              ) : (
                <FieldRow label="距离">
                  <NumberField
                    size="sm"
                    ariaLabel="距离"
                    unit="公里"
                    min={0}
                    max={200}
                    step={0.1}
                    format={{ maximumFractionDigits: 1 }}
                    value={data.km}
                    onValueChange={(km) => set({ km })}
                  />
                </FieldRow>
              )}
              <FieldRow label="强度（备注）">
                <Input
                  aria-label="强度"
                  value={data.effort}
                  placeholder="例如：轻松、中等配速、最后两组很吃力"
                  onChange={(ev) => set({ effort: ev.target.value })}
                />
              </FieldRow>
            </div>
          )}
        </>
      ),
    },
    {
      id: 'adv',
      label: '高级选项',
      icon: 'sliders',
      filled: data.advKcal !== null || data.advHr !== null || data.feel.length > 0,
      summary: '可选 · 不写没有影响',
      content: (
        <>
          <FieldRow label="消耗">
            <NumberField
              size="sm"
              ariaLabel="消耗"
              unit="kcal"
              min={0}
              max={3000}
              step={10}
              value={data.advKcal}
              onValueChange={(advKcal) => set({ advKcal })}
            />
          </FieldRow>
          <FieldRow label="平均心率">
            <NumberField
              size="sm"
              ariaLabel="平均心率"
              unit="bpm"
              min={40}
              max={220}
              step={1}
              value={data.advHr}
              onValueChange={(advHr) => set({ advHr })}
            />
          </FieldRow>
          <FieldRow label="整体感受">
            <Input
              aria-label="整体感受"
              value={data.feel}
              placeholder="例如：状态不错、有点累"
              onChange={(ev) => set({ feel: ev.target.value })}
            />
          </FieldRow>
        </>
      ),
    },
  ]

  function onModeChange(mode: FlowMode) {
    // 手动：只带上运动内容，高级选项留空（不写没有影响）；智能：手表截图里有的都补进来
    setData(mode === 'manual' ? { ...scenario.data, ...EMPTY_ADV } : scenario.data)
  }

  function selectScenario(id: string) {
    setScenarioId(id)
    setData(SCENARIOS.find((s) => s.id === id)?.data ?? SCENARIOS[0]!.data)
  }

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
        { name: '运动 · 高级选项', state: '折叠；不写没有影响', open: false },
        { name: '运动 · 本次运动 / 整体评估', state: '全部展开', open: true },
      ]}
      phone={
        <PhoneFlow
          key={scenarioId}
          config={CONFIG}
          sections={sections}
          aiSummary={`${name} · ${e.m} 分钟`}
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
