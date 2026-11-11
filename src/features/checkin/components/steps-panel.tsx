'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'
import { NumberField } from '@/components/ui/number-field'
import { toast } from '@/components/ui/toast'
import { STEPS_MAX, STEPS_MIN } from '@/features/metric/schemas'
import { errorMessage, isApiError, useQuery } from '@/lib/api'
import { stepTrendQuery, usePutSteps } from '@/lib/api/queries/metrics'
import { getNativeTodaySteps, isNativeApp, requestNativePermission } from '@/lib/native'

const QUICK_STEP_PRESETS = [3000, 6000, 8000, 10000] as const

/**
 * 记录今日步数面板（Issue #80）：
 * - 在打卡弹层内切换展示（不叠加二级弹窗）；
 * - 安卓客户端支持一键读取并同步硬件计步器；
 * - 全端支持手动输入或快捷步数填入（兼容手表/手环/微信运动步数补录与网页端使用）。
 */
export function StepsPanel({ onSaved }: { onSaved: () => void }) {
  const trend = useQuery(stepTrendQuery(7))
  const savedSteps = trend.data?.todaySteps ?? null
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
        toast.error('需要开启「身体活动」权限才能读取手机计步器', {
          description: '也可在下方直接手动输入今日步数',
        })
        return
      }
      const sensorSteps = await getNativeTodaySteps()
      if (sensorSteps <= 0) {
        if (savedSteps && savedSteps > 0) {
          setDraftSteps(savedSteps)
          toast.info('手机计步器暂未产生新步数增量', {
            description: `已保留今日记录 ${savedSteps.toLocaleString('en-US')} 步，也可手动调整`,
          })
        } else {
          setDraftSteps(0)
          toast.info('当前手机计步器读数为 0 步', {
            description: '走动几步后可再次同步，或直接手动输入手表/手环步数',
          })
        }
        return
      }
      setDraftSteps(sensorSteps)
      put.mutate(
        { steps: sensorSteps },
        {
          onSuccess: () => {
            toast.success(`已同步手机步数：${sensorSteps.toLocaleString('en-US')} 步`)
            onSaved()
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
          toast.success(`今日步数已记录：${normalized.toLocaleString('en-US')} 步`)
          onSaved()
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

  return (
    <div className="flex flex-col gap-4 py-1">
      {native && (
        <button
          type="button"
          disabled={syncingSensor || put.isPending}
          onClick={() => void handleReadFromSensor()}
          className="border-primary/25 bg-primary-soft/65 hover:bg-primary-soft text-primary-ink flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors disabled:opacity-60"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="bg-primary text-on-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
              <Icon name="footprints" size={18} lineOnly />
            </span>
            <div className="min-w-0">
              <p className="text-caption font-bold">
                {syncingSensor ? '正在读取手机计步器…' : '一键同步手机计步器'}
              </p>
              <p className="text-tiny text-muted truncate">自动读取手机硬件传感器今日累计步数</p>
            </div>
          </div>
          <Icon name="chevron-right" size={16} className="shrink-0" />
        </button>
      )}

      <Field
        label="今天的步数"
        htmlFor="checkin-steps"
        error={error}
        hint={
          savedSteps && savedSteps > 0
            ? `当前已记录 ${savedSteps.toLocaleString('en-US')} 步，重新提交将覆盖今日记录`
            : '支持输入手机、手表或手环记录的今日步数'
        }
      >
        <NumberField
          id="checkin-steps"
          value={steps}
          onValueChange={setDraftSteps}
          min={STEPS_MIN}
          max={STEPS_MAX}
          step={500}
          unit="步"
          format={{ maximumFractionDigits: 0 }}
          placeholder="6000"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-tiny text-muted font-semibold">快捷填入：</span>
        {QUICK_STEP_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => {
              setDraftSteps(preset)
              setError(undefined)
            }}
            className="border-border bg-surface-sunken hover:bg-primary-soft hover:text-primary-ink text-tiny cursor-pointer rounded-full border px-3 py-1 font-mono font-semibold transition-colors"
          >
            {preset.toLocaleString('en-US')} 步
          </button>
        ))}
      </div>

      <Button icon="check" className="w-full" loading={put.isPending} onClick={handleSubmit}>
        记下来
      </Button>
    </div>
  )
}
