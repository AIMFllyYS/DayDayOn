'use client'

import { useState } from 'react'
import { TrendLineChart, type TrendPoint } from '@/components/charts/trend-line-chart'
import { Button, IconButton } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { NumberField } from '@/components/ui/number-field'
import { Rating, type RatingValue } from '@/components/ui/rating'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toast'
import {
  CheckinSheetList,
  FirstCheckinCard,
} from '@/features/checkin/components/checkin-sheet-list'
import type { CheckinLauncherView } from '@/features/checkin/launcher-store'
import type { CheckinToday } from '@/features/checkin/schemas'
import { moodLabel } from '@/features/dashboard/format'
import { SmartActionBar } from './smart-action-bar'

// 演示数据：今天计划内的 5 大板块目标与状态（形状同 GET /checkins/today）
const id = (n: number) => `00000000-0000-7000-8000-00000000000${n}`
const demo: CheckinToday = {
  localDate: '2026-11-03',
  goals: [
    {
      goalId: id(1),
      module: 'exercise',
      title: '动一动',
      target: { kind: 'duration', value: 1800 },
      planned: true,
      progress: { value: 1920, target: 1800, done: true },
      sortOrder: 0,
    },
    {
      goalId: id(2),
      module: 'diet',
      title: '好好吃饭',
      target: { kind: 'count', value: 3 },
      planned: true,
      progress: { value: 2, target: 3, done: false },
      sortOrder: 1,
    },
    {
      goalId: id(3),
      module: 'sleep',
      title: '早点睡',
      target: { kind: 'duration', value: 28_800 },
      planned: true,
      progress: { value: 25_920, target: 28_800, done: false },
      sortOrder: 2,
    },
    {
      goalId: id(4),
      module: 'study',
      title: '学一点',
      target: { kind: 'count', value: 2 },
      planned: true,
      progress: { value: 0, target: 2, done: false },
      sortOrder: 3,
    },
    {
      goalId: id(5),
      module: 'custom',
      title: '我的小目标',
      target: { kind: 'count', value: 1 },
      planned: true,
      progress: { value: 0, target: 1, done: false },
      sortOrder: 4,
    },
  ],
  completion: { done: 1, planned: 5 },
  weightGrams: 52_400,
  mood: 4,
  dietPhotoGoalId: id(2),
}

const DEMO_WEIGHT_YEAR: TrendPoint[] = [
  { date: '2026-01-12', value: 55.2 },
  { date: '2026-02-05', value: 54.8 },
  { date: '2026-04-18', value: 54.1 },
  { date: '2026-05-10', value: 53.7 },
  { date: '2026-08-02', value: 53.1 },
  { date: '2026-09-20', value: 52.8 },
  { date: '2026-10-25', value: 52.6 },
  { date: '2026-11-03', value: 52.4 },
]

const DEMO_MOOD_YEAR: TrendPoint[] = [
  { date: '2026-01-20', value: 3 },
  { date: '2026-02-14', value: 4 },
  { date: '2026-04-22', value: 2 },
  { date: '2026-05-15', value: 5 },
  { date: '2026-08-18', value: 4 },
  { date: '2026-10-12', value: 3 },
  { date: '2026-11-03', value: 4 },
]

const DEMO_STEPS_YEAR: TrendPoint[] = [
  { date: '2026-01-15', value: 6800 },
  { date: '2026-03-08', value: 9200 },
  { date: '2026-05-20', value: 7500 },
  { date: '2026-07-12', value: 11200 },
  { date: '2026-09-18', value: 8400 },
  { date: '2026-10-28', value: 6200 },
  { date: '2026-11-03', value: 8650 },
]

const MOOD_Y_TICKS = [
  { value: 5, label: '超棒' },
  { value: 3, label: '一般' },
  { value: 1, label: '很糟' },
] as const

const CLOCK_META: Record<CheckinLauncherView, { label: string; route: string }> = {
  list: { label: '历史拍摄记录', route: '/checkin/smart?view=history' },
  weight: { label: '体重统计与记录', route: '/metrics/weight' },
  mood: { label: '心情统计与记录', route: '/metrics/mood' },
  steps: { label: '步数统计与记录', route: '/metrics/steps' },
}

/**
 * 打卡入口弹层（演示）：渲染正式的 CheckinSheetList（D3），数据是演示用的。
 * 体重 / 心情 / 步数三个指标 Dock 统一移除底部「返回打卡列表」，点击空白处收起，右上角时钟跳转各自详情页。
 */
