'use client'

import { useId } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './icon'
import { Input } from './field'
import { softToneClass, type Tone } from './tone'

/*
 * 睡眠区间：两个原生 time 输入（ADR-0007、time-and-dates.md 第 5 节）。
 * 起床早于入睡时算作次日，并实时显示时长。这里只做"显示用"的分钟数计算；
 * 提交时由调用方用 src/lib/time 的 sleepRange() 按用户时区组合成两个时刻。
 */

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/

function toMinutes(hhmm: string): number | null {
  const m = HHMM.exec(hhmm)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

export interface TimeRangeSpan {
  /** 时长（分钟），0 < minutes < 1440 */
  minutes: number
  /** 起床时间早于入睡时间：跨过午夜，起床算作次日 */
  nextDay: boolean
}

/**
 * 入睡 → 起床的时长。任一值不是 HH:mm，或两者相等（视为输入错误）时返回 null。
 * 纯函数，不涉及时区：只是钟面上的分钟差。
 */
export function timeRangeSpan(start: string, end: string): TimeRangeSpan | null {
  const a = toMinutes(start)
  const b = toMinutes(end)
  if (a === null || b === null || a === b) return null
  const nextDay = b < a
  return { minutes: nextDay ? b + 1440 - a : b - a, nextDay }
}

/** 7 小时 30 分 → "7小时30分"；整点省略分钟，不足 1 小时只写分钟 */
export function formatSpanMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}分钟`
  return m === 0 ? `${h}小时` : `${h}小时${m}分`
}

interface TimeRangeFieldProps {
  label: string
  startLabel?: string
  endLabel?: string
  /** HH:mm */
  start: string
  end: string
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
  /** 时长合法范围（分钟），超出时时长标成警告色；默认 30 分钟 – 20 小时（PRD 2.4 睡眠） */
  minMinutes?: number
  maxMinutes?: number
  tone?: Tone
  hint?: string
  /** 外部（例如服务端）给的错误，优先于内置的时长提示 */
  error?: string
  className?: string
}

/** 时间区间：入睡 / 起床两个时间，跨午夜显示"次日"并实时算时长 */
export function TimeRangeField({
  label,
  startLabel = '入睡',
  endLabel = '起床',
  start,
  end,
  onStartChange,
  onEndChange,
  minMinutes = 30,
  maxMinutes = 20 * 60,
  tone = 'sleep',
  hint,
  error,
  className,
}: TimeRangeFieldProps) {
  const uid = useId()
  const startId = `${uid}-start`
  const endId = `${uid}-end`
  const msgId = `${uid}-msg`

  const span = timeRangeSpan(start, end)
  const filled = start !== '' && end !== ''
  const sameTime = filled && span === null && start === end
  const outOfRange = span !== null && (span.minutes < minMinutes || span.minutes > maxMinutes)
  const rangeError = sameTime
    ? `${startLabel}和${endLabel}时间不能一样`
    : outOfRange
      ? `时长要在 ${formatSpanMinutes(minMinutes)} 到 ${formatSpanMinutes(maxMinutes)} 之间`
      : undefined
  const message = error ?? rangeError
  const invalid = message !== undefined

  return (
    <fieldset className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <legend className="text-caption mb-1.5 font-semibold">{label}</legend>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={startId} className="text-tiny text-muted font-semibold">
            {startLabel}
          </label>
          <Input
            id={startId}
            type="time"
            value={start}
            onChange={(e) => onStartChange(e.target.value)}
            aria-invalid={invalid || undefined}
            aria-describedby={msgId}
            className="tabular-nums"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor={endId}
            className="text-tiny text-muted flex items-center gap-1.5 font-semibold"
          >
            {endLabel}
            {span?.nextDay && (
              <span className={cn('text-tiny rounded-full px-1.5 leading-4', softToneClass[tone])}>
                次日
              </span>
            )}
          </label>
          <Input
            id={endId}
            type="time"
            value={end}
            onChange={(e) => onEndChange(e.target.value)}
            aria-invalid={invalid || undefined}
            aria-describedby={msgId}
            className="tabular-nums"
          />
        </div>
      </div>
      <div id={msgId} aria-live="polite" className="flex min-h-5 items-center gap-1.5">
        {message ? (
          <p role="alert" className="text-tiny text-danger-ink">
            {message}
          </p>
        ) : span ? (
          <p className="text-caption text-muted flex items-center gap-1.5">
            <Icon name="clock" size={16} />共
            <span className="font-display text-foreground font-semibold tabular-nums">
              {formatSpanMinutes(span.minutes)}
            </span>
            {span.nextDay && <span className="text-tiny">（跨过午夜）</span>}
          </p>
        ) : (
          hint && <p className="text-tiny text-muted">{hint}</p>
        )}
      </div>
    </fieldset>
  )
}
