'use client'

import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/error-state'
import type { IconName } from '@/components/ui/icon'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import type { Tone } from '@/components/ui/tone'
import { gramsToKg } from '@/features/checkin/format'
import {
  DEFAULT_DAILY_STEP_TARGET,
  type MetricKind,
  type RatingTrend,
  type StepTrend,
  type WeightTrend,
} from '@/features/metric/schemas'
import type { LocalDate } from '@/features/shared/schemas'
import { errorMessage, isApiError, useQuery } from '@/lib/api'
import { checkinTodayQuery } from '@/lib/api/queries/checkins'
import { useMe, useUpdatePreferences } from '@/lib/api/queries/me'
import { ratingTrendQuery, stepTrendQuery, weightTrendQuery } from '@/lib/api/queries/metrics'
import { useLazyMount } from '@/lib/lazy'
import { addDays } from '@/lib/time'
import { MetricRecordsTab } from './metric-records-tab'
import { MetricStatsTab } from './metric-stats-tab'

const MetricQuickEditSheet = dynamic(
  () => import('./metric-quick-edit-sheet').then((m) => m.MetricQuickEditSheet),
  { loading: () => null },
)

const StepTargetSheet = dynamic(
  () => import('./step-target-sheet').then((m) => m.StepTargetSheet),
  { loading: () => null },
)

/*
 * /metrics/[metric] 与 /friends/[friendUserId]/metrics/[metric] 共用双 Tab 详情页核心：
 * - MetricDetailView：本人视角数据容器（含「记今日 / 补昨日」与「步数设置」写操作）；
 * - MetricDetailContent：纯展示核心（readOnly / friendUserId 时隐藏全部写按钮与编辑抽屉，仅做透明只读浏览）。
 */

type DetailTab = 'stats' | 'records'

const TAB_OPTIONS = [
  { value: 'stats', label: '统计图' },
  { value: 'records', label: '详细记录' },
] as const

const MOOD_LABELS = ['很糟', '不太好', '一般', '不错', '超棒'] as const

const METRIC_HEADER: Record<
  MetricKind,
  { title: string; subtitle: string; friendSubtitle: string; icon: IconName; tone: Tone }
