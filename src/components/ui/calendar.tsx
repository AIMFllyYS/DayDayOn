'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import {
  DayPicker,
  type ChevronProps,
  type DateLib,
  type DayProps,
  type Matcher,
  type Modifiers,
} from 'react-day-picker'
import { zhCN } from 'react-day-picker/locale/zh-CN'
import { cn } from '@/lib/cn'
import { Icon } from './icon'
import type { Tone } from './tone'

/*
 * 日历：React DayPicker 的唯一入口（ui-primitives.md 第 6 节、ADR-0007）。
 * - 一周从周一开始，中文 locale 从 react-day-picker/locale/zh-CN 导入（导出名 zhCN，2026-11-01 核对）。
 * - 对外只用 YYYY-MM-DD / YYYY-MM 字符串，不收 Date。内部固定 timeZone="UTC"，
 *   每个打卡日就是 UTC 零点，日期格子与用户浏览器的系统时区无关（time-and-dates.md 第 2 节）。
 *   "今天"由调用方按用户时区算好传进来（src/lib/time 的 localDateOf）。
 * - 不引入 DayPicker 自带的 style.css，所有样式用本项目 token 写在 classNames 里。
 */

export type CalendarMarkVariant = 'done' | 'partial' | 'makeup'

export interface CalendarMark {
  /** YYYY-MM-DD */
  date: string
  /** 一般是板块色 */
  tone: Tone
  /**
   * done：实底，当天达成目标；partial：浅底，有打卡但没达成；
   * makeup：虚线描边，当天只有补卡（PRD 2.4：补卡日用描边样式区分）
   */
  variant?: CalendarMarkVariant
  /** 读屏补充说明，例如"已打卡 2 次"；不传按 variant 给默认文案 */
  label?: string
}

