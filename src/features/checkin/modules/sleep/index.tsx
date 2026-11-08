'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/field'
import { NumberField } from '@/components/ui/number-field'
import { Rating, type RatingValue } from '@/components/ui/rating'
import type { RulesOf, Verdict } from '@/features/referee/schemas'
import { formatDuration, formatTime, sleepRangeForDay } from '@/lib/time'
import type { CreateCheckinInput } from '../../schemas'
import type { SmartRecognitionDraft } from '../../smart-schemas'
import { InlineRow } from '../../flow/fields/inputs'
import { TimePicker } from '../../flow/time-picker'
import type { FillSectionSpec, FolderRow, ReportSpec } from '../../flow/types'
import { SleepRulesEditor } from '../rules-editors'
import type { CheckinModuleDef, ModuleDocs, ModuleFormApi, ModuleFormProps } from '../types'

/*
 * 早点睡（Playbook sleep-flow）：「入睡与起床」「睡得怎么样」两个独立分区默认并列展开，备注折叠。
 * 起床早于入睡自动记为次日；高级指标（深睡、HRV…）不强制，手环截图识别时自动整理。
 */

interface Adv {
  deepMin: number | null
  lightMin: number | null
  remPct: number | null
  hrvMs: number | null
}

function useSleepForm({ clock, today, todayCheckins }: ModuleFormProps): ModuleFormApi {
  const savedLatest = todayCheckins?.find((c) => c.payload.module === 'sleep')
  const savedSleep = savedLatest?.payload.module === 'sleep' ? savedLatest.payload : null
  const [start, setStart] = useState(() =>
    savedSleep ? formatTime(savedSleep.bedAt, clock.timeZone) : '23:00',
  )
  const [end, setEnd] = useState(() =>
    savedSleep ? formatTime(savedSleep.wakeAt, clock.timeZone) : '07:00',
  )
  const [quality, setQuality] = useState<RatingValue | null>(
    () => (savedSleep?.quality as RatingValue | undefined) ?? null,
  )
  const [note, setNote] = useState(savedLatest?.note ?? '')
  const [adv, setAdv] = useState<Adv>(() => ({
    deepMin: savedSleep?.advanced?.deepMin ?? null,
    lightMin: savedSleep?.advanced?.lightMin ?? null,
    remPct: savedSleep?.advanced?.remPct ?? null,
    hrvMs: savedSleep?.advanced?.hrvMs ?? null,
  }))
  const range = sleepRangeForDay(today, start, end, clock.timeZone, clock.dayStartHour)
  const minutes = range ? Math.round(range.durationSeconds / 60) : 0
  const durOk = minutes >= 30 && minutes <= 1200

  const sections: FillSectionSpec[] = [
    {
      id: 'times',
      label: '入睡与起床',
      icon: 'clock',
      independent: true,
      filled: Boolean(range),
      summary: range
        ? `${start} → ${end}${range.nextDay ? '（次日）' : ''} · ${formatDuration(range.durationSeconds)}`
        : '入睡和起床不能是同一时刻',
      content: (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-tiny text-muted font-semibold">入睡</span>
            <TimePicker label="入睡时间" tone="sleep" value={start} onChange={setStart} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-tiny text-muted font-semibold">
              起床{range?.nextDay ? '（次日）' : ''}
            </span>
            <TimePicker label="起床时间" tone="sleep" value={end} onChange={setEnd} />
          </div>
        </div>
      ),
    },
    {
      id: 'quality',
      label: '睡得怎么样',
      icon: 'sleep',
      independent: true,
      filled: quality !== null,
      summary: quality ? `${quality} 星` : '给昨晚打个分',
      content: (
        <>
          <Rating value={quality} onValueChange={setQuality} tone="sleep" label="睡眠质量" />
          <details className="group">
            <summary className="text-tiny text-primary-ink inline-flex min-h-8 cursor-pointer list-none items-center font-semibold">
              高级选项（手环数据，不写没有影响）
            </summary>
            <div className="bg-surface-sunken mt-1 flex flex-col gap-2 rounded-lg p-2.5">
              {(
                [
                  ['deepMin', '深睡', '分钟', 720],
                  ['lightMin', '浅睡', '分钟', 1200],
                  ['remPct', '快速眼动', '%', 100],
                  ['hrvMs', 'HRV', 'ms', 300],
                ] as const
              ).map(([k, label, unit, max]) => (
                <InlineRow key={k} label={label}>
                  <NumberField
                    size="sm"
                    ariaLabel={label}
                    unit={unit}
                    min={0}
                    max={max}
                    value={adv[k]}
                    onValueChange={(v) => setAdv((a) => ({ ...a, [k]: v }))}
                  />
                </InlineRow>
              ))}
            </div>
          </details>
        </>
      ),
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
          placeholder="例如：睡前看了会儿手机"
          onChange={(e) => setNote(e.target.value)}
        />
      ),
    },
  ]

  const advanced = Object.fromEntries(Object.entries(adv).filter(([, v]) => v !== null))
  function sleepInput(
    s: string,
    e: string,
    q: RatingValue | null,
    n: string,
  ): CreateCheckinInput | null {
    const r = sleepRangeForDay(today, s, e, clock.timeZone, clock.dayStartHour)
    if (!r || q === null) return null
    return {
      module: 'sleep',
      bedAt: r.bedAt.toISOString(),
      wakeAt: r.wakeAt.toISOString(),
      quality: q,
      ...(Object.keys(advanced).length > 0 ? { advanced } : {}),
      note: n.trim() || null,
    }
  }
  return {
    note,
    sections,
    canSubmit: Boolean(range) && durOk && quality !== null,
    aiSummary: range ? `${start} → ${end} · ${formatDuration(range.durationSeconds)}` : '睡眠',
    toInput: () => sleepInput(start, end, quality, note),
    applySmart: (draft: SmartRecognitionDraft) => {
      const d = draft.sleep
      if (!d) return null
      const q = d.quality as RatingValue
      setStart(d.bedTime)
      setEnd(d.wakeTime)
      setQuality(q)
      if (d.note) setNote(d.note)
      return sleepInput(d.bedTime, d.wakeTime, q, d.note ?? note)
    },
  }
}

