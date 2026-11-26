'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { NumberField } from '@/components/ui/number-field'
import { Rating, type RatingValue } from '@/components/ui/rating'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toast'
import { gramsToKg, kgToGrams } from '@/features/checkin/format'
import {
  STEPS_MAX,
  STEPS_MIN,
  WEIGHT_MAX_GRAMS,
  WEIGHT_MIN_GRAMS,
  type MetricKind,
} from '@/features/metric/schemas'
import type { LocalDate } from '@/features/shared/schemas'
import { errorMessage, isApiError } from '@/lib/api'
import { usePutRating, usePutSteps, usePutWeight } from '@/lib/api/queries/metrics'
import { formatLocalDateLabel } from '@/lib/time'

/*
 * /metrics/[metric] 详情页用的今日/昨日快捷记一笔 / 修改 Dock 弹层：
 * 严格遵循今日/昨日 2 天可写窗口，复用 PUT /metrics/weight | /ratings | /metrics/steps。
 */

const MOOD_LABELS = ['很糟', '不太好', '一般', '不错', '超棒'] as const

const SHEET_TITLE: Record<MetricKind, string> = {
  weight: '记录体重',
  mood: '记录心情',
  steps: '记录步数',
}

export interface MetricQuickEditSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: MetricKind
  todayDate: LocalDate
  yesterdayDate: LocalDate
  /** 初始选中的日期（今天或昨天） */
  initialDate: LocalDate
  /** 今天已记录的原始整数值（weight=克 / mood=1..5 / steps=步） */
  todayValue: number | null
  /** 昨天已记录的原始整数值 */
  yesterdayValue: number | null
}