interface CalendarProps {
  /** 今天的打卡日 YYYY-MM-DD（用户时区） */
  today: string
  /** 受控的当前月份 YYYY-MM；不传时从 defaultMonth（再不传就是今天所在月）开始 */
  month?: string
  defaultMonth?: string
  onMonthChange?: (month: string) => void
  /** 能翻到的最早 / 最晚月份 YYYY-MM；maxMonth 默认是今天所在月，不能往未来翻 */
  minMonth?: string
  maxMonth?: string
  marks?: readonly CalendarMark[]
  /** 选中的日子；配合 onDayClick 用于"看某一天的记录" */
  selected?: string | null
  /** 传了才可点击，每个日子变成按钮 */
  onDayClick?: (date: string) => void
  /** 可点的日期范围 YYYY-MM-DD（含两端），范围外的日子禁用 */
  minDate?: string
  maxDate?: string
  /** 读屏名称，例如"晨跑打卡日历" */
  label: string
  /** 日历下方的图例或说明 */
  footer?: ReactNode
  className?: string
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

/** YYYY-MM → 当月 1 日 UTC 零点；格式不对返回 undefined */
function monthToDate(month: string | undefined): Date | undefined {
  if (!month || !MONTH_RE.test(month)) return undefined
  return new Date(`${month}-01T00:00:00Z`)
}

function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`)
}

const pad = (n: number) => String(n).padStart(2, '0')

// DayPicker 在 UTC 下给出的日期，UTC 字段就是格子上的年月日
function isoDayOf(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
function isoMonthOf(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
}

// 类名写完整字符串，Tailwind 才扫描得到
const markClass: Record<CalendarMarkVariant, Record<Tone, string>> = {
  // 实底用 base 色 + 正文色：base 色上的 ink 字对比度不够
  done: {
    neutral: 'bg-border-strong text-foreground',
    primary: 'bg-primary text-on-primary',
    success: 'bg-success text-foreground',
    warning: 'bg-warning text-foreground',
    danger: 'bg-danger text-foreground',
    exercise: 'bg-exercise text-foreground',
    diet: 'bg-diet text-foreground',
    sleep: 'bg-sleep text-foreground',
    study: 'bg-study text-foreground',
    custom: 'bg-custom text-foreground',
  },
  partial: {
    neutral: 'bg-surface-sunken text-muted',
    primary: 'bg-primary-soft text-primary-ink',
    success: 'bg-success-soft text-success-ink',
    warning: 'bg-warning-soft text-warning-ink',
    danger: 'bg-danger-soft text-danger-ink',
    exercise: 'bg-exercise-soft text-exercise-ink',
    diet: 'bg-diet-soft text-diet-ink',
    sleep: 'bg-sleep-soft text-sleep-ink',
    study: 'bg-study-soft text-study-ink',
    custom: 'bg-custom-soft text-custom-ink',
  },
  makeup: {
    neutral: 'border-2 border-dashed border-border-strong text-muted',
    primary: 'border-2 border-dashed border-primary text-primary-ink',
    success: 'border-2 border-dashed border-success text-success-ink',
    warning: 'border-2 border-dashed border-warning text-warning-ink',
    danger: 'border-2 border-dashed border-danger text-danger-ink',
    exercise: 'border-2 border-dashed border-exercise text-exercise-ink',
    diet: 'border-2 border-dashed border-diet text-diet-ink',
    sleep: 'border-2 border-dashed border-sleep text-sleep-ink',
    study: 'border-2 border-dashed border-study text-study-ink',
    custom: 'border-2 border-dashed border-custom text-custom-ink',
  },
}

const defaultMarkLabel: Record<CalendarMarkVariant, string> = {
  done: '已完成',
  partial: '已打卡，未达成',
  makeup: '补卡',
}

const MarksContext = createContext<ReadonlyMap<string, CalendarMark>>(new Map())

/** 一个日子的格子：圆片按打卡标记着色，按钮（可点时）铺满圆片 */
function DayCell({ day, modifiers, className, children, ...td }: DayProps) {
  const mark = useContext(MarksContext).get(day.isoDate)
  const hidden = modifiers.hidden || modifiers.outside
  return (
    <td {...td} className={cn(className, 'p-0.5 text-center')}>
      {!hidden && (
        <span
          className={cn(
            'text-caption relative mx-auto flex aspect-square w-full max-w-11 items-center justify-center rounded-full font-semibold tabular-nums',
            'transition-colors duration-(--dur-fast)',
            mark ? markClass[mark.variant ?? 'done'][mark.tone] : 'text-foreground',
            modifiers.disabled && 'opacity-40',
            modifiers.selected && 'ring-foreground ring-offset-surface ring-2 ring-offset-1',
          )}
        >
          {children}
          {modifiers.today && (
            <span
              aria-hidden
              className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current"
            />
          )}
        </span>
      )}
    </td>
  )
}

function Chevron({ orientation, disabled }: ChevronProps) {
  return (
    <Icon
      name={orientation === 'right' ? 'chevron-right' : 'chevron-left'}
      size={20}
      className={disabled ? 'opacity-40' : undefined}
    />
  )
}

const components = { Day: DayCell, Chevron }

const navButtonClass =
  'inline-flex size-11 items-center justify-center rounded-full text-foreground ' +
  'transition-[transform,background-color] duration-(--dur-fast) ease-spring hover:bg-surface-sunken active:scale-90 ' +
  'aria-disabled:pointer-events-none aria-disabled:text-subtle'

const classNames = {
  root: 'w-full',
  months: 'w-full',
  month: 'grid w-full grid-cols-[auto_1fr_auto] items-center gap-y-2',
  month_caption: 'flex justify-center',
  caption_label: 'text-subhead font-bold tabular-nums',
  button_previous: navButtonClass,
  button_next: navButtonClass,
  month_grid: 'col-span-3 w-full table-fixed border-collapse',
  weekdays: '',
  weekday: 'text-tiny text-muted pb-1 font-semibold',
  week: '',
  day: '',
  day_button:
    'flex size-full items-center justify-center rounded-full cursor-pointer ' +
    'hover:bg-foreground/5 disabled:cursor-default',
}

export function Calendar({
  today,
  month,
  defaultMonth,
  onMonthChange,
  minMonth,
  maxMonth,
  marks = [],
  selected,
  onDayClick,
  minDate,
  maxDate,
  label,
  footer,
  className,
}: CalendarProps) {
  const markMap = useMemo(() => new Map(marks.map((m) => [m.date, m])), [marks])

  const todayMonth = today.slice(0, 7)
  const disabled: Matcher | undefined =
    minDate || maxDate
      ? (d: Date) => {
          const iso = isoDayOf(d)
          return (
            (minDate !== undefined && iso < minDate) || (maxDate !== undefined && iso > maxDate)
          )
        }
      : undefined

  const modifiers: Record<string, Matcher> = {}
  if (selected) modifiers.selected = dayToDate(selected)

  const labels = useMemo(() => {
    function describe(date: Date, mods: Modifiers, dateLib?: DateLib): string {
      // "2026年11月2日星期一"；zh-CN locale 的 PPPP 格式
      let text = dateLib ? dateLib.format(date, 'PPPP') : isoDayOf(date)
      if (mods.today) text = `今天，${text}`
      const mark = markMap.get(isoDayOf(date))
      if (mark) text = `${text}，${mark.label ?? defaultMarkLabel[mark.variant ?? 'done']}`
      if (mods.selected) text = `${text}，已选择`
      return text
    }
    return {
      labelDayButton: (date: Date, mods: Modifiers, _o?: unknown, lib?: DateLib) =>
        describe(date, mods, lib),
      labelGridcell: (date: Date, mods?: Modifiers, _o?: unknown, lib?: DateLib) =>
        describe(date, mods ?? {}, lib),
    }
  }, [markMap])

  return (
    <div aria-label={label} role="group" className={cn('flex w-full flex-col gap-3', className)}>
      <MarksContext value={markMap}>
        <DayPicker
          locale={zhCN}
          weekStartsOn={1}
          timeZone="UTC"
          today={dayToDate(today)}
          month={monthToDate(month)}
          defaultMonth={monthToDate(defaultMonth) ?? monthToDate(todayMonth)}
          onMonthChange={onMonthChange ? (d) => onMonthChange(isoMonthOf(d)) : undefined}
          startMonth={monthToDate(minMonth)}
          endMonth={monthToDate(maxMonth ?? todayMonth)}
          navLayout="around"
          disabled={disabled}
          modifiers={modifiers}
          onDayClick={onDayClick ? (d, m) => !m.disabled && onDayClick(isoDayOf(d)) : undefined}
          labels={labels}
          components={components}
          classNames={classNames}
        />
      </MarksContext>
      {footer}
    </div>
  )
}

/** 日历图例：和 CalendarMark 的三种样式一一对应 */
export function CalendarLegend({ tone, className }: { tone: Tone; className?: string }) {
  const items: CalendarMarkVariant[] = ['done', 'partial', 'makeup']
  return (
    <ul
      className={cn('text-tiny text-muted flex flex-wrap items-center gap-x-4 gap-y-1', className)}
    >
      {items.map((v) => (
        <li key={v} className="flex items-center gap-1.5">
          <span aria-hidden className={cn('size-3.5 rounded-full', markClass[v][tone])} />
          {defaultMarkLabel[v]}
        </li>
      ))}
    </ul>
  )
}
