'use client'

import { useState, type ReactNode } from 'react'
import { Icon } from '@/components/ui/icon'
import { Input } from '@/components/ui/field'
import { NumberField } from '@/components/ui/number-field'
import { Rating, type RatingValue } from '@/components/ui/rating'
import { formatSpanMinutes, timeRangeSpan } from '@/components/ui/time-range-field'
import { cn } from '@/lib/cn'
import { FieldRow } from '../../_components/flow/fill-section'
import { FlowStage } from '../../_components/flow/flow-stage'
import type {
  FillSectionSpec,
  FlowMode,
  FlowScenario,
  FolderRow,
  PhoneFlowConfig,
  ReportSpec,
  Verdict,
} from '../../_components/flow/flow-types'
import { PhoneFlow } from '../../_components/flow/phone-flow'
import { TimePicker } from '../../_components/flow/time-picker'

/** 高级选项：不强制填写；智能拍照 / 上传手环截图时一般自带，会自动整理进来 */
interface Advanced {
  /** 分钟 */
  deepMin: number | null
  lightMin: number | null
  /** 睡眠连续性 % */
  continuity: number | null
  /** 快速眼动比例 % */
  rem: number | null
  /** 呼吸质量 0–100 */
  breath: number | null
  /** 心率变异性 ms */
  hrv: number | null
  /** 平均呼吸率 次/分 */
  resp: number | null
}

interface Data extends Advanced {
  start: string
  end: string
  quality: RatingValue | null
  note: string
}

const NO_ADV: Advanced = {
  deepMin: null,
  lightMin: null,
  continuity: null,
  rem: null,
  breath: null,
  hrv: null,
  resp: null,
}

const EMPTY: Data = { start: '', end: '', quality: null, note: '', ...NO_ADV }
const REDLINE = 23 * 60 + 30