> = {
  weight: {
    title: '体重记录与趋势',
    subtitle: '仅自己可见，不参与公开与排行',
    friendSubtitle: '好友透明监督 · 仅查看，不可修改',
    icon: 'chart',
    tone: 'primary',
  },
  mood: {
    title: '心情记录与趋势',
    subtitle: '每天一记，看见自己的情绪节律',
    friendSubtitle: '好友每日情绪曲线与心情分布（只读）',
    icon: 'heart',
    tone: 'custom',
  },
  steps: {
    title: '步数记录与趋势',
    subtitle: '每日步行轨迹、里程估算与参考线达标情况',
    friendSubtitle: '好友每日步行轨迹、里程估算与参考线达标情况',
    icon: 'footprints',
    tone: 'exercise',
  },
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-sunken flex min-w-0 flex-col gap-0.5 rounded-xl px-3 py-2">
      <dt className="text-tiny text-muted font-semibold">{label}</dt>
      <dd className="font-display text-subhead truncate font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

/** 本人视角 /metrics/[metric] 数据容器 */
export function MetricDetailView({ kind }: { kind: MetricKind }) {
  const today = useQuery(checkinTodayQuery())
  const { data: me } = useMe()

  const weight = useQuery({ ...weightTrendQuery(365), enabled: kind === 'weight' })
  const mood = useQuery({ ...ratingTrendQuery('overall', 365), enabled: kind === 'mood' })
  const steps = useQuery({ ...stepTrendQuery(365), enabled: kind === 'steps' })

  const activeTrend = kind === 'weight' ? weight : kind === 'mood' ? mood : steps

  if (today.isPending || activeTrend.isPending) {
    return <MetricDetailSkeleton />
  }
  const err = today.error ?? activeTrend.error
  if (!today.data || err) {
    return (
      <ErrorState
        title="指标数据没加载出来"
        message={isApiError(err) ? errorMessage(err) : undefined}
        onRetry={() => {
          void today.refetch()
          void activeTrend.refetch()
        }}
        retrying={today.isRefetching || activeTrend.isRefetching}
      />
    )
  }

  return (
    <MetricDetailContent
      kind={kind}
      todayDate={today.data.localDate}
      weight={weight.data}
      mood={mood.data}
      steps={steps.data}
      heightCm={me?.profile.heightCm ?? null}
      dailyStepTarget={me ? me.preferences.dailyStepTarget : DEFAULT_DAILY_STEP_TARGET}
    />
  )
}

export interface MetricDetailContentProps {
  kind: MetricKind
  todayDate: LocalDate
  weight?: WeightTrend
  mood?: RatingTrend
  steps?: StepTrend
  heightCm?: number | null
  dailyStepTarget: number | null
  readOnly?: boolean
  /** 好友只读模式：传入好友 userId 透传给「详细记录」Tab */
  friendUserId?: string
}

/** 双 Tab 指标详情核心内容（本人与好友只读共用） */
export function MetricDetailContent({
  kind,
  todayDate,
  weight,
  mood,
  steps,
  heightCm = null,
  dailyStepTarget,
  readOnly = false,
  friendUserId,
}: MetricDetailContentProps) {
  const isReadOnly = readOnly || Boolean(friendUserId)
  const searchParams = useSearchParams()
  const initialTab: DetailTab = searchParams.get('tab') === 'records' ? 'records' : 'stats'
  const [tab, setTab] = useState<DetailTab>(initialTab)
  const [editDate, setEditDate] = useState<LocalDate | null>(null)
  const editLoaded = useLazyMount(!isReadOnly && editDate !== null)
  const [stepTargetOpen, setStepTargetOpen] = useState(false)
  const stepTargetLoaded = useLazyMount(!isReadOnly && stepTargetOpen)
  const updatePrefs = useUpdatePreferences()

  const yesterdayDate = addDays(todayDate, -1)
  const meta = METRIC_HEADER[kind]

  let todayValue: number | null = null
  let yesterdayValue: number | null = null
  let headerStats: readonly { label: string; value: string }[] = []

  if (kind === 'weight' && weight) {
    todayValue = weight.entries.find((e) => e.localDate === todayDate)?.weightGrams ?? null
    yesterdayValue = weight.entries.find((e) => e.localDate === yesterdayDate)?.weightGrams ?? null
    const latest = weight.latest
    const delta7 = weight.deltaGrams7d
    headerStats = [
      {
        label: '最近记录',
        value: latest ? `${gramsToKg(latest.weightGrams).toFixed(1)} kg` : '未记录',
      },
      {
        label: '7 天变化',
        value:
          delta7 === null
            ? '—'
            : delta7 === 0
              ? '持平'
              : `${delta7 > 0 ? '+' : ''}${(delta7 / 1000).toFixed(1)} kg`,
      },
      { label: '近一年记录', value: `${weight.entries.length} 天` },
    ]
  } else if (kind === 'mood' && mood) {
    todayValue = mood.entries.find((e) => e.localDate === todayDate)?.value ?? null
    yesterdayValue = mood.entries.find((e) => e.localDate === yesterdayDate)?.value ?? null
    headerStats = [
      {
        label: '今日心情',
        value: todayValue ? `${todayValue} 分 · ${MOOD_LABELS[todayValue - 1]}` : '未记录',
      },
      {
        label: '近一年均分',
        value: mood.average !== null ? `${mood.average.toFixed(1)} 分` : '—',
      },
      { label: '近一年记录', value: `${mood.count} 天` },
    ]
  } else if (kind === 'steps' && steps) {
    todayValue = steps.entries.find((e) => e.localDate === todayDate)?.steps ?? null
    yesterdayValue = steps.entries.find((e) => e.localDate === yesterdayDate)?.steps ?? null
    const avg =
      steps.entries.length > 0
        ? Math.round(steps.entries.reduce((s, e) => s + e.steps, 0) / steps.entries.length)
        : null
    headerStats = [
      {
        label: '今日步数',
        value: todayValue !== null ? `${todayValue.toLocaleString('en-US')} 步` : '未记录',
      },
      {
        label: '近一年日均',
        value: avg !== null ? `${avg.toLocaleString('en-US')} 步` : '—',
      },
      {
        label: '参考虚线',
        value:
          dailyStepTarget !== null ? `${dailyStepTarget.toLocaleString('en-US')} 步` : '已隐藏',
      },
    ]
  }

  function handleTabChange(next: DetailTab) {
    setTab(next)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (next === 'stats') url.searchParams.delete('tab')
      else url.searchParams.set('tab', next)
      window.history.replaceState(null, '', url.pathname + url.search)
    }
  }

  return (
    <div className="animate-content-reveal flex flex-col gap-4 pb-8">
      {/* 指标专属顶部概览头（区别于 /goals/[goalId] 的 GoalSummaryCard） */}
      <Card variant="sticker" className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <IconTile icon={meta.icon} tone={meta.tone} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="text-heading font-bold break-words">{meta.title}</h2>
            <p className="text-caption text-muted">
              {isReadOnly ? meta.friendSubtitle : meta.subtitle}
            </p>
          </div>
          {!isReadOnly && kind === 'steps' && (
            <Button variant="soft" size="sm" icon="sliders" onClick={() => setStepTargetOpen(true)}>
              步数设置
            </Button>
          )}
        </div>

        <dl className="grid grid-cols-3 gap-2">
          {headerStats.map((s) => (
            <HeaderStat key={s.label} label={s.label} value={s.value} />
          ))}
        </dl>

        {!isReadOnly && (
          <div className="grid grid-cols-2 gap-2">
            <Button icon="check" onClick={() => setEditDate(todayDate)}>
              {todayValue !== null ? '修改今日' : '记今日'}
            </Button>
            <Button variant="secondary" icon="clock" onClick={() => setEditDate(yesterdayDate)}>
              {yesterdayValue !== null ? '修改昨日' : '补昨日'}
            </Button>
          </div>
        )}
      </Card>

      {/* 双 Tab 切换：默认先展示「统计图」，次选「详细记录」 */}
      <SegmentedControl
        label="指标详情视图"
        value={tab}
        onValueChange={handleTabChange}
        options={TAB_OPTIONS}
      />

      {tab === 'stats' ? (
        <MetricStatsTab
          kind={kind}
          todayDate={todayDate}
          weight={weight}
          mood={mood}
          steps={steps}
          heightCm={heightCm}
          dailyStepTarget={dailyStepTarget}
          readOnly={isReadOnly}
        />
      ) : (
        <MetricRecordsTab
          kind={kind}
          todayDate={todayDate}
          yesterdayDate={yesterdayDate}
          dailyStepTarget={dailyStepTarget}
          readOnly={isReadOnly}
          friendUserId={friendUserId}
          onEditDate={isReadOnly ? undefined : (d) => setEditDate(d)}
        />
      )}

      {!isReadOnly && editLoaded && (
        <MetricQuickEditSheet
          open={editDate !== null}
          onOpenChange={(open) => {
            if (!open) setEditDate(null)
          }}
          kind={kind}
          todayDate={todayDate}
          yesterdayDate={yesterdayDate}
          initialDate={editDate ?? todayDate}
          todayValue={todayValue}
          yesterdayValue={yesterdayValue}
        />
      )}

      {!isReadOnly && kind === 'steps' && stepTargetLoaded && (
        <StepTargetSheet
          open={stepTargetOpen}
          onOpenChange={setStepTargetOpen}
          currentTarget={dailyStepTarget}
          saving={updatePrefs.isPending}
          onSave={(next) => {
            updatePrefs.mutate(
              { dailyStepTarget: next },
              {
                onSuccess: () => {
                  toast.success(
                    next !== null
                      ? `步数参考线已设为 ${next.toLocaleString('en-US')} 步`
                      : '已隐藏步数参考虚线',
                  )
                  setStepTargetOpen(false)
                },
                onError: (e) => {
                  toast.error(isApiError(e) ? errorMessage(e) : '保存失败，请稍后重试')
                },
              },
            )
          }}
        />
      )}
    </div>
  )
}

export function MetricDetailSkeleton() {
  return (
    <div role="status" aria-label="加载中" className="flex flex-col gap-4">
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-10 w-full rounded-full" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  )
}