function pct(part: number | null | undefined, whole: number): string | undefined {
  return part != null && whole > 0 ? `占 ${Math.round((part / whole) * 100)}%` : undefined
}

function buildSleepReport(verdict: Verdict, input: CreateCheckinInput): ReportSpec {
  const m = verdict.metrics
  const minutes = Number(m.minutes ?? 0)
  const adv = input.module === 'sleep' ? input.advanced : undefined
  const late = typeof m.lateByMinutes === 'number' ? m.lateByMinutes : null
  const rows: FolderRow[] = [
    {
      label: '入睡',
      value: String(m.bedLocal ?? '—'),
      sub:
        late !== null
          ? late <= 0
            ? `比红线早 ${-late} 分钟`
            : `比红线晚 ${late} 分钟`
          : undefined,
      tone: late !== null && late > 0 ? 'warning' : 'success',
    },
    { label: '起床', value: String(m.wakeLocal ?? '—') },
    { label: '时长', value: `${m.hours ?? 0} 小时`, ratio: minutes / 570, tone: 'sleep' },
  ]
  const stages: FolderRow[] = adv
    ? [
        ...(adv.deepMin != null
          ? [{ label: '深睡', value: `${adv.deepMin} 分钟`, sub: pct(adv.deepMin, minutes) }]
          : []),
        ...(adv.lightMin != null
          ? [{ label: '浅睡', value: `${adv.lightMin} 分钟`, sub: pct(adv.lightMin, minutes) }]
          : []),
        ...(adv.remPct != null ? [{ label: '快速眼动', value: `${adv.remPct}%` }] : []),
        ...(adv.hrvMs != null ? [{ label: 'HRV', value: `${adv.hrvMs} ms` }] : []),
      ]
    : []
  return {
    title: `睡眠分析 · ${verdict.isValid ? '有效早睡' : '仅存档'}`,
    folders: [
      {
        id: 'rhythm',
        title: '作息',
        icon: 'clock',
        tone: 'sleep',
        defaultOpen: true,
        headline: verdict.detail,
        rows,
      },
      ...(stages.length > 0
        ? [
            {
              id: 'stages',
              title: '睡眠分期',
              icon: 'sleep' as const,
              tone: 'study' as const,
              headline: '来自手环数据，估算结果',
              rows: stages,
            },
          ]
        : []),
      {
        id: 'regularity',
        title: '规律度',
        icon: 'calendar',
        tone: 'primary',
        headline:
          m.regularityMinutes == null
            ? '记录满两晚后显示'
            : `最近入睡时间平均偏差 ${m.regularityMinutes} 分钟`,
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
    ],
  }
}

function sleepDocs(rules: RulesOf<'sleep'>): ModuleDocs {
  return {
    glance: {
      threshold: `入睡不晚于 ${rules.bedtimeBy}，且睡满 ${rules.minHours}–${rules.maxHours} 小时`,
      tagline: '入睡红线 + 有效时长，双门槛',
      pass: '23:15 入睡 → 07:10 起 · 7h55m',
      block: '02:15 入睡 → 10:30 起，属熬夜补觉，仅存档',
    },
    rulesDoc: {
      title: '达标规则',
      sections: [
        {
          heading: '双门槛，缺一不可',
          items: [
            `入睡不晚于 ${rules.bedtimeBy}`,
            `有效睡眠 ${rules.minHours}–${rules.maxHours} 小时`,
            '红线和时长在「我的 → 目标设置」里改',
          ],
        },
        {
          heading: '没达标怎么办',
          items: ['熬夜补觉照常存档，进睡眠趋势', '主按钮变成「仅保存记录」，不报错'],
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
          items: ['起床早于入睡，自动记为次日', '中午前的入睡时刻视为已过午夜'],
        },
        { heading: '免责', items: ['睡眠分期为估算结果，非医疗建议'] },
      ],
    },
  }
}

export const sleepModule: CheckinModuleDef<'sleep'> = {
  module: 'sleep',
  tone: 'sleep',
  title: '早睡打卡',
  agentSteps: ['读取入睡与起床时刻', '看最近几晚的作息', '核对红线与时长'],
  useForm: useSleepForm,
  RulesEditor: SleepRulesEditor,
  docs: sleepDocs,
  buildReport: buildSleepReport,
}
