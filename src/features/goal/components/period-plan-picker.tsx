'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { Collapse } from '@/components/ui/collapse'
import { Icon } from '@/components/ui/icon'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { TimePicker } from '@/components/ui/time-picker'

const Calendar = dynamic(() => import('@/components/ui/calendar').then((m) => m.Calendar), {
  loading: () => <Skeleton className="h-64 w-full rounded-2xl" />,
})
import type { RemindMode } from '@/features/me/schemas'
import type { LocalDate } from '@/features/shared/schemas'
import { cn } from '@/lib/cn'
import { daysBetween } from '@/lib/time'
import { daysFromDeadline, deadlineFromDays } from '../period'

/*
 * 统一的总打卡周期与每日提醒选择器（新人引导与「目标设置 → 周期与提醒」底部 Sheet 共用）：
 * - 明确「总打卡周期 = 目标坚持天数」（同一概念合一，避免重复迷惑）；
 * - 取消 7/14/21/30 选项栏，改为可左右平滑滚动的连续天数滚轮 + 拖动滑块与 ± 微调；
 * - 截止日期复用共享手账 <Calendar />，提醒时间复用打卡同款 <TimePicker />，彻底消除移动端换行溢出。
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

const WHEEL_MAX_DAYS = 365
const WHEEL_ITEM_W = 56
const WHEEL_DAYS = Array.from({ length: WHEEL_MAX_DAYS }, (_, i) => i + 1)
const REMIND_TIME_PRESETS = ['08:00', '12:00', '20:00', '21:00'] as const

/** 连续横向滚动的天数滚轮（1–365 天），替代固定 7/14/21 选项栏 */
function CycleDaysWheel({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(false)
  const programmaticRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clamped = Math.min(WHEEL_MAX_DAYS, Math.max(1, value))

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const targetLeft = (clamped - 1) * WHEEL_ITEM_W
    if (!mountedRef.current) {
      el.scrollLeft = targetLeft
      mountedRef.current = true
      return
    }
    if (Math.abs(el.scrollLeft - targetLeft) > 2) {
      programmaticRef.current = true
      el.scrollTo({ left: targetLeft, behavior: 'smooth' })
      const t = setTimeout(() => {
        programmaticRef.current = false
      }, 260)
      return () => clearTimeout(t)
    }
  }, [clamped])

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  function handleScroll() {
    if (programmaticRef.current) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const el = scrollerRef.current
      if (!el) return
      const nextDay = Math.min(
        WHEEL_MAX_DAYS,
        Math.max(1, Math.round(el.scrollLeft / WHEEL_ITEM_W) + 1),
      )
      if (nextDay !== clamped) onChange(nextDay)
    }, 90)
  }

  return (
    <div className="bg-surface-sunken/80 relative overflow-hidden rounded-xl py-1">
      <div
        ref={scrollerRef}
        role="listbox"
        aria-label="滚动选择坚持天数"
        data-base-ui-swipe-ignore="x"
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory [scrollbar-width:none] items-center overflow-x-auto overscroll-x-contain [mask-image:linear-gradient(to_right,transparent,black_18%,black_82%,transparent)] px-[calc(50%-1.75rem)] [&::-webkit-scrollbar]:hidden"
      >
        {WHEEL_DAYS.map((day) => {
          const active = day === clamped
          return (
            <button
              key={day}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onChange(day)}
              className={cn(
                'flex h-9 w-14 shrink-0 snap-center flex-col items-center justify-center rounded-lg font-semibold tabular-nums transition-colors duration-(--dur-fast)',
                active
                  ? 'bg-primary-soft text-primary-ink text-caption'
                  : 'text-muted hover:text-foreground text-tiny',
              )}
            >
              <span>{day}</span>
              <span
                aria-hidden="true"
                className={cn(
                  'mt-0.5 rounded-full',
                  active
                    ? 'bg-primary h-1 w-3'
                    : day % 5 === 0
                      ? 'bg-border-strong h-1.5 w-0.5'
                      : 'bg-border h-1 w-0.5',
                )}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function PeriodPlanPicker({
  startDate,
  today,
  deadlineDate,
  onDeadlineChange,
  remindAt,
  onRemindAtChange,
  remindMode,
  onRemindModeChange,
}: PeriodPlanPickerProps) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [timePickerOpen, setTimePickerOpen] = useState(false)

  const hasDeadline = Boolean(deadlineDate)
  const totalDays =
    deadlineDate && deadlineDate >= startDate ? daysFromDeadline(startDate, deadlineDate) : null
  const remainingDays = deadlineDate ? daysBetween(today, deadlineDate) : null
  const minDate = today >= startDate ? today : startDate

  const effectiveRemindMode: RemindMode = remindMode ?? (remindAt ? 'in-app' : 'off')
  const reminderEnabled = effectiveRemindMode !== 'off'
  const currentTime = remindAt || '21:00'

  function applyDays(days: number) {
    const clamped = Math.min(3650, Math.max(1, Math.round(days)))
    const base =
      today > startDate && deadlineFromDays(startDate, clamped) < today ? today : startDate
    onDeadlineChange(deadlineFromDays(base, clamped))
  }

  function handleModeChange(next: RemindMode) {
    onRemindModeChange?.(next)
    if (next === 'off') {
      setTimePickerOpen(false)
    } else if (!remindAt) {
      onRemindAtChange('21:00')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ① 总打卡周期（即目标坚持天数，与截止日期双向同步） */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-caption font-bold">总打卡周期</span>
            <span className="text-tiny text-subtle">即目标坚持天数</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (hasDeadline) {
                onDeadlineChange('')
                setCalendarOpen(false)
              } else {
                applyDays(30)
              }
            }}
            className={cn(
              'ease-spring text-tiny inline-flex h-7.5 shrink-0 items-center rounded-full border px-2.5 font-semibold transition-colors duration-(--dur-fast) active:scale-95',
              !hasDeadline
                ? 'border-primary/45 bg-primary-soft text-primary-ink'
                : 'border-border bg-surface text-muted hover:text-foreground',
            )}
          >
            {hasDeadline ? '改为不设期限' : '当前不设期限'}
          </button>
        </div>

        {/* 直接铺展在 Sheet 表面：横向滚动天数滚轮 + 滑块 + 截止日，不再套外层边框卡片 */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-heading text-foreground font-bold tabular-nums">
                {totalDays !== null ? `${totalDays} 天` : '按阶段里程碑'}
              </span>
              {hasDeadline && remainingDays !== null && (
                <span className="text-tiny text-muted">
                  {remainingDays >= 0 ? `还剩 ${remainingDays} 天` : '已到期'}
                </span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label="减少 1 天"
                disabled={totalDays !== null && totalDays <= 1}
                onClick={() => applyDays((totalDays ?? 30) - 1)}
                className="border-border bg-surface text-foreground hover:bg-surface-sunken inline-flex size-8 items-center justify-center rounded-full border text-base font-bold disabled:opacity-40"
              >
                −
              </button>
              <button
                type="button"
                aria-label="增加 1 天"
                onClick={() => applyDays((totalDays ?? 29) + 1)}
                className="border-border bg-surface text-foreground hover:bg-surface-sunken inline-flex size-8 items-center justify-center rounded-full border text-base font-bold"
              >
                +
              </button>
            </div>
          </div>

          {/* 连续横向滚动天数滚轮（1–365 天，无固定选项栏） */}
          <CycleDaysWheel value={totalDays ?? 30} onChange={applyDays} />

          {/* 顺滑拖动条（快速跨度调节 1–365 天，与滚轮及截止日期双向同步） */}
          <Slider
            ariaLabel="总打卡周期天数"
            min={1}
            max={365}
            step={1}
            value={Math.min(365, totalDays ?? 30)}
            onValueChange={(v) => applyDays(v)}
            tone="primary"
          />

          {/* 截止日期：复用共享手账 <Calendar />，平铺展开无嵌套边框 */}
          <div className="border-border/60 border-t pt-2">
            <button
              type="button"
              aria-expanded={calendarOpen}
              onClick={() => setCalendarOpen((o) => !o)}
              className="flex min-h-9 w-full items-center justify-between gap-2 text-left"
            >
              <span className="text-caption text-foreground flex items-center gap-1.5 font-semibold">
                <Icon name="calendar" size={15} className="text-primary-ink shrink-0" lineOnly />
                <span>截止日期</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-caption text-primary-ink font-semibold tabular-nums">
                  {hasDeadline ? deadlineDate : '未设定'}
                </span>
                <Icon
                  name="chevron-down"
                  size={15}
                  className={cn(
                    'text-subtle transition-transform duration-(--dur-base)',
                    calendarOpen && 'rotate-180',
                  )}
                />
              </span>
            </button>

            <Collapse open={calendarOpen} unmountOnCollapse>
              <div className="pt-2">
                <Calendar
                  label="选择总截止日期"
                  today={today}
                  defaultMonth={(deadlineDate || today).slice(0, 7)}
                  minDate={minDate}
                  maxMonth="2099-12"
                  selected={deadlineDate || null}
                  marks={
                    deadlineDate
                      ? [{ date: deadlineDate, tone: 'primary', variant: 'done', label: '截止日' }]
                      : []
                  }
                  onDayClick={(d) => {
                    onDeadlineChange(d)
                    setCalendarOpen(false)
                  }}
                />
              </div>
            </Collapse>
          </div>
        </div>
      </div>

      {/* ② 每日提醒：保持清晰的提醒方式分段，平铺复用打卡同款 TimePicker */}
      <div className="border-border/70 flex flex-col gap-2.5 border-t pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-caption font-bold">每日提醒</span>
          <span className="text-tiny text-muted tabular-nums">
            {reminderEnabled && remindAt ? `每天 ${remindAt}` : '已关闭'}
          </span>
        </div>

        {remindMode !== undefined && onRemindModeChange && (
          <SegmentedControl
            label="提醒方式"
            size="sm"
            options={REMIND_MODE_OPTIONS}
            value={remindMode}
            onValueChange={handleModeChange}
          />
        )}

        {reminderEnabled && (
          <div className="flex flex-col gap-2 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-expanded={timePickerOpen}
                onClick={() => setTimePickerOpen((o) => !o)}
                className="flex min-h-9 min-w-0 flex-1 items-center gap-2 text-left"
              >
                <Icon name="clock" size={15} className="text-primary-ink shrink-0" lineOnly />
                <span className="text-caption font-semibold">提醒时刻</span>
                <span className="font-display text-caption text-primary-ink ml-auto font-bold tabular-nums">
                  {currentTime}
                </span>
                <Icon
                  name="chevron-down"
                  size={15}
                  className={cn(
                    'text-subtle shrink-0 transition-transform duration-(--dur-base)',
                    timePickerOpen && 'rotate-180',
                  )}
                />
              </button>
              {remindAt && !onRemindModeChange && (
                <button
                  type="button"
                  onClick={() => {
                    onRemindAtChange('')
                    setTimePickerOpen(false)
                  }}
                  className="text-tiny text-muted hover:text-foreground shrink-0 rounded-full px-2 py-0.5 font-semibold"
                >
                  清空
                </button>
              )}
            </div>

            <Collapse open={timePickerOpen} unmountOnCollapse>
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center justify-end gap-1">
                  {REMIND_TIME_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onRemindAtChange(preset)}
                      className={cn(
                        'text-tiny rounded-full px-2 py-0.5 font-semibold tabular-nums transition-colors',
                        currentTime === preset
                          ? 'bg-primary text-on-primary'
                          : 'border-border bg-surface text-muted hover:text-foreground border',
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <TimePicker
                  label="每日提醒时间"
                  value={currentTime}
                  onChange={onRemindAtChange}
                  tone="primary"
                />
              </div>
            </Collapse>
          </div>
        )}
      </div>
    </div>
  )
}
