import { addDays, daysBetween, parseLocalDate, type LocalDateString } from '@/lib/time'

/*
 * 时间比例走势图（TrendLineChart）纯计算模块（Issue #104）。
 * 无 React / DOM 依赖，严格走 src/lib/time 纯日历运算，不读系统时区。
 */

export interface TrendPoint {
  date: LocalDateString
  value: number
}

export interface IndexedTrendPoint extends TrendPoint {
  /** 距离窗口起点 startDate 的真实日历天数（0..spanDays） */
  dayOffset: number
}

export interface TrendSegments {
  /** 连续段（相邻两点间隔 <= gapThresholdDays） */
  segments: IndexedTrendPoint[][]
  /** 超过 gapThresholdDays 的跨空窗桥接点对，用于渲染浅虚线 */
  gaps: [IndexedTrendPoint, IndexedTrendPoint][]
}

export interface CalendarXTick {
  dayOffset: number
  label: string
}

/** 过滤窗口内有限数值、按日期去重（后写覆盖）并升序排列，附带日历偏移量 */
export function normalizeTrendPoints(
  data: readonly TrendPoint[],
  startDate: LocalDateString,
  endDate: LocalDateString,
): IndexedTrendPoint[] {
  const byDate = new Map<LocalDateString, number>()
  for (const p of data) {
    if (!Number.isFinite(p.value)) continue
    if (p.date < startDate || p.date > endDate) continue
    byDate.set(p.date, p.value)
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, value]) => ({
      date,
      value,
      dayOffset: daysBetween(startDate, date),
    }))
}

/** 将升序记录按时间空窗拆分：相邻点间隔 > gapThresholdDays 时拆段并产出虚线桥接对 */
export function splitTrendSegments(
  points: readonly IndexedTrendPoint[],
  gapThresholdDays = 30,
): TrendSegments {
  if (points.length === 0) return { segments: [], gaps: [] }
  const segments: IndexedTrendPoint[][] = []
  const gaps: [IndexedTrendPoint, IndexedTrendPoint][] = []
  let current: IndexedTrendPoint[] = [points[0]!]

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]!
    const curr = points[i]!
    const gap = curr.dayOffset - prev.dayOffset
    if (gap > gapThresholdDays) {
      segments.push(current)
      gaps.push([prev, curr])
      current = [curr]
    } else {
      current.push(curr)
    }
  }
  segments.push(current)
  return { segments, gaps }
}

/** 生成 4–5 个不拥挤的真实日历横轴刻度（首尾必标） */
export function buildCalendarXTicks(
  startDate: LocalDateString,
  endDate: LocalDateString,
  count = 5,
): CalendarXTick[] {
  const span = Math.max(0, daysBetween(startDate, endDate))
  if (span === 0) {
    const { month, day } = parseLocalDate(endDate)
    return [{ dayOffset: 0, label: `${month}/${day}` }]
  }
  const endYear = parseLocalDate(endDate).year
  const tickCount = Math.max(2, count)
  const useMonthStyle = span >= 120
  const out: CalendarXTick[] = []
  let prevOffset = -1

  for (let i = 0; i < tickCount; i += 1) {
    const dayOffset = i === tickCount - 1 ? span : Math.round((span * i) / (tickCount - 1))
    if (dayOffset === prevOffset) continue
    prevOffset = dayOffset
    const date = addDays(startDate, dayOffset)
    const { year, month, day } = parseLocalDate(date)
    let label: string
    if (useMonthStyle) {
      if (i === 0 && year !== endYear) {
        label = `${String(year).slice(-2)}/${month}月`
      } else {
        label = `${month}月`
      }
    } else {
      label = `${month}/${day}`
    }
    out.push({ dayOffset, label })
  }
  return out
}

/** 按目标日历偏移查找最近的已记录点下标（空数组返回 null） */
export function findNearestTrendIndex(
  points: readonly IndexedTrendPoint[],
  targetDayOffset: number,
): number | null {
  if (points.length === 0) return null
  let bestIdx = 0
  let bestDist = Math.abs(points[0]!.dayOffset - targetDayOffset)
  for (let i = 1; i < points.length; i += 1) {
    const dist = Math.abs(points[i]!.dayOffset - targetDayOffset)
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = i
    }
  }
  return bestIdx
}
