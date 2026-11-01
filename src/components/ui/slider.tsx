'use client'

import { Slider as BaseSlider } from '@base-ui/react/slider'
import { cn } from '@/lib/cn'
import { solidToneClass, type Tone } from './tone'

/*
 * 滑块（Base UI Slider）：大概值，拖动比输入更顺手，例如"今天有多累""运动强度"。
 * 需要精确数值（体重、时长）用 NumberField。
 * 拖动时实时回调 onValueChange，松手回调 onValueCommitted（适合提交接口）。
 * 方向键 ±step，PageUp / PageDown ±largeStep，Home / End 到两端。
 *
 *   <Slider label="饱腹感" min={1} max={5} value={v} onValueChange={setV} tone="diet"
 *     formatValue={(n) => ['很饿', '有点饿', '刚好', '饱', '撑'][n - 1]} />
 */

interface SliderProps {
  value: number
  onValueChange: (value: number) => void
  onValueCommitted?: (value: number) => void
  min?: number
  max?: number
  step?: number
  largeStep?: number
  /** 可见标签；不传时必须传 ariaLabel */
  label?: string
  ariaLabel?: string
  /** 右上角显示的数值文字，同时作为读屏的 aria-valuetext */
  formatValue?: (value: number) => string
  /** 填充色，默认主色；板块相关的滑块用板块色 */
  tone?: Tone
  name?: string
  disabled?: boolean
  className?: string
}

export function Slider({
  value,
  onValueChange,
  onValueCommitted,
  min = 0,
  max = 100,
  step = 1,
  largeStep,
  label,
  ariaLabel,
  formatValue,
  tone = 'primary',
  name,
  disabled,
  className,
}: SliderProps) {
  return (
    <BaseSlider.Root
      value={value}
      onValueChange={(v) => onValueChange(v)}
      onValueCommitted={onValueCommitted ? (v) => onValueCommitted(v) : undefined}
      min={min}
      max={max}
      step={step}
      largeStep={largeStep}
      name={name}
      disabled={disabled}
      className={cn('flex flex-col gap-1 data-disabled:opacity-50', className)}
    >
      {(label || formatValue) && (
        <div className="flex items-baseline justify-between gap-2">
          {label && (
            <BaseSlider.Label className="text-caption font-semibold">{label}</BaseSlider.Label>
          )}
          <BaseSlider.Value className="text-caption text-muted ml-auto font-semibold tabular-nums">
            {(formatted, values) => (formatValue ? formatValue(values[0] ?? value) : formatted[0])}
          </BaseSlider.Value>
        </div>
      )}
      {/* 控制区高 44px 保证触控面积，视觉轨道 8px */}
      <BaseSlider.Control className="flex h-11 w-full touch-none items-center select-none">
        <BaseSlider.Track className="bg-surface-sunken relative h-2 w-full rounded-full">
          <BaseSlider.Indicator className={cn('rounded-full', solidToneClass[tone])} />
          <BaseSlider.Thumb
            aria-label={label ? undefined : ariaLabel}
            getAriaValueText={formatValue ? (_f, v) => formatValue(v) : undefined}
            className={
              'bg-surface shadow-card border-border-strong size-7 rounded-full border-2 outline-none ' +
              'ease-spring transition-transform duration-(--dur-fast) data-dragging:scale-110 ' +
              'has-[:focus-visible]:ring-primary/40 has-[:focus-visible]:ring-4'
            }
          />
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  )
}
