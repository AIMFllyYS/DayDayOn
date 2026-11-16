'use client'

import { Button } from '@/components/ui/button'
import { DateField } from '@/components/ui/date-field'
import { Field } from '@/components/ui/field'
import { NumberField } from '@/components/ui/number-field'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { TimeField } from '@/components/ui/time-field'
import type { RemindMode } from '@/features/me/schemas'
import type { LocalDate } from '@/features/shared/schemas'
import { cn } from '@/lib/cn'
import { daysBetween } from '@/lib/time'
import { PERIOD_DAY_PRESETS, daysFromDeadline, deadlineFromDays } from '../period'

/*
 * 统一的总打卡周期与每日提醒选择器（新人引导与全局「目标设置」共用）。
 * - 快捷胶囊（7 / 14 / 21 / 30 / 60 / 100 天 / 不设期限）与「总坚持天数 ↔ 截止日期」双向联动。
 * - 每日总提醒时间（remindAt），可选设置或一键清空。
 */

interface PeriodPlanPickerProps {
  /** 周期起始打卡日（用于换算总坚持天数与截止日期） */
  startDate: LocalDate
  /** 今天的打卡日（日期选择下限与剩余天数基准） */
  today: LocalDate
  /** 当前截止日期 YYYY-MM-DD；'' 表示不设固定期限 */
  deadlineDate: string
  onDeadlineChange: (next: string) => void
  /** 每日总提醒时间 HH:mm；'' 表示不提醒 */
  remindAt: string
  onRemindAtChange: (next: string) => void
  /** 目标设置页额外传入：提醒方式切换（off / in-app / native） */
  remindMode?: RemindMode
  onRemindModeChange?: (mode: RemindMode) => void
  idPrefix?: string
}

const REMIND_MODE_OPTIONS: ReadonlyArray<{ value: RemindMode; label: string }> = [
  { value: 'in-app', label: '应用内' },
  { value: 'native', label: '手机通知' },
  { value: 'off', label: '关闭' },
]

export function PeriodPlanPicker({
  startDate,
  today,
  deadlineDate,
  onDeadlineChange,
  remindAt,
  onRemindAtChange,
  remindMode,
  onRemindModeChange,
  idPrefix = 'period-plan',
}: PeriodPlanPickerProps) {
  const hasDeadline = Boolean(deadlineDate)
  const totalDays =
    deadlineDate && deadlineDate >= startDate ? daysFromDeadline(startDate, deadlineDate) : null
  const remainingDays = deadlineDate ? daysBetween(today, deadlineDate) : null
  const minDate = today >= startDate ? today : startDate

  function selectDays(days: number | null) {
    if (days === null) {
      onDeadlineChange('')
      return
    }
    const base = today > startDate && deadlineFromDays(startDate, days) < today ? today : startDate
    onDeadlineChange(deadlineFromDays(base, days))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-caption font-bold">总打卡周期 / 坚持天数</span>
          <span className="text-tiny text-muted">主页与打卡页圆环按此展示</span>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="快捷周期">
          {PERIOD_DAY_PRESETS.map((days) => {
            const active = totalDays === days
            return (
              <button
                key={days}
                type="button"
                aria-pressed={active}
                onClick={() => selectDays(days)}
                className={cn(
                  'text-caption ease-spring min-h-9 rounded-full border px-3 py-1 font-semibold transition-colors duration-(--dur-fast)',
                  active
                    ? 'border-primary bg-primary text-on-primary shadow-soft'
                    : 'border-border bg-surface hover:bg-background text-foreground',
                )}
              >
                {days} 天
              </button>
            )
          })}
          <button
            type="button"
            aria-pressed={!hasDeadline}
            onClick={() => selectDays(null)}
            className={cn(
              'text-caption ease-spring min-h-9 rounded-full border px-3 py-1 font-semibold transition-colors duration-(--dur-fast)',
              !hasDeadline
                ? 'border-primary bg-primary-soft text-primary-ink'
                : 'border-border bg-surface hover:bg-background text-muted',
            )}
          >
            不设期限
          </button>
        </div>

        <div className="grid gap-3 pt-1 sm:grid-cols-2">
          <Field label="目标坚持天数" htmlFor={`${idPrefix}-days`} aside="1–3650 天">
            <NumberField
              id={`${idPrefix}-days`}
              value={totalDays}
              onValueChange={(v) => {
                if (v === null) {
                  onDeadlineChange('')
                  return
                }
                const clamped = Math.min(3650, Math.max(1, Math.round(v)))
                onDeadlineChange(deadlineFromDays(startDate, clamped))
              }}
              min={1}
              max={3650}
              step={1}
              largeStep={7}
              unit="天"
              format={{ maximumFractionDigits: 0 }}
            />
          </Field>
          <DateField
            id={`${idPrefix}-deadline`}
            label="截止日期（可选）"
            value={deadlineDate}
            min={minDate}
            onValueChange={onDeadlineChange}
          />
        </div>

        <p className="text-tiny text-muted">
          {hasDeadline && totalDays !== null
            ? `从 ${startDate} 至 ${deadlineDate}，共 ${totalDays} 天${
                remainingDays !== null
                  ? remainingDays >= 0
                    ? `（距离截止还有 ${remainingDays} 天）`
                    : '（已到截止日，可顺延天数）'
                  : ''
              }`
            : '当前不设截止日期，主页将按 7 / 14 / 21 / 30 天阶段里程碑展示进度'}
        </p>
      </div>

      <div className="border-border/70 flex flex-col gap-3 border-t pt-3">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <TimeField
              id={`${idPrefix}-remind`}
              label="每日总提醒时间（可选）"
              aside={remindAt ? '到点没打完提醒你' : '未开启'}
              value={remindAt}
              onValueChange={(v) => {
                onRemindAtChange(v)
                if (v && remindMode === 'off' && onRemindModeChange) {
                  onRemindModeChange('in-app')
                }
              }}
            />
          </div>
          {remindAt && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mb-1 shrink-0"
              onClick={() => {
                onRemindAtChange('')
                if (onRemindModeChange) onRemindModeChange('off')
              }}
            >
              清空
            </Button>
          )}
        </div>

        {remindMode !== undefined && onRemindModeChange && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-tiny text-muted font-semibold">提醒方式</span>
              <span className="text-tiny text-muted">
                {remindMode === 'native'
                  ? '需在「我的 → 打卡与提醒」开启手机通知权限'
                  : remindMode === 'in-app'
                    ? '打开主页时展示温柔提醒横幅'
                    : '已暂停每日提醒'}
              </span>
            </div>
            <SegmentedControl
              label="提醒方式"
              options={REMIND_MODE_OPTIONS}
              value={remindMode}
              onValueChange={onRemindModeChange}
            />
          </div>
        )}
      </div>
    </div>
  )
}
