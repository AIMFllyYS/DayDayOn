import { cn } from '@/lib/cn'
import { moduleMeta, type ModuleTone } from '@/components/ui/tone'
import { Icon } from '@/components/ui/icon'

/*
 * 本周热力图（PRD 2.7 第 4 项）：周一到周日 × 板块，格子深浅表示完成度（0–1，heatmapCell 的结果）。
 * 数据形状与 features/dashboard 的 WeekHeatmapSchema 一致，但这里按结构声明，原子层不 import 领域代码。
 * 用真正的 <table> 渲染，读屏可以按行列读；每格另有文字说明，不只靠颜色。
 */

export interface WeekHeatmapRow {
  module: ModuleTone
  /** 与 days 一一对应，0–1 */
  cells: readonly number[]
}

interface WeekHeatmapProps {
  /** 本周七天的打卡日 YYYY-MM-DD，周一起 */
  days: readonly string[]
  rows: readonly WeekHeatmapRow[]
  /** 今天的打卡日：高亮这一列，之后的格子显示为"还没到" */
  today?: string
  label?: string
  /** 显示图例和摘要，默认显示 */
  showLegend?: boolean
  className?: string
}

const WEEKDAY = ['一', '二', '三', '四', '五', '六', '日'] as const

type Level = 0 | 1 | 2 | 3

/** 完成度分四档：0 没打卡、(0, 0.5) 一点点、[0.5, 1) 大半、1 全部完成 */
export function heatLevel(v: number): Level {
  if (!(v > 0)) return 0
  if (v >= 1) return 3
  return v < 0.5 ? 1 : 2
}

// 类名写完整，Tailwind 才扫描得到；第 0 档统一用凹陷底
const levelClass: Record<ModuleTone, Record<Exclude<Level, 0>, string>> = {
  exercise: { 1: 'bg-exercise-soft', 2: 'bg-exercise/60', 3: 'bg-exercise text-exercise-ink' },
  diet: { 1: 'bg-diet-soft', 2: 'bg-diet/60', 3: 'bg-diet text-diet-ink' },
  sleep: { 1: 'bg-sleep-soft', 2: 'bg-sleep/60', 3: 'bg-sleep text-sleep-ink' },
  study: { 1: 'bg-study-soft', 2: 'bg-study/60', 3: 'bg-study text-study-ink' },
  custom: { 1: 'bg-custom-soft', 2: 'bg-custom/60', 3: 'bg-custom text-custom-ink' },
}

const inkClass: Record<ModuleTone, string> = {
  exercise: 'text-exercise-ink',
  diet: 'text-diet-ink',
  sleep: 'text-sleep-ink',
  study: 'text-study-ink',
  custom: 'text-custom-ink',
}

/** "2026-11-02" → "11/2"，只拆字符串，不经过 Date（避免系统时区） */
function shortDate(localDate: string): string {
  const [, m, d] = localDate.split('-')
  return m && d ? `${Number(m)}/${Number(d)}` : localDate
}

function cellText(v: number, future: boolean): string {
  if (future) return '还没到'
  const level = heatLevel(v)
  if (level === 0) return '没有打卡'
  if (level === 3) return '全部完成'
  return `完成 ${Math.round(v * 100)}%`
}

export function WeekHeatmap({
  days,
  rows,
  today,
  label = '本周打卡热力图',
  showLegend = true,
  className,
}: WeekHeatmapProps) {
  // 打卡日是 YYYY-MM-DD，字符串比较就是日期比较
  const isFuture = (d: string) => today !== undefined && d > today
  const pastCells = rows.flatMap((r) => r.cells.filter((_, i) => !isFuture(days[i] ?? '')))
  const doneCount = pastCells.filter((v) => heatLevel(v) === 3).length
  const partialCount = pastCells.filter((v) => heatLevel(v) === 1 || heatLevel(v) === 2).length
  const summary =
    doneCount + partialCount === 0
      ? '本周还没有打卡，今天开始也不晚'
      : `本周 ${doneCount} 格全部完成，${partialCount} 格完成了一部分`

  return (
    <figure className={cn('flex flex-col gap-3', className)}>
      <table className="w-full table-fixed border-separate border-spacing-1">
        <caption className="sr-only">
          {label}：{summary}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="w-10">
              <span className="sr-only">板块</span>
            </th>
            {days.map((d, i) => {
              const isToday = d === today
              return (
                <th
                  key={d}
                  scope="col"
                  className={cn(
                    'text-tiny pb-0.5 font-semibold',
                    isToday ? 'text-primary-ink' : 'text-muted',
                  )}
                >
                  <span aria-hidden>{WEEKDAY[i] ?? ''}</span>
                  <span className="sr-only">
                    周{WEEKDAY[i] ?? ''} {shortDate(d)}
                    {isToday ? '（今天）' : ''}
                  </span>
                  {isToday && (
                    <span
                      aria-hidden
                      className="bg-primary mx-auto mt-0.5 block size-1 rounded-full"
                    />
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const meta = moduleMeta[r.module]
            return (
              <tr key={r.module}>
                <th scope="row" className="text-left">
                  <span className={cn('flex items-center', inkClass[r.module])}>
                    <Icon name={meta.icon} size={18} label={meta.label} />
                  </span>
                </th>
                {days.map((d, i) => {
                  const v = r.cells[i] ?? 0
                  const future = isFuture(d)
                  const level = heatLevel(v)
                  return (
                    <td key={d} className="p-0">
                      <span
                        title={`${meta.label} · 周${WEEKDAY[i] ?? ''}：${cellText(v, future)}`}
                        className={cn(
                          'flex aspect-square w-full items-center justify-center rounded-md',
                          future
                            ? 'border-border border border-dashed'
                            : level === 0
                              ? 'bg-surface-sunken'
                              : levelClass[r.module][level],
                          d === today && 'ring-primary/50 ring-2',
                        )}
                      >
                        {level === 3 && !future && <Icon name="check" size={12} />}
                        <span className="sr-only">{cellText(v, future)}</span>
                      </span>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      {showLegend && (
        <figcaption className="text-tiny text-muted flex flex-wrap items-center justify-between gap-2">
          <span>{summary}</span>
          <span aria-hidden className="flex items-center gap-1">
            少
            <span className="bg-surface-sunken size-3 rounded-sm" />
            <span className="bg-primary-soft size-3 rounded-sm" />
            <span className="bg-primary/60 size-3 rounded-sm" />
            <span className="bg-primary size-3 rounded-sm" />多
          </span>
        </figcaption>
      )}
    </figure>
  )
}