const SCENARIOS: (FlowScenario & { data: Data })[] = [
  {
    id: 'a',
    code: 'A',
    title: '按时入睡',
    description: '23:15 入睡，07:10 起，7 小时 55 分；手环截图带全了分期和恢复指标。',
    passed: true,
    data: {
      start: '23:15',
      end: '07:10',
      quality: 4,
      note: '',
      deepMin: 96,
      lightMin: 268,
      continuity: 92,
      rem: 21,
      breath: 88,
      hrv: 52,
      resp: 14.5,
    },
  },
  {
    id: 'b',
    code: 'B',
    title: '熬夜补觉',
    description: '02:15 入睡，10:30 起：睡够了但属熬夜补觉，仅存档；没有任何高级数据。',
    passed: false,
    data: { start: '02:15', end: '10:30', quality: 3, note: '', ...NO_ADV },
  },
  {
    id: 'c',
    code: 'C',
    title: '按时但太短',
    description: '23:05 入睡，03:30 醒：只睡了 4 小时 25 分；截图只识别出部分指标。',
    passed: false,
    data: { start: '23:05', end: '03:30', quality: 2, note: '', ...NO_ADV, hrv: 38, resp: 16 },
  },
  {
    id: 'd',
    code: 'D',
    title: '早睡早起',
    description: '22:40 入睡，06:20 起：7 小时 40 分，比红线早 50 分钟。',
    passed: true,
    data: {
      start: '22:40',
      end: '06:20',
      quality: 5,
      note: '',
      deepMin: 104,
      lightMin: 252,
      continuity: 95,
      rem: 23,
      breath: 91,
      hrv: 61,
      resp: 13.8,
    },
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

function pctOf(part: number | null, whole: number): string {
  return part !== null && whole > 0 ? `占 ${Math.round((part / whole) * 100)}%` : ''
}

/** 没有数据就是空：值显示「—」，不画进度条 */
function metricRow(
  label: string,
  v: number | null,
  unit: string,
  max: number,
  tone: FolderRow['tone'],
  sub?: string,
): FolderRow {
  return v === null
    ? { label, value: '—' }
    : { label, value: `${v} ${unit}`.trim(), ratio: v / max, tone, sub }
}

function buildReport(d: Data): ReportSpec {
  const e = evaluate(d)
  const minutes = e.span?.minutes ?? 0
  const diff = e.axis === null ? 0 : Math.abs(e.axis - REDLINE)
  const stageCount = [d.deepMin, d.lightMin, d.rem].filter((x) => x !== null).length
  const metricCount = [d.continuity, d.breath, d.hrv, d.resp].filter((x) => x !== null).length
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
        headline:
          stageCount === 0
            ? '暂无数据'
            : `深睡 ${d.deepMin !== null ? formatSpanMinutes(Math.max(d.deepMin, 1)) : '—'} · 浅睡 ${d.lightMin !== null ? formatSpanMinutes(Math.max(d.lightMin, 1)) : '—'}`,
        rows: [
          metricRow('深睡', d.deepMin, '分钟', 150, 'sleep', pctOf(d.deepMin, minutes)),
          metricRow('浅睡', d.lightMin, '分钟', 360, 'neutral', pctOf(d.lightMin, minutes)),
          metricRow('快速眼动比例', d.rem, '%', 30, 'study', '常见范围 20–25%'),
        ],
        note: '没有数据时留空；估算结果，非医疗建议。',
      },
      {
        id: 'recovery',
        title: '恢复指标',
        icon: 'bolt',
        tone: 'exercise',
        headline: metricCount === 0 ? '暂无数据' : `已有 ${metricCount} 项数据`,
        rows: [
          metricRow('睡眠连续性', d.continuity, '%', 100, 'sleep', '越高说明夜里醒得越少'),
          metricRow('呼吸质量', d.breath, '分', 100, 'success'),
          metricRow('HRV', d.hrv, 'ms', 100, 'primary', '心率变异性，越高恢复越好'),
          metricRow('平均呼吸率', d.resp, '次/分', 25, 'neutral', '成人常见 12–20 次/分'),
        ],
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

/** 入睡 / 起床：两个时间格，点哪个就在下面展开我们自己的时间选择器 */
function SleepRange({
  start,
  end,
  onStart,
  onEnd,
}: {
  start: string
  end: string
  onStart: (v: string) => void
  onEnd: (v: string) => void
}) {
  const [active, setActive] = useState<'start' | 'end' | null>(null)
  const span = timeRangeSpan(start, end)

  function open(which: 'start' | 'end') {
    if (active === which) return setActive(null)
    // 还没填过就先带上一个常见默认值，选择器会滚到它
    if (which === 'start' && !start) onStart('23:00')
    if (which === 'end' && !end) onEnd('07:00')
    setActive(which)
  }

  const cell = (which: 'start' | 'end', label: string, value: string) => (
    <button
      type="button"
      aria-expanded={active === which}
      onClick={() => open(which)}
      className={cn(
        'flex min-h-14 flex-1 items-center gap-2.5 rounded-lg border px-3 text-left transition-colors',
        active === which
          ? 'border-sleep bg-sleep-soft text-sleep-ink'
          : 'border-border bg-surface-sunken',
      )}
    >
      <Icon name="clock" size={16} className="shrink-0" />
      <span className="flex flex-col">
        <span className="text-tiny text-muted font-semibold">{label}</span>
        <span className="text-subhead font-bold tabular-nums">{value || '--:--'}</span>
      </span>
    </button>
  )

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-2">
        {cell('start', '入睡', start)}
        {cell('end', '起床', end)}
      </div>
      {active && (
        <div key={active} className="animate-fade-up">
          <TimePicker
            label={active === 'start' ? '入睡时间' : '起床时间'}
            tone="sleep"
            value={(active === 'start' ? start : end) || '00:00'}
            onChange={active === 'start' ? onStart : onEnd}
          />
        </div>
      )}
      {span && (
        <p className="text-tiny text-sleep-ink font-semibold">
          共 {formatSpanMinutes(span.minutes)}
          {span.nextDay ? '（跨午夜，起床记为次日）' : ''}
        </p>
      )}
    </div>
  )
}

/** 数字字段：标签在左、输入在右，一行搞定 */
function InlineRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-tiny text-muted w-20 shrink-0 font-semibold">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** 「睡得怎么样」下面的高级选项：默认折叠，全部可不写 */
function AdvancedBox({
  data,
  onChange,
}: {
  data: Advanced
  onChange: (p: Partial<Advanced>) => void
}) {
  const [open, setOpen] = useState(false)
  const filled = (Object.keys(NO_ADV) as (keyof Advanced)[]).filter((k) => data[k] !== null).length
  const num = (label: string, key: keyof Advanced, unit: string, max: number, step = 1) => (
    <InlineRow label={label}>
      <NumberField
        size="sm"
        ariaLabel={label}
        unit={unit}
        min={0}
        max={max}
        step={step}
        format={step < 1 ? { maximumFractionDigits: 1 } : undefined}
        value={data[key]}
        onValueChange={(v) => onChange({ [key]: v })}
      />
    </InlineRow>
  )
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
          <span className="text-tiny text-subtle font-bold">睡眠分期</span>
          {num('深睡', 'deepMin', '分钟', 400)}
          {num('浅睡', 'lightMin', '分钟', 600)}
          <span className="text-tiny text-subtle pt-1 font-bold">常用指标</span>
          {num('睡眠连续性', 'continuity', '%', 100)}
          {num('快速眼动', 'rem', '%', 100)}
          {num('呼吸质量', 'breath', '分', 100)}
          {num('HRV', 'hrv', 'ms', 300)}
          {num('平均呼吸率', 'resp', '次/分', 40, 0.1)}
        </div>
      )}
    </div>
  )
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
      independent: true,
      filled: ready,
      summary: ready
        ? `${data.start} → ${data.end}${e.span?.nextDay ? '（次日）' : ''} · ${formatSpanMinutes(e.span?.minutes ?? 0)}`
        : '设置入睡与起床时间',
      content: (
        <SleepRange
          start={data.start}
          end={data.end}
          onStart={(start) => set({ start })}
          onEnd={(end) => set({ end })}
        />
      ),
    },
    {
      id: 'quality',
      label: '睡得怎么样',
      icon: 'smile',
      independent: true,
      filled: data.quality !== null,
      summary: data.quality
        ? ['很糟', '不太好', '一般', '不错', '超棒'][data.quality - 1]!
        : '选一个表情',
      content: (
        <>
          <FieldRow label="今早的状态">
            <Rating
              label="睡眠质量"
              tone="sleep"
              value={data.quality}
              onValueChange={(quality) => set({ quality })}
            />
          </FieldRow>
          <AdvancedBox data={data} onChange={(p) => set(p)} />
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
      extraDefaults={[
        { name: '睡眠 · 入睡与起床 / 睡得怎么样', state: '默认都展开，互不排斥', open: true },
        {
          name: '睡眠 · 高级选项（在睡得怎么样里）',
          state: '折叠；不写没有影响，报告留空',
          open: false,
        },
      ]}
      phone={
        <PhoneFlow
          key={scenarioId}
          config={CONFIG}
          sections={sections}
          aiSummary={`${data.start} 入睡 · ${data.end} 起床`}
          verdict={verdict}
          canSubmit={ready}
          report={buildReport(data)}
          // 手动：高级数据留空；智能：手环截图里有的都整理进来
          onModeChange={(mode: FlowMode) =>
            setData(mode === 'manual' ? { ...EMPTY, ...NO_ADV, start: '', end: '' } : scenario.data)
          }
        />
      }
    />
  )
}