export function MetricQuickEditSheet({
  open,
  onOpenChange,
  kind,
  todayDate,
  yesterdayDate,
  initialDate,
  todayValue,
  yesterdayValue,
}: MetricQuickEditSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={SHEET_TITLE[kind]}
      description="支持记录或修改今天与昨天的数据，同一天重新提交将覆盖原值"
    >
      {open && (
        <QuickEditForm
          key={`${kind}-${initialDate}-${String(todayValue)}-${String(yesterdayValue)}`}
          kind={kind}
          todayDate={todayDate}
          yesterdayDate={yesterdayDate}
          initialDate={initialDate}
          todayValue={todayValue}
          yesterdayValue={yesterdayValue}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Sheet>
  )
}

function toRatingValue(v: number | null): RatingValue | null {
  if (v === 1 || v === 2 || v === 3 || v === 4 || v === 5) return v
  return null
}

function QuickEditForm({
  kind,
  todayDate,
  yesterdayDate,
  initialDate,
  todayValue,
  yesterdayValue,
  onClose,
}: {
  kind: MetricKind
  todayDate: LocalDate
  yesterdayDate: LocalDate
  initialDate: LocalDate
  todayValue: number | null
  yesterdayValue: number | null
  onClose: () => void
}) {
  const [targetDate, setTargetDate] = useState<LocalDate>(
    initialDate === yesterdayDate ? yesterdayDate : todayDate,
  )
  const existingForDate = targetDate === yesterdayDate ? yesterdayValue : todayValue

  const [kg, setKg] = useState<number | null>(() =>
    kind === 'weight' && existingForDate !== null ? gramsToKg(existingForDate) : null,
  )
  const [confirmFrom, setConfirmFrom] = useState<number | null>(null)
  const [mood, setMood] = useState<RatingValue | null>(() =>
    kind === 'mood' ? toRatingValue(existingForDate) : null,
  )
  const [steps, setSteps] = useState<number | null>(() =>
    kind === 'steps' ? existingForDate : null,
  )
  const [error, setError] = useState<string>()

  const putWeight = usePutWeight()
  const putRating = usePutRating()
  const putSteps = usePutSteps()
  const pending = putWeight.isPending || putRating.isPending || putSteps.isPending

  function handleDateSwitch(next: LocalDate) {
    setTargetDate(next)
    setConfirmFrom(null)
    setError(undefined)
    const val = next === yesterdayDate ? yesterdayValue : todayValue
    if (kind === 'weight') setKg(val !== null ? gramsToKg(val) : null)
    else if (kind === 'mood') setMood(toRatingValue(val))
    else setSteps(val)
  }

  function submitWeight(confirmLargeChange: boolean) {
    if (kg === null) return setError('先填一下体重')
    const grams = kgToGrams(kg)
    if (grams < WEIGHT_MIN_GRAMS || grams > WEIGHT_MAX_GRAMS) {
      return setError('体重应在 20–300 千克之间')
    }
    setError(undefined)
    putWeight.mutate(
      { weightGrams: grams, confirmLargeChange, localDate: targetDate },
      {
        onSuccess: () => {
          toast.success(`${targetDate === yesterdayDate ? '昨日' : '今日'}体重已保存`)
          onClose()
        },
        onError: (e) => {
          if (isApiError(e) && e.code === 'WEIGHT_CHANGE_UNCONFIRMED') {
            setConfirmFrom(e.body.previousWeightGrams ?? null)
            return
          }
          if (isApiError(e) && e.fields?.weightGrams) return setError(e.fields.weightGrams[0])
          toast.error(isApiError(e) ? errorMessage(e) : '保存失败，请稍后重试')
        },
      },
    )
  }

  function submitMood() {
    if (mood === null || mood < 1 || mood > 5) return setError('请先选一个心情评分')
    setError(undefined)
    putRating.mutate(
      { scope: 'overall', value: mood, localDate: targetDate },
      {
        onSuccess: () => {
          toast.success(`${targetDate === yesterdayDate ? '昨日' : '今日'}心情已保存`)
          onClose()
        },
        onError: (e) => {
          toast.error(isApiError(e) ? errorMessage(e) : '保存失败，请稍后重试')
        },
      },
    )
  }

  function submitSteps() {
    if (steps === null || Number.isNaN(steps)) return setError('请先填写步数')
    const normalized = Math.round(steps)
    if (normalized < STEPS_MIN || normalized > STEPS_MAX) {
      return setError('步数应在 0–200,000 步之间')
    }
    setError(undefined)
    putSteps.mutate(
      { steps: normalized, localDate: targetDate },
      {
        onSuccess: () => {
          toast.success(`${targetDate === yesterdayDate ? '昨日' : '今日'}步数已保存`)
          onClose()
        },
        onError: (e) => {
          if (isApiError(e) && e.fields?.steps) return setError(e.fields.steps[0])
          toast.error(isApiError(e) ? errorMessage(e) : '保存失败，请稍后重试')
        },
      },
    )
  }

  if (kind === 'weight' && confirmFrom !== null && kg !== null) {
    const diff = Math.abs(kgToGrams(kg) - confirmFrom) / 1000
    return (
      <div role="alertdialog" aria-label="确认体重" className="flex flex-col gap-4 py-2">
        <p className="text-body">
          和之前（{gramsToKg(confirmFrom).toFixed(1)} kg）差了{' '}
          <span className="font-display font-semibold tabular-nums">{diff.toFixed(1)} kg</span>
          ，确认没输错吗？
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setConfirmFrom(null)}>
            我改一下
          </Button>
          <Button loading={putWeight.isPending} onClick={() => submitWeight(true)}>
            没错，记下来
          </Button>
        </div>
      </div>
    )
  }

  const dayLabel = targetDate === yesterdayDate ? '昨天' : '今天'

  return (
    <div className="flex flex-col gap-4 py-1">
      <SegmentedControl
        label="选择记录日期"
        size="sm"
        value={targetDate}
        onValueChange={handleDateSwitch}
        options={[
          { value: todayDate, label: `今天 · ${formatLocalDateLabel(todayDate)}` },
          { value: yesterdayDate, label: `昨天 · ${formatLocalDateLabel(yesterdayDate)}` },
        ]}
      />

      {kind === 'weight' && (
        <Field
          label={`${dayLabel}的体重`}
          htmlFor="metric-edit-weight"
          error={error}
          hint={
            existingForDate !== null
              ? `当前已记 ${gramsToKg(existingForDate).toFixed(1)} kg，保存后将覆盖`
              : '体重仅自己可见'
          }
        >
          <NumberField
            id="metric-edit-weight"
            value={kg}
            onValueChange={(v) => {
              setKg(v)
              setError(undefined)
            }}
            min={20}
            max={300}
            step={0.1}
            unit="kg"
            format={{ maximumFractionDigits: 1 }}
            placeholder="60.0"
          />
        </Field>
      )}

      {kind === 'mood' && (
        <div className="flex flex-col items-center gap-2 py-2">
          <Rating
            label={`${dayLabel}心情`}
            value={mood}
            onValueChange={(v) => {
              setMood(v)
              setError(undefined)
            }}
            tone="primary"
            className="w-full justify-between"
          />
          <p className="text-caption text-muted">
            {mood ? `${mood} 分 · ${MOOD_LABELS[mood - 1]}` : `点选${dayLabel}的心情`}
          </p>
          {error && <p className="text-tiny text-danger-ink">{error}</p>}
        </div>
      )}

      {kind === 'steps' && (
        <Field
          label={`${dayLabel}的步数`}
          htmlFor="metric-edit-steps"
          error={error}
          hint={
            existingForDate !== null
              ? `当前已记 ${existingForDate.toLocaleString('en-US')} 步，保存后将覆盖`
              : '支持手动输入手机、手表或手环记录的步数'
          }
        >
          <NumberField
            id="metric-edit-steps"
            value={steps}
            onValueChange={(v) => {
              setSteps(v)
              setError(undefined)
            }}
            min={STEPS_MIN}
            max={STEPS_MAX}
            step={500}
            unit="步"
            format={{ maximumFractionDigits: 0 }}
            placeholder="8000"
          />
        </Field>
      )}

      <Button
        icon="check"
        className="w-full"
        loading={pending}
        onClick={() => {
          if (kind === 'weight') submitWeight(false)
          else if (kind === 'mood') submitMood()
          else submitSteps()
        }}
      >
        {existingForDate !== null ? `更新${dayLabel}记录` : `记下${dayLabel}数据`}
      </Button>
    </div>
  )
}
