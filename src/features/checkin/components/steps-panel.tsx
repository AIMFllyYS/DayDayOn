'use client'

import { useState } from 'react'
import { TrendLineChart } from '@/components/charts/trend-line-chart'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { Field } from '@/components/ui/field'
import { NumberField } from '@/components/ui/number-field'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { DEFAULT_DAILY_STEP_TARGET, STEPS_MAX, STEPS_MIN } from '@/features/metric/schemas'
import type { LocalDate } from '@/features/shared/schemas'
import { errorMessage, isApiError, useQuery } from '@/lib/api'
import { useMe } from '@/lib/api/queries/me'
import { stepTrendQuery, usePutSteps } from '@/lib/api/queries/metrics'
import { getNativeTodaySteps, isNativeApp, requestNativePermission } from '@/lib/native'

/*
 * 记录今日步数面板（对齐 WeightPanel / MoodPanel）：
 * - 上方按需懒加载近一年步数变化折线图（TrendLineChart），叠加个人步数参考虚线，保存/同步后原地实时落点；
 * - 中部保留手动步数输入（不再展示快捷填入区）；
 * - 下方主按钮「记下来」，原生客户端下紧接「一键同步手机计步器」。
 */

function formatStepsAxis(v: number): string {
  const rounded = Math.round(v)
  if (rounded >= 10_000) return `${(rounded / 10_000).toFixed(1).replace(/\.0$/, '')}万`
  return rounded.toLocaleString('en-US')
}

export function StepsPanel({
  open,
  localDate,
  currentSteps = null,
}: {
  open: boolean
  localDate: LocalDate
  currentSteps?: number | null
}) {
  const trend = useQuery({ ...stepTrendQuery(365), enabled: open })
  const { data: me } = useMe()
  const stepTarget = me ? me.preferences.dailyStepTarget : DEFAULT_DAILY_STEP_TARGET

  const savedSteps =
    trend.data !== undefined
      ? (trend.data.entries.find((e) => e.localDate === localDate)?.steps ?? null)
      : currentSteps
  const [draftSteps, setDraftSteps] = useState<number | null | undefined>(undefined)
  const steps =
    draftSteps !== undefined
      ? draftSteps
      : savedSteps !== null && savedSteps > 0
        ? savedSteps
        : null
  const [syncingSensor, setSyncingSensor] = useState(false)
  const [error, setError] = useState<string>()
  const put = usePutSteps()
  const native = typeof window !== 'undefined' && isNativeApp()

  async function handleReadFromSensor() {
    setSyncingSensor(true)
    setError(undefined)
    try {
      const perm = await requestNativePermission('steps')
      if (perm !== 'granted') {
        toast.error('请先开启步数权限', {
          description: '也可在上方手动输入今日步数',
        })
        return
      }
      const sensorSteps = await getNativeTodaySteps()
      if (sensorSteps <= 0) {
        if (savedSteps && savedSteps > 0) {
          setDraftSteps(savedSteps)
          toast.info('暂无新增步数', {
            description: `已保留 ${savedSteps.toLocaleString('en-US')} 步`,
          })
        } else {
          setDraftSteps(0)
          toast.info('当前步数为 0', {
            description: '走动后再试或手动输入',
          })
        }
        return
      }
      setDraftSteps(sensorSteps)
      put.mutate(
        { steps: sensorSteps },
        {
          onSuccess: () => {
            toast.success(`已同步 ${sensorSteps.toLocaleString('en-US')} 步`)
          },
          onError: (e) => {
            toast.error(isApiError(e) ? errorMessage(e) : '同步步数失败，请稍后重试')
          },
        },
      )
    } finally {
      setSyncingSensor(false)
    }
  }

  function handleSubmit() {
    if (steps === null || Number.isNaN(steps)) {
      setError('请先填写或同步今日步数')
      return
    }
    const normalized = Math.round(steps)
    if (normalized < STEPS_MIN || normalized > STEPS_MAX) {
      setError('步数应在 0–200,000 步之间')
      return
    }
    setError(undefined)
    put.mutate(
      { steps: normalized },
      {
        onSuccess: () => {
          toast.success(`已记 ${normalized.toLocaleString('en-US')} 步`)
        },
        onError: (e) => {
          if (isApiError(e) && e.fields?.steps) {
            setError(e.fields.steps[0])
            return
          }
          toast.error(isApiError(e) ? errorMessage(e) : '保存步数失败，请稍后重试')
        },
      },
    )
  }

  const entries = trend.data?.entries ?? []
  const points = entries.map((e) => ({ date: e.localDate, value: e.steps }))
  const avgSteps =
    entries.length > 0
      ? Math.round(entries.reduce((sum, e) => sum + e.steps, 0) / entries.length)
      : null
  const maxSteps = entries.length > 0 ? Math.max(...entries.map((e) => e.steps)) : null
  const defaultSummary =
    entries.length === 0
      ? undefined
      : entries.length === 1
        ? `近一年 · ${entries[0]!.steps.toLocaleString('en-US')} 步`
        : `近一年 · 日均 ${avgSteps?.toLocaleString('en-US')} 步 · 最高 ${maxSteps?.toLocaleString('en-US')} 步`

  const yMax = Math.max(1000, ...entries.map((e) => e.steps), stepTarget ?? 0)

  return (
    <div className="flex flex-col gap-3.5 py-1">
      {trend.isPending ? (
        <Skeleton className="h-[188px] w-full rounded-2xl" />
      ) : trend.isError ? (
        <ErrorState
          size="compact"
          title="近一年步数走势没加载出来"
          message={isApiError(trend.error) ? errorMessage(trend.error) : undefined}
          onRetry={() => void trend.refetch()}
          retrying={trend.isRefetching}
        />
      ) : (
        <TrendLineChart
          chartId="steps"
          data={points}
          endDate={localDate}
          days={365}
          label="近一年步数变化"
          tone="exercise"
          unit="步"
          yDomain={[0, Math.ceil(yMax * 1.15)]}
          formatValue={formatStepsAxis}
          formatPointValue={(v) => `${Math.round(v).toLocaleString('en-US')} 步`}
          referenceLine={
            stepTarget !== null
              ? { value: stepTarget, label: `参考 ${stepTarget.toLocaleString('en-US')}` }
              : null
          }
          defaultSummary={defaultSummary}
          emptyText="近一年还没有步数记录，记下今天的第一条吧"
        />
      )}

      <Field
        label="今天的步数"
        htmlFor="checkin-steps"
        error={error}
        hint={
          savedSteps !== null && savedSteps > 0
            ? `当前已记录 ${savedSteps.toLocaleString('en-US')} 步，重新提交将覆盖今日记录`
            : '支持输入手机、手表或手环记录的今日步数'
        }
      >
        <NumberField
          id="checkin-steps"
          value={steps}
          onValueChange={(v) => {
            setDraftSteps(v)
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

      <div className="flex flex-col gap-2">
        <Button
          icon="check"
          className="w-full"
          loading={put.isPending && !syncingSensor}
          disabled={syncingSensor}
          onClick={handleSubmit}
        >
          记下来
        </Button>

        {native && (
          <Button
            variant="soft"
            icon="footprints"
            className="w-full"
            loading={syncingSensor}
            disabled={put.isPending}
            onClick={() => void handleReadFromSensor()}
          >
            {syncingSensor ? '正在读取手机计步器…' : '一键同步手机计步器'}
          </Button>
        )}
      </div>
    </div>
  )
}
