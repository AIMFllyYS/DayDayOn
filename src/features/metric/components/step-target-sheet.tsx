'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { NumberField } from '@/components/ui/number-field'
import { Sheet } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import {
  DAILY_STEP_TARGET_MAX,
  DAILY_STEP_TARGET_MIN,
  DEFAULT_DAILY_STEP_TARGET,
} from '@/features/metric/schemas'
import { cn } from '@/lib/cn'

/*
 * 步数设置 Dock 弹层：
 * 复用通用 <Sheet> 容器，供「我的 → 打卡与目标 → 步数设置」与「/metrics/steps → 调整参考线」两处共用。
 * 持久化至 profiles.daily_step_target（默认 8,000 步；关闭开关保存 null 隐藏参考虚线）。
 */

const STEP_TARGET_PRESETS = [6000, 8000, 10000, 12000] as const

export interface StepTargetSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 当前参考虚线步数；null 表示已关闭显示 */
  currentTarget: number | null
  saving?: boolean
  onSave: (nextTarget: number | null) => void
}

export function StepTargetSheet({
  open,
  onOpenChange,
  currentTarget,
  saving = false,
  onSave,
}: StepTargetSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="步数设置"
      description="设置步数折线图与每日柱状图的参考虚线"
    >
      {open && (
        <StepTargetSheetBody
          key={`${String(open)}-${String(currentTarget)}`}
          currentTarget={currentTarget}
          saving={saving}
          onSave={onSave}
        />
      )}
    </Sheet>
  )
}

function StepTargetSheetBody({
  currentTarget,
  saving,
  onSave,
}: {
  currentTarget: number | null
  saving: boolean
  onSave: (nextTarget: number | null) => void
}) {
  const [enabled, setEnabled] = useState(currentTarget !== null)
  const [steps, setSteps] = useState<number | null>(currentTarget ?? DEFAULT_DAILY_STEP_TARGET)
  const [error, setError] = useState<string>()

  function handleSave() {
    if (!enabled) {
      setError(undefined)
      onSave(null)
      return
    }
    if (steps === null || Number.isNaN(steps)) {
      setError('请填写参考虚线步数')
      return
    }
    const normalized = Math.round(steps)
    if (normalized < DAILY_STEP_TARGET_MIN || normalized > DAILY_STEP_TARGET_MAX) {
      setError('参考步数应在 1,000–100,000 步之间')
      return
    }
    setError(undefined)
    onSave(normalized)
  }

  return (
    <div className="flex flex-col gap-3 py-0.5">
      <div className="border-border bg-surface-sunken/70 flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold">显示参考虚线</p>
          <p className="text-tiny text-muted">在步数折线图与柱状图中标注参考线</p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => {
            setEnabled(checked)
            setError(undefined)
          }}
          label="显示步数参考虚线"
        />
      </div>

      {enabled ? (
        <>
          <Field
            label="每日参考步数"
            htmlFor="step-target-input"
            error={error}
            hint="默认 8,000 步；仅作图表参考与达标天数统计，不影响打卡总分"
          >
            <NumberField
              id="step-target-input"
              value={steps}
              onValueChange={(v) => {
                setSteps(v)
                setError(undefined)
              }}
              min={DAILY_STEP_TARGET_MIN}
              max={DAILY_STEP_TARGET_MAX}
              step={500}
              unit="步"
              format={{ maximumFractionDigits: 0 }}
              placeholder="8000"
            />
          </Field>

          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="常用参考步数">
            {STEP_TARGET_PRESETS.map((preset) => {
              const active = steps === preset
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setSteps(preset)
                    setError(undefined)
                  }}
                  className={cn(
                    'text-tiny font-display cursor-pointer rounded-full border py-1.5 text-center font-semibold tabular-nums transition-colors',
                    active
                      ? 'border-primary bg-primary text-on-primary'
                      : 'border-border bg-surface-sunken text-muted hover:bg-primary-soft hover:text-primary-ink',
                  )}
                >
                  {preset.toLocaleString('en-US')} 步
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <p className="border-border bg-surface-sunken/60 text-caption text-muted rounded-2xl border px-3.5 py-3">
          关闭后，步数走势折线图与每日柱状图将不再显示参考虚线，随时可以重新打开。
        </p>
      )}

      <Button icon="check" className="w-full" loading={saving} onClick={handleSave}>
        保存设置
      </Button>
    </div>
  )
}