export function CheckinSheet({
  open,
  onOpenChange,
  onSmartAction,
  onGoalNavigate,
  empty = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSmartAction?: (mode: 'capture' | 'upload') => void
  onGoalNavigate?: () => void
  /** 演示一个目标都没有：只剩虚线卡「建立你的第一个打卡」+ 体重 / 心情两行 */
  empty?: boolean
}) {
  const [view, setView] = useState<CheckinLauncherView>('list')
  const [weightKg, setWeightKg] = useState<number | null>(52.4)
  const [weightPoints, setWeightPoints] = useState<TrendPoint[]>(DEMO_WEIGHT_YEAR)
  const [mood, setMood] = useState<RatingValue | null>(4)
  const [moodPoints, setMoodPoints] = useState<TrendPoint[]>(DEMO_MOOD_YEAR)
  const [steps, setSteps] = useState<number | null>(8650)
  const [stepPoints, setStepPoints] = useState<TrendPoint[]>(DEMO_STEPS_YEAR)

  function handleSmart(mode: 'capture' | 'upload') {
    onOpenChange(false)
    setView('list')
    if (onSmartAction) {
      onSmartAction(mode)
    } else {
      toast.info(
        mode === 'capture'
          ? '已触发「智能拍照」→ 跳转至智能识别页面（/checkin/smart）'
          : '已触发「智能上传」（支持图片 / HTML / TXT）→ 跳转至智能识别页面（/checkin/smart）',
      )
    }
  }

  const clock = CLOCK_META[view]

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setView('list')
      }}
      title={
        view === 'list'
          ? '记录点什么？'
          : view === 'weight'
            ? '记体重'
            : view === 'mood'
              ? '今日心情'
              : '今日步数'
      }
      description={
        view === 'list'
          ? `今天完成了 ${demo.completion.done} / ${demo.completion.planned} 个目标`
          : view === 'weight'
            ? '每天一条，再记就覆盖'
            : view === 'mood'
              ? '今天整体感觉怎么样？'
              : '支持同步手机计步或手动记录今日步数'
      }
      headerActions={
        <IconButton
          icon="clock"
          label={clock.label}
          onClick={() => {
            onOpenChange(false)
            toast.info(`已跳转至「${clock.label}」（${clock.route}）`)
          }}
        />
      }
      footer={
        view === 'list' ? (
          <SmartActionBar
            enableFileInputs
            onCapture={() => handleSmart('capture')}
            onUpload={() => handleSmart('upload')}
          />
        ) : undefined
      }
    >
      {view === 'list' && empty ? (
        <div className="flex flex-col gap-3">
          <FirstCheckinCard onNavigate={() => onOpenChange(false)} />
          <CheckinSheetList
            data={{ ...demo, goals: [], completion: { done: 0, planned: 0 } }}
            onNavigate={() => onOpenChange(false)}
            onOpenView={setView}
            metricsOnly
          />
        </div>
      ) : view === 'list' ? (
        <CheckinSheetList
          data={demo}
          onNavigate={() => {
            onOpenChange(false)
            onGoalNavigate?.()
          }}
          onOpenView={setView}
        />
      ) : view === 'weight' ? (
        <div className="flex flex-col gap-3.5 py-1">
          <TrendLineChart
            data={weightPoints}
            endDate={demo.localDate}
            label="近一年体重变化"
            unit="kg"
            decimals={1}
            tone="primary"
          />
          <Field label="今天的体重" htmlFor="pb-checkin-weight" hint="体重只有你自己看得到">
            <NumberField
              id="pb-checkin-weight"
              value={weightKg}
              onValueChange={setWeightKg}
              min={20}
              max={300}
              step={0.1}
              unit="kg"
              format={{ maximumFractionDigits: 1 }}
              placeholder="60.0"
            />
          </Field>
          <Button
            icon="check"
            className="w-full"
            onClick={() => {
              if (weightKg === null) return
              setWeightPoints((prev) => [
                ...prev.filter((p) => p.date !== demo.localDate),
                { date: demo.localDate, value: weightKg },
              ])
              toast.success('体重记好了（预览态已实时落点）')
            }}
          >
            记下来
          </Button>
        </div>
      ) : view === 'mood' ? (
        <div className="flex flex-col gap-3.5 py-1">
          <TrendLineChart
            data={moodPoints}
            endDate={demo.localDate}
            label="近一年心情变化"
            tone="primary"
            yDomain={[1, 5]}
            yTicks={MOOD_Y_TICKS}
            formatPointValue={(v) => `${v} 分 · ${moodLabel(v)}`}
            defaultSummary={`近一年 · 均分 ${(
              moodPoints.reduce((s, p) => s + p.value, 0) / Math.max(1, moodPoints.length)
            ).toFixed(1)} · 记录 ${moodPoints.length} 天`}
          />
          <Rating
            value={mood}
            onValueChange={(v) => {
              setMood(v)
              setMoodPoints((prev) => [
                ...prev.filter((p) => p.date !== demo.localDate),
                { date: demo.localDate, value: v },
              ])
              toast.success('今日心情已记录（预览态已实时落点）')
            }}
            label="今日心情"
            tone="primary"
            className="justify-between"
          />
          <p className="text-tiny text-muted">每天一条，再评一次会覆盖</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5 py-1">
          <TrendLineChart
            data={stepPoints}
            endDate={demo.localDate}
            label="近一年步数变化"
            tone="exercise"
            unit="步"
            yDomain={[0, 14000]}
            formatPointValue={(v) => `${Math.round(v).toLocaleString('en-US')} 步`}
            referenceLine={{ value: 8000, label: '参考 8,000' }}
            defaultSummary="近一年 · 日均 8,278 步 · 最高 11,200 步"
          />
          <Field label="今天的步数" htmlFor="pb-checkin-steps" hint="支持输入手机、手表或手环步数">
            <NumberField
              id="pb-checkin-steps"
              value={steps}
              onValueChange={setSteps}
              min={0}
              max={200000}
              step={500}
              unit="步"
              format={{ maximumFractionDigits: 0 }}
              placeholder="8000"
            />
          </Field>
          <div className="flex flex-col gap-2">
            <Button
              icon="check"
              className="w-full"
              onClick={() => {
                if (steps === null) return
                setStepPoints((prev) => [
                  ...prev.filter((p) => p.date !== demo.localDate),
                  { date: demo.localDate, value: steps },
                ])
                toast.success(`已记 ${steps.toLocaleString('en-US')} 步（预览态已实时落点）`)
              }}
            >
              记下来
            </Button>
            <Button
              variant="soft"
              icon="footprints"
              className="w-full"
              onClick={() => {
                setSteps(9320)
                setStepPoints((prev) => [
                  ...prev.filter((p) => p.date !== demo.localDate),
                  { date: demo.localDate, value: 9320 },
                ])
                toast.success('已模拟同步手机计步器 9,320 步')
              }}
            >
              一键同步手机计步器
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
