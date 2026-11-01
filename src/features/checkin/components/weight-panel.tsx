'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { NumberField } from '@/components/ui/number-field'
import { toast } from '@/components/ui/toast'
import { WEIGHT_MAX_GRAMS, WEIGHT_MIN_GRAMS } from '@/features/metric/schemas'
import { errorMessage, isApiError } from '@/lib/api'
import { usePutWeight } from '@/lib/api/queries/metrics'
import { gramsToKg, kgToGrams } from '../format'

/*
 * 记体重（PRD 2.5）：千克一位小数输入，存克。和上一条差超过 3 kg 时服务端 409，
 * 这里问"和上次差了 X kg，确认没输错吗？"，确认后带 confirmLargeChange 重提。
 * 在打卡弹层里切换显示，不再开第二层弹层（PRD 2.4），所以确认也写在面板里。
 */

export function WeightPanel({
  currentGrams,
  onSaved,
}: {
  currentGrams: number | null
  onSaved: () => void
}) {
  const [kg, setKg] = useState<number | null>(
    currentGrams === null ? null : gramsToKg(currentGrams),
  )
  const [confirmFrom, setConfirmFrom] = useState<number | null>(null)
  const [error, setError] = useState<string>()
  const put = usePutWeight()

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
          toast.success('体重记好了')
          onSaved()
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

  return (
    <div className="flex flex-col gap-4 py-1">
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
