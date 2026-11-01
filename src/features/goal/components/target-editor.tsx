'use client'

import { NumberField } from '@/components/ui/number-field'
import { SegmentedControl } from '@/components/ui/segmented-control'
import type { Module } from '@/features/shared/schemas'
import { minutesToSeconds, secondsToMinutes } from '../format'
import { TARGET_KINDS_BY_MODULE, type TargetKind } from '../schemas'

/** 编辑中的目标量：value 可以暂时为空（NumberField 清空时） */
export interface TargetDraft {
  kind: TargetKind
  value: number | null
}

interface TargetEditorProps {
  module: Module
  value: TargetDraft
  onValueChange: (value: TargetDraft) => void
  /** 数字输入框的 id（Field 的 htmlFor 指向它） */
  id: string
}

const KIND_OPTIONS = [
  { value: 'duration', label: '按时长' },
  { value: 'count', label: '按次数' },
] as const

// 时长按分钟输入，接口存秒（api-conventions.md 第 5 节）；上限 24 小时，与 TargetSchema 一致
const MAX_MINUTES = 24 * 60
const MAX_COUNT = 100

/**
 * 每日目标量：先选按时长 / 按次数（睡眠只能按时长；饮食、自定义只能按次数），再填数值。
 * 时长界面单位是分钟，value 里存秒；切换类型时换成该类型的常用值。
 */
export function TargetEditor({ module, value, onValueChange, id }: TargetEditorProps) {
  // 当前值不在允许范围内（规则收紧前建的老目标）时也列出来，让用户能切走
  const options = KIND_OPTIONS.filter(
    (o) => TARGET_KINDS_BY_MODULE[module].includes(o.value) || o.value === value.kind,
  )
  const minutes = value.value === null ? null : secondsToMinutes(value.value)

  return (
    <div className="flex flex-col gap-2">
      {options.length > 1 && (
        <SegmentedControl
          label="目标量类型"
          options={options}
          value={value.kind}
          onValueChange={(kind) => {
            if (kind === value.kind) return
            onValueChange({ kind, value: kind === 'duration' ? 1800 : 1 })
          }}
        />
      )}
      {value.kind === 'duration' ? (
        <NumberField
          id={id}
          value={minutes}
          onValueChange={(m) =>
            onValueChange({ ...value, value: m === null ? null : minutesToSeconds(m) })
          }
          min={1}
          max={MAX_MINUTES}
          step={5}
          largeStep={30}
          unit="分钟"
          format={{ maximumFractionDigits: 0 }}
        />
      ) : (
        <NumberField
          id={id}
          value={value.value}
          onValueChange={(n) => onValueChange({ ...value, value: n })}
          min={1}
          max={MAX_COUNT}
          step={1}
          unit="次"
          format={{ maximumFractionDigits: 0 }}
        />
      )}
    </div>
  )
}
