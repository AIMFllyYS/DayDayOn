'use client'

import { useState } from 'react'
import { TrendLineChart } from '@/components/charts/trend-line-chart'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { Field } from '@/components/ui/field'
import { NumberField } from '@/components/ui/number-field'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { WEIGHT_MAX_GRAMS, WEIGHT_MIN_GRAMS } from '@/features/metric/schemas'
import type { LocalDate } from '@/features/shared/schemas'
import { errorMessage, isApiError, useQuery } from '@/lib/api'
import { usePutWeight, weightTrendQuery } from '@/lib/api/queries/metrics'
import { gramsToKg, kgToGrams } from '../format'

/*
 * 记体重（PRD 2.5，Issue #104）：
 * - 上方按需懒加载展示近一年体重变化折线图（TrendLineChart），保存后留在当前面板实时落点；
 * - 下方千克一位小数输入，存克；与上一条差超过 3 kg 时服务端 409，在面板内完成二次确认。
 */

export function WeightPanel({
  open,
  localDate,
  currentGrams,
}: {
  open: boolean
  localDate: LocalDate
  currentGrams: number | null
}) {
  const [kg, setKg] = useState<number | null>(
    currentGrams === null ? null : gramsToKg(currentGrams),
  )
  const [confirmFrom, setConfirmFrom] = useState<number | null>(null)
  const [error, setError] = useState<string>()
  const put = usePutWeight()
  const trend = useQuery({ ...weightTrendQuery(365), enabled: open })

  function submit(confirmLargeChange: boolean) {
    if (kg === null) return setError('先填一下体重')
    const grams = kgToGrams(kg)
    if (grams < WEIGHT_MIN_GRAMS || grams > WEIGHT_MAX_GRAMS)
      return setError('体重应在 20–300 千克之间')
    setError(undefined)
    put.mutate(
      { weightGrams: grams, confirmLargeChange },
      {
        onSuccess: () => {
          setConfirmFrom(null)
          toast.success('体重记好了')
        },
        onError: (e) => {
          if (isApiError(e) && e.code === 'WEIGHT_CHANGE_UNCONFIRMED') {
            setConfirmFrom(e.body.previousWeightGrams ?? null)
            return
          }
          if (isApiError(e) && e.fields?.weightGrams) return setError(e.fields.weightGrams[0])
          toast.error(isApiError(e) ? errorMessage(e) : '出了点小状况，稍后再试试')
        },
      },
    )
  }

  if (confirmFrom !== null && kg !== null) {
    const diff = Math.abs(kgToGrams(kg) - confirmFrom) / 1000
    return (
      <div role="alertdialog" aria-label="确认体重" className="flex flex-col gap-4 py-2">
        <p className="text-body">
          和上次（{gramsToKg(confirmFrom).toFixed(1)} kg）差了{' '}
          <span className="font-display font-semibold tabular-nums">{diff.toFixed(1)} kg</span>
          ，确认没输错吗？
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setConfirmFrom(null)}>
            我改一下
          </Button>
          <Button loading={put.isPending} onClick={() => submit(true)}>
            没错，记下来
          </Button>
        </div>
      </div>
    )
  }

  const points = (trend.data?.entries ?? []).map((e) => ({
    date: e.localDate,
    value: gramsToKg(e.weightGrams),
  }))

  return (
    <div className="flex flex-col gap-3.5 py-1">
      {trend.isPending ? (
        <Skeleton className="h-[188px] w-full rounded-2xl" />
      ) : trend.isError ? (
        <ErrorState
          size="compact"
          title="近一年体重走势没加载出来"
          message={isApiError(trend.error) ? errorMessage(trend.error) : undefined}
          onRetry={() => void trend.refetch()}
          retrying={trend.isRefetching}
        />
      ) : (
        <TrendLineChart
          chartId="weight"
          data={points}
          endDate={localDate}
          days={365}
          label="近一年体重变化"
          unit="kg"
          decimals={1}
          tone="primary"
          emptyText="近一年还没有体重记录，记下今天的第一条吧"
        />
      )}

      <Field label="今天的体重" htmlFor="checkin-weight" error={error} hint="体重只有你自己看得到">
        <NumberField
          id="checkin-weight"
          value={kg}
          onValueChange={setKg}
          min={20}
          max={300}
          step={0.1}
          unit="kg"
          format={{ maximumFractionDigits: 1 }}
          placeholder="60.0"
        />
      </Field>
      <Button icon="check" className="w-full" loading={put.isPending} onClick={() => submit(false)}>
        记下来
      </Button>
    </div>
  )
}
