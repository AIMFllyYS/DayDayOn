'use client'

import { useState } from 'react'
import { BarChart } from '@/components/charts/bar-chart'
import { TrendLineChart, type TrendYTick } from '@/components/charts/trend-line-chart'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { ProgressBar } from '@/components/ui/progress'
import { SegmentedControl } from '@/components/ui/segmented-control'
import type { Tone } from '@/components/ui/tone'
import { gramsToKg } from '@/features/checkin/format'
import type { MetricKind, RatingTrend, StepTrend, WeightTrend } from '@/features/metric/schemas'
import type { LocalDate } from '@/features/shared/schemas'
import {
  computeMoodStats,
  computeStepsStats,
  computeWeightStats,
  filterByDays,
  monthlyAverages,
  weekdayAverages,
  type MetricRangeDays,
} from '../stats'

/*
 * /metrics/[metric] 默认 Tab「统计图」：
 * 基于全仓已有自研 SVG 图表（TrendLineChart / BarChart / ProgressBar），零新增依赖。
 * 复用 365 天走势缓存，30 天 / 90 天 / 近一年瞬时前端切片切换，不发额外请求。
 */

const RANGE_OPTIONS = [
  { value: '30', label: '近 30 天' },
  { value: '90', label: '近 90 天' },
  { value: '365', label: '近一年' },
] as const

const MOOD_LABELS = ['很糟', '不太好', '一般', '不错', '超棒'] as const
const MOOD_TICKS: readonly TrendYTick[] = [
  { value: 5, label: '超棒' },
  { value: 3, label: '一般' },
  { value: 1, label: '很糟' },
]
const MOOD_BUCKET_TONES: Record<1 | 2 | 3 | 4 | 5, Tone> = {
  5: 'success',
  4: 'primary',
  3: 'study',
  2: 'warning',
  1: 'danger',
}

function formatStepsAxis(v: number): string {
  const rounded = Math.round(v)
  if (rounded >= 10_000) return `${(rounded / 10_000).toFixed(1).replace(/\.0$/, '')}万`
  return rounded.toLocaleString('en-US')
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-surface-sunken flex min-w-0 flex-col gap-0.5 rounded-xl px-3 py-2.5">
      <dt className="text-tiny text-muted font-semibold">{label}</dt>
      <dd className="font-display text-subhead truncate font-semibold tabular-nums">{value}</dd>
      {hint && <p className="text-tiny text-muted truncate">{hint}</p>}
    </div>
  )
}

export interface MetricStatsTabProps {
  kind: MetricKind
  todayDate: LocalDate
  weight?: WeightTrend
  mood?: RatingTrend
  steps?: StepTrend
  heightCm?: number | null
  dailyStepTarget: number | null
}

export function MetricStatsTab({
  kind,
  todayDate,
  weight,
  mood,
  steps,
  heightCm = null,
  dailyStepTarget,
}: MetricStatsTabProps) {
  const [rangeStr, setRangeStr] = useState<'30' | '90' | '365'>('90')
  const days: MetricRangeDays = rangeStr === '30' ? 30 : rangeStr === '90' ? 90 : 365
  const rangeLabel = days === 30 ? '近 30 天' : days === 90 ? '近 90 天' : '近一年'

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption text-muted font-semibold">统计周期</span>
        <SegmentedControl
          label="统计周期"
          size="sm"
          value={rangeStr}
          onValueChange={setRangeStr}
          options={RANGE_OPTIONS}
          className="w-56 sm:w-64"
        />
      </div>

      {kind === 'weight' && weight && (
        <WeightStatsSection
          entries={weight.entries}
          todayDate={todayDate}
          days={days}
          rangeLabel={rangeLabel}
          heightCm={heightCm}
        />
      )}

      {kind === 'mood' && mood && (
        <MoodStatsSection
          entries={mood.entries}
          todayDate={todayDate}
          days={days}
          rangeLabel={rangeLabel}
        />
      )}

      {kind === 'steps' && steps && (
        <StepsStatsSection
          entries={steps.entries}
          todayDate={todayDate}
          days={days}
          rangeLabel={rangeLabel}
          dailyStepTarget={dailyStepTarget}
        />
      )}
    </div>
  )
}

