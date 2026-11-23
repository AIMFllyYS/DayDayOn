'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Collapse } from '@/components/ui/collapse'
import { Icon } from '@/components/ui/icon'
import { Skeleton } from '@/components/ui/skeleton'
import { TimePicker } from '@/components/ui/time-picker'

const Calendar = dynamic(() => import('@/components/ui/calendar').then((m) => m.Calendar), {
  loading: () => <Skeleton className="h-64 w-full rounded-2xl" />,
})
import { cn } from '@/lib/cn'
import { addDays, calendarDateOf, combineLocalDateTime } from '@/lib/time'
import { formatDue } from '../rules'

/*
 * 待办 DDL 选择器（复用打卡 TimePicker 双列滚轮与共享 Calendar）：
 * - 默认收起为单行快捷胶囊（不设 / 今天 / 明天 / 自选时间），不占过多垂直空间；
 * - 选中日期后展开打卡同款时分滚轮（TimePicker）与常用时刻快捷点选，点击「换日期」可展开手账日历任选未来日期。
 */

interface TodoDdlPickerProps {
  /** YYYY-MM-DDTHH:mm；空字符串表示不设 DDL */
  value: string
  onValueChange: (next: string) => void
  now: Date
  timeZone: string
  disabled?: boolean
  error?: string
}

const TIME_PRESETS = ['09:00', '12:00', '18:00', '23:59'] as const

function formatDateBadge(isoDate: string, today: string): string {
  if (isoDate === today) return '今天'
  if (isoDate === addDays(today, 1)) return '明天'
  if (isoDate === addDays(today, 2)) return '后天'
  const [, m, d] = isoDate.split('-')
  return `${Number(m)}月${Number(d)}日`
}

export function TodoDdlPicker({
  value,
  onValueChange,
  now,
  timeZone,
  disabled = false,
  error,
}: TodoDdlPickerProps) {
  const today = calendarDateOf(now, timeZone)
  const tomorrow = addDays(today, 1)
  const hasValue = value !== ''
  const [datePart = today, timePart = '23:59'] = hasValue ? value.split('T') : [today, '23:59']

  const [panelOpen, setPanelOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const previewText = hasValue
    ? formatDue(combineLocalDateTime(value, timeZone).toISOString(), now, timeZone)
    : null

  function selectDate(nextDate: string, openPanel = true) {
    onValueChange(`${nextDate}T${timePart || '23:59'}`)
    if (openPanel) setPanelOpen(true)
  }

  function selectTime(nextTime: string) {
    onValueChange(`${datePart || today}T${nextTime}`)
  }

  function clearDdl() {
    onValueChange('')
    setPanelOpen(false)
    setCalendarOpen(false)
  }

  const isToday = hasValue && datePart === today
  const isTomorrow = hasValue && datePart === tomorrow
  const isCustomDate = hasValue && !isToday && !isTomorrow

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption font-semibold">DDL</span>
        {previewText ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setPanelOpen((o) => !o)}
            className="bg-primary-soft text-primary-ink text-tiny inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold tabular-nums"
          >
            <Icon name="clock" size={12} lineOnly />
            <span>{previewText}</span>
            <Icon
              name="chevron-down"
              size={12}
              className={cn(
                'transition-transform duration-(--dur-base)',
                panelOpen && 'rotate-180',
              )}
              lineOnly
            />
          </button>
        ) : (
          <span className="text-tiny text-subtle">可选</span>
        )}
      </div>

      {/* 单行快捷预设胶囊 */}
      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="快捷 DDL">
        <PresetPill active={!hasValue} disabled={disabled} onClick={clearDdl}>
          不设
        </PresetPill>
        <PresetPill active={isToday} disabled={disabled} onClick={() => selectDate(today, true)}>
          今天
        </PresetPill>
        <PresetPill
          active={isTomorrow}
          disabled={disabled}
          onClick={() => selectDate(tomorrow, true)}
        >
          明天
        </PresetPill>
        <PresetPill
          active={isCustomDate || (panelOpen && calendarOpen)}
          disabled={disabled}
          onClick={() => {
            if (!hasValue) onValueChange(`${today}T23:59`)
            setPanelOpen(true)
            setCalendarOpen(true)
          }}
        >
          {isCustomDate ? formatDateBadge(datePart, today) : '选日期'}
        </PresetPill>
      </div>

      {/* 展开的手账日期 + 打卡同款时间滚轮面板 */}
      <Collapse open={panelOpen && hasValue} unmountOnCollapse>
        <div
          data-todo-ddl-panel="true"
          className="border-border bg-surface-sunken/55 flex flex-col gap-2.5 rounded-2xl border p-3"
        >
          {/* 顶部日期/时刻摘要栏：点日期切换手账日历 */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setCalendarOpen((o) => !o)}
              className={cn(
                'ease-spring text-tiny inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 font-semibold transition-colors duration-(--dur-fast)',
                calendarOpen
                  ? 'border-primary/45 bg-primary-soft text-primary-ink'
                  : 'border-border bg-surface text-foreground hover:bg-surface-sunken',
              )}
            >
              <Icon name="calendar" size={14} lineOnly />
              <span className="tabular-nums">{datePart}</span>
              <span className="text-subtle">({formatDateBadge(datePart, today)})</span>
            </button>

            <div className="flex items-center gap-1.5">
              <span className="font-display text-caption text-primary-ink font-bold tabular-nums">
                {timePart}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setPanelOpen(false)}
                className="text-tiny text-muted hover:text-foreground rounded-full px-1.5 py-0.5 font-semibold"
              >
                收起
              </button>
            </div>
          </div>

          {/* 按需展开的共享手账日历 */}
          <Collapse open={calendarOpen} unmountOnCollapse>
            <div className="border-border/70 bg-surface rounded-xl border p-2.5">
              <Calendar
                label="选择截止日期"
                today={today}
                defaultMonth={datePart.slice(0, 7)}
                maxMonth="2099-12"
                selected={datePart}
                marks={[{ date: datePart, tone: 'primary', variant: 'done', label: '截止日' }]}
                onDayClick={(d) => {
                  selectDate(d, true)
                  setCalendarOpen(false)
                }}
              />
            </div>
          </Collapse>

          {/* 复用打卡同款双列时间滚轮 + 常用时刻快捷按钮 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-tiny text-muted font-semibold">截止时刻</span>
              <div className="flex items-center gap-1">
                {TIME_PRESETS.map((preset) => {
                  const selected = timePart === preset
                  return (
                    <button
                      key={preset}
                      type="button"
                      disabled={disabled}
                      onClick={() => selectTime(preset)}
                      className={cn(
                        'text-tiny rounded-full px-2 py-0.5 font-semibold tabular-nums transition-colors',
                        selected
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface border-border text-muted hover:text-foreground border',
                      )}
                    >
                      {preset}
                    </button>
                  )
                })}
              </div>
            </div>

            <TimePicker
              label="截止时间"
              value={timePart}
              onChange={selectTime}
              tone="primary"
              className="bg-surface border-border border"
            />
          </div>
        </div>
      </Collapse>

      {error && (
        <p role="alert" className="text-tiny text-danger-ink">
          {error}
        </p>
      )}
    </div>
  )
}

function PresetPill({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'ease-spring text-tiny flex min-h-9 items-center justify-center truncate rounded-full border px-2 font-semibold transition-[transform,background-color,border-color,color] duration-(--dur-fast) active:scale-95 disabled:opacity-50',
        active
          ? 'border-primary/45 bg-primary-soft text-primary-ink'
          : 'border-border bg-surface text-muted hover:bg-surface-sunken hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