function WeightStatsSection({
  entries,
  todayDate,
  days,
  rangeLabel,
  heightCm,
}: {
  entries: WeightTrend['entries']
  todayDate: LocalDate
  days: MetricRangeDays
  rangeLabel: string
  heightCm: number | null
}) {
  const sliced = filterByDays(entries, todayDate, days)
  const stats = computeWeightStats(sliced, heightCm)
  const monthly = monthlyAverages(
    entries.map((e) => ({ localDate: e.localDate, value: gramsToKg(e.weightGrams) })),
    todayDate,
    6,
    1,
  )
  const points = sliced.map((e) => ({ date: e.localDate, value: gramsToKg(e.weightGrams) }))
  const netText =
    stats.netChangeKg === null
      ? '—'
      : stats.netChangeKg === 0
        ? '持平'
        : `${stats.netChangeKg > 0 ? '+' : ''}${stats.netChangeKg.toFixed(1)} kg`

  return (
    <div className="grid gap-3.5 @3xl:grid-cols-2">
      <Card className="@3xl:col-span-2">
        <CardHeader title={`${rangeLabel}体重走势`} description="横向划动或点按可查看单日体重" />
        <TrendLineChart
          chartId="detail-weight"
          data={points}
          endDate={todayDate}
          days={days}
          height={164}
          label={`${rangeLabel}体重走势`}
          tone="primary"
          unit="kg"
          decimals={1}
          defaultSummary={
            stats.count === 0
              ? undefined
              : `${rangeLabel} · 均重 ${stats.avgKg?.toFixed(1)} kg · 区间变化 ${netText}`
          }
          emptyText={`${rangeLabel}还没有体重记录`}
        />
      </Card>

      <Card>
        <CardHeader title="近 6 个月月均体重" description="按自然月汇总平均体重（kg）" />
        <BarChart
          values={monthly.map((m) => m.average)}
          label="近 6 个月月均体重柱状图"
          tone="primary"
          height={88}
        />
        <div className="mt-2 grid grid-cols-6 gap-1 text-center">
          {monthly.map((m) => (
            <div key={m.month} className="min-w-0">
              <p className="font-display text-tiny truncate font-semibold tabular-nums">
                {m.average !== null ? m.average.toFixed(1) : '—'}
              </p>
              <p className="text-tiny text-muted">{m.label}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="区间极值与 BMI 参考" description="仅供参考，非医疗建议">
          {stats.bmiLabel && <Badge tone="primary">{stats.bmiLabel}</Badge>}
        </CardHeader>
        <dl className="grid grid-cols-2 gap-2">
          <StatTile
            label="区间最低"
            value={stats.minKg !== null ? `${stats.minKg.toFixed(1)} kg` : '—'}
          />
          <StatTile
            label="区间最高"
            value={stats.maxKg !== null ? `${stats.maxKg.toFixed(1)} kg` : '—'}
          />
          <StatTile
            label="区间净变化"
            value={netText}
            hint={stats.count >= 2 ? `共记 ${stats.count} 天` : '需至少 2 条记录'}
          />
          <StatTile
            label="参考 BMI"
            value={stats.bmi !== null ? stats.bmi.toFixed(1) : '—'}
            hint={heightCm ? `按身高 ${heightCm} cm 计算` : '在个人资料填身高后计算'}
          />
        </dl>
      </Card>
    </div>
  )
}

function MoodStatsSection({
  entries,
  todayDate,
  days,
  rangeLabel,
}: {
  entries: RatingTrend['entries']
  todayDate: LocalDate
  days: MetricRangeDays
  rangeLabel: string
}) {
  const sliced = filterByDays(entries, todayDate, days)
  const stats = computeMoodStats(sliced)
  const byWeekday = weekdayAverages(
    sliced.map((e) => ({ localDate: e.localDate, value: e.value })),
    1,
  )
  const points = sliced.map((e) => ({ date: e.localDate, value: e.value }))

  return (
    <div className="grid gap-3.5 @3xl:grid-cols-2">
      <Card className="@3xl:col-span-2">
        <CardHeader title={`${rangeLabel}心情走势`} description="1–5 分每日情绪变化曲线" />
        <TrendLineChart
          chartId="detail-mood"
          data={points}
          endDate={todayDate}
          days={days}
          height={164}
          label={`${rangeLabel}心情走势`}
          tone="custom"
          yDomain={[1, 5]}
          yTicks={MOOD_TICKS}
          formatPointValue={(v) => {
            const r = Math.min(5, Math.max(1, Math.round(v)))
            return `${r} 分 · ${MOOD_LABELS[r - 1]}`
          }}
          defaultSummary={
            stats.count === 0
              ? undefined
              : `${rangeLabel} · 均分 ${stats.average?.toFixed(1)} · 好心情 ${stats.goodRate ?? 0}%`
          }
          emptyText={`${rangeLabel}还没有心情记录`}
        />
      </Card>

      <Card>
        <CardHeader title="五档情绪分布" description={`${rangeLabel}各分档天数与占比`} />
        <div className="flex flex-col gap-2.5">
          {stats.distribution.map((b) => (
            <div key={b.value} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-caption font-semibold">
                  {b.value} 分 · {b.label}
                </span>
                <span className="font-display text-tiny text-muted tabular-nums">
                  {b.count} 天（{b.percent}%）
                </span>
              </div>
              <ProgressBar
                value={b.percent}
                max={100}
                tone={MOOD_BUCKET_TONES[b.value]}
                size="sm"
                label={`${b.label}占比 ${b.percent}%`}
              />
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-3.5">
        <Card>
          <CardHeader title="周一至周日心情规律" description="虚线为 4 分（不错）好心情线" />
          <BarChart
            values={byWeekday.map((w) => w.average)}
            label="周一至周日心情均值柱状图"
            tone="custom"
            threshold={4}
            height={88}
          />
          <div className="mt-2 grid grid-cols-7 gap-1 text-center">
            {byWeekday.map((w) => (
              <div key={w.weekday} className="min-w-0">
                <p className="font-display text-tiny font-semibold tabular-nums">
                  {w.average !== null ? w.average.toFixed(1) : '—'}
                </p>
                <p className="text-tiny text-muted">{w.label}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="好心情洞察" description="评分 ≥ 4 分计为好心情日" />
          <dl className="grid grid-cols-3 gap-2">
            <StatTile
              label="好心情占比"
              value={stats.goodRate !== null ? `${stats.goodRate}%` : '—'}
            />
            <StatTile label="最长连击" value={`${stats.longestGoodStreak} 天`} />
            <StatTile label="已记录天数" value={`${stats.count} 天`} />
          </dl>
        </Card>
      </div>
    </div>
  )
}

function StepsStatsSection({
  entries,
  todayDate,
  days,
  rangeLabel,
  dailyStepTarget,
}: {
  entries: StepTrend['entries']
  todayDate: LocalDate
  days: MetricRangeDays
  rangeLabel: string
  dailyStepTarget: number | null
}) {
  const sliced = filterByDays(entries, todayDate, days)
  const stats = computeStepsStats(sliced, todayDate, dailyStepTarget)
  const byWeekday = weekdayAverages(
    sliced.map((e) => ({ localDate: e.localDate, value: e.steps })),
    0,
  )
  const points = sliced.map((e) => ({ date: e.localDate, value: e.steps }))
  const yMax = Math.max(1000, ...sliced.map((e) => e.steps), dailyStepTarget ?? 0)
  const targetLabel =
    dailyStepTarget !== null
      ? `参考虚线 ${dailyStepTarget.toLocaleString('en-US')} 步`
      : '未开启参考虚线'

  return (
    <div className="grid gap-3.5 @3xl:grid-cols-2">
      <Card className="@3xl:col-span-2">
        <CardHeader title={`${rangeLabel}步数走势`} description={targetLabel} />
        <TrendLineChart
          chartId="detail-steps"
          data={points}
          endDate={todayDate}
          days={days}
          height={164}
          label={`${rangeLabel}步数走势`}
          tone="exercise"
          unit="步"
          yDomain={[0, Math.ceil(yMax * 1.15)]}
          formatValue={formatStepsAxis}
          formatPointValue={(v) => `${Math.round(v).toLocaleString('en-US')} 步`}
          referenceLine={
            dailyStepTarget !== null
              ? { value: dailyStepTarget, label: `参考 ${dailyStepTarget.toLocaleString('en-US')}` }
              : null
          }
          defaultSummary={
            stats.count === 0
              ? undefined
              : `${rangeLabel} · 日均 ${stats.avgSteps?.toLocaleString('en-US')} 步 · 最高 ${stats.maxSteps?.toLocaleString('en-US')} 步`
          }
          emptyText={`${rangeLabel}还没有步数记录`}
        />
      </Card>

      <Card>
        <CardHeader
          title="近 14 天每日步数"
          description={
            dailyStepTarget !== null
              ? `实色为达到 ${dailyStepTarget.toLocaleString('en-US')} 步参考线`
              : '最近两周每天步数分布'
          }
        />
        <BarChart
          values={stats.recent14Days.map((d) => d.steps)}
          label="近 14 天每日步数柱状图"
          tone="exercise"
          threshold={dailyStepTarget}
          height={92}
        />
        <div className="text-tiny text-muted mt-2 flex items-center justify-between tabular-nums">
          <span>{stats.recent14Days[0]?.localDate.slice(5)}</span>
          <span>近 14 天</span>
          <span>{stats.recent14Days.at(-1)?.localDate.slice(5)}</span>
        </div>
      </Card>

      <Card>
        <CardHeader title="周一至周日步行节律" description="不同星期平均步数对比" />
        <BarChart
          values={byWeekday.map((w) => w.average)}
          label="周一至周日步数均值柱状图"
          tone="exercise"
          threshold={dailyStepTarget}
          height={92}
        />
        <div className="mt-2 grid grid-cols-7 gap-1 text-center">
          {byWeekday.map((w) => (
            <div key={w.weekday} className="min-w-0">
              <p className="font-display text-tiny truncate font-semibold tabular-nums">
                {w.average !== null ? formatStepsAxis(w.average) : '—'}
              </p>
              <p className="text-tiny text-muted">{w.label}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="@3xl:col-span-2">
        <CardHeader
          title={`${rangeLabel}运动里程与达标摘要`}
          description="按平均步幅约 0.72 米估算"
        />
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="累计步数" value={`${stats.totalSteps.toLocaleString('en-US')} 步`} />
          <StatTile label="估算里程" value={`${stats.estimatedKm.toFixed(1)} km`} />
          <StatTile
            label="最高单日"
            value={stats.maxSteps !== null ? `${stats.maxSteps.toLocaleString('en-US')} 步` : '—'}
            hint={stats.maxDate ?? undefined}
          />
          <StatTile
            label="参考线达标"
            value={
              stats.reachedDays !== null ? `${stats.reachedDays} / ${stats.count} 天` : '已隐藏'
            }
            hint={
              dailyStepTarget !== null
                ? `参考线 ${dailyStepTarget.toLocaleString('en-US')} 步`
                : '可在步数设置中开启'
            }
          />
        </dl>
      </Card>
    </div>
  )
}
