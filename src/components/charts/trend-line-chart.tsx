'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { area, curveMonotoneX, line } from 'd3-shape'
import { strokeToneClass, type Tone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
import { addDays, daysBetween, type LocalDateString } from '@/lib/time'
import { defaultFormat, fillToneClass } from './chart-tone'
import { extentOf, linearScale, paddedExtent, ticks, type Extent } from './scale'
import {
  buildCalendarXTicks,
  findNearestTrendIndex,
  normalizeTrendPoints,
  splitTrendSegments,
  type IndexedTrendPoint,
  type TrendPoint,
} from './trend-line-chart-math'

/*
 * 真实日历时间比例折线图（Issue #104）：用于体重与心情 Dock 顶部展示近一年变化。
 * - 只引 d3-shape（line / area / curveMonotoneX）+ 自研线性比例尺 + src/lib/time 纯日历偏移；
 * - 支持稀疏记录真实间距、>30 天空窗虚线桥接、固定 yDomain/语义刻度（心情 1–5）、单点参考线与紧凑空态；
 * - 顶部固定 24px 读数条替代悬浮 Tooltip（悬停 / 触控横向划动 / 键盘左右键原地切读数，彻底规避窄屏截断）；
 * - 交互容器标记 data-base-ui-swipe-ignore + touch-pan-y，划动检视绝不误触 Base UI Drawer 下滑关闭。
 */

export type { TrendPoint }

export interface TrendYTick {
  value: number
  label: string
}

export interface TrendReferenceLine {
  value: number
  /** 右端微型文字标签，例如「参考 8,000」 */
  label?: string
}

export interface TrendLineChartProps {
  data: readonly TrendPoint[]
  /** 窗口结束日期 YYYY-MM-DD（由调用方按用户时区算好，组件不读系统时间） */
  endDate: LocalDateString
  /** 统计窗口天数，默认 365（近一年） */
  days?: number
  /** 读屏名称，例如「近一年体重变化」 */
  label: string
  tone?: Tone
  /** 数值单位，如 'kg' */
  unit?: string
  /** 固定小数位（服务端组件可安全传入） */
  decimals?: number
  /** 自定义刻度/数值格式（客户端组件可用，优先于 decimals） */
  formatValue?: (v: number) => string
  /** 选中某一点时在读数条显示的格式（如心情「4 分 · 不错」） */
  formatPointValue?: (v: number) => string
  /** 固定纵轴区间（如心情 [1, 5]），不传则按数据范围自动留白 */
  yDomain?: Extent
  /** 自定义纵轴刻度与语义文案（如 超棒 / 一般 / 很糟） */
  yTicks?: readonly TrendYTick[]
  /** 可选水平参考虚线（如每日步数参考线 8,000 步） */
  referenceLine?: TrendReferenceLine | null
  /** 默认读数条文案（未选中任何点时展示） */
  defaultSummary?: string
  /** 0 条记录时的紧凑引导文案 */
  emptyText?: string
  /** 仅 1 条记录时的温和提示 */
  singleHint?: string
  /** 相邻记录间隔超过该天数时拆段并用浅虚线桥接，默认 30 天 */
  gapThresholdDays?: number
  /** SVG 高度（不含顶部读数条与内边距），默认 136px，整体卡片约 188px */
  height?: number
  /** 语义标识，便于验收与测试定位 */
  chartId?: string
  className?: string
}

export function TrendLineChart({
  data,
  endDate,
  days = 365,
  label,
  tone = 'primary',
  unit = '',
  decimals,
  formatValue: customFormat,
  formatPointValue,
  yDomain: fixedYDomain,
  yTicks: customYTicks,
  referenceLine = null,
  defaultSummary,
  emptyText = '还没有记录，记下今天的第一条吧',
  singleHint = '记够 2 天就会连成近一年走势线',
  gapThresholdDays = 30,
  height = 136,
  chartId,
  className,
}: TrendLineChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(312)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(180, Math.round(entry.contentRect.width)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const safeDays = Math.max(1, Math.floor(days))
  const startDate = addDays(endDate, -(safeDays - 1))
  const spanDays = Math.max(1, daysBetween(startDate, endDate))
  const points = normalizeTrendPoints(data, startDate, endDate)

  const formatValue =
    customFormat ?? (decimals !== undefined ? (v: number) => v.toFixed(decimals) : defaultFormat)
  const fmtUnit = (v: number) => `${formatValue(v)}${unit ? ` ${unit}` : ''}`
  const fmtPoint = formatPointValue ?? fmtUnit

  const rawExtent = extentOf(points.map((p) => p.value))
  const latest = points.at(-1) ?? null
  const summaryText =
    defaultSummary ??
    (rawExtent
      ? points.length === 1
        ? `近一年 · ${fmtPoint(points[0]!.value)}`
        : `近一年 · 最低 ${formatValue(rawExtent[0])} / 最高 ${formatValue(rawExtent[1])}${unit ? ` ${unit}` : ''}`
      : emptyText)

  const clampedActive =
    activeIdx !== null && activeIdx >= 0 && activeIdx < points.length ? activeIdx : null
  const activePoint = clampedActive !== null ? points[clampedActive]! : null

  // 0 条记录：紧凑凹陷空卡（约 88px），不浪费 Dock 纵向空间
  if (points.length === 0) {
    return (
      <figure
        data-trend-chart={chartId}
        aria-label={`${label}：${emptyText}`}
        className={cn(
          'bg-surface-sunken/70 border-border/60 flex min-h-[88px] w-full flex-col justify-between rounded-2xl border px-3.5 py-3',
          className,
        )}
      >
        <div
          data-trend-readout="true"
          className="text-tiny text-muted flex h-5 items-center justify-between gap-2 font-semibold"
        >
          <span>{label}</span>
          <span>暂无记录</span>
        </div>
        <div className="relative my-1.5 flex items-center">
          <div className="border-border-strong/70 w-full border-t border-dashed" />
        </div>
        <p className="text-tiny text-muted">{emptyText}</p>
      </figure>
    )
  }

  const hasTextYLabels = Boolean(customYTicks?.some((t) => t.label.length > 2))
  const pad = {
    top: 12,
    right: 10,
    bottom: 20,
    left: hasTextYLabels ? 38 : 34,
  }
  const innerW = Math.max(80, width - pad.left - pad.right)
  const innerH = Math.max(48, height - pad.top - pad.bottom)

  const validRef = referenceLine && Number.isFinite(referenceLine.value) ? referenceLine : null
  const domainSourceExtent: Extent | null = rawExtent
    ? validRef
      ? ([Math.min(rawExtent[0], validRef.value), Math.max(rawExtent[1], validRef.value)] as const)
      : rawExtent
    : null

  const yDomain: Extent =
    fixedYDomain ??
    (domainSourceExtent ? paddedExtent(domainSourceExtent, 0.18, 0.8) : ([0, 1] as const))
  const x = linearScale([0, spanDays], [pad.left, pad.left + innerW])
  const y = linearScale(yDomain, [pad.top + innerH, pad.top])

  const yTickItems: readonly TrendYTick[] =
    customYTicks ?? ticks(yDomain, 3).map((v) => ({ value: v, label: formatValue(v) }))
  const xTickItems = buildCalendarXTicks(startDate, endDate, width < 280 ? 4 : 5)

  const { segments, gaps } = splitTrendSegments(points, gapThresholdDays)

  const lineGen = line<IndexedTrendPoint>()
    .x((d) => x(d.dayOffset))
    .y((d) => y(d.value))
    .curve(curveMonotoneX)

  const areaGen = area<IndexedTrendPoint>()
    .x((d) => x(d.dayOffset))
    .y0(pad.top + innerH)
    .y1((d) => y(d.value))
    .curve(curveMonotoneX)

  const showAllDots = points.length <= 24

  function selectFromClientX(clientX: number, target: HTMLElement) {
    const rect = target.getBoundingClientRect()
    const relX = clientX - rect.left
    const ratio = Math.max(0, Math.min(1, (relX - pad.left) / innerW))
    const targetDayOffset = ratio * spanDays
    setActiveIdx(findNearestTrendIndex(points, targetDayOffset))
  }

  function handlePointer(e: PointerEvent<HTMLDivElement>) {
    selectFromClientX(e.clientX, e.currentTarget)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (points.length === 0) return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setActiveIdx((prev) =>
        prev === null ? Math.max(0, points.length - 2) : Math.max(0, prev - 1),
      )
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setActiveIdx((prev) =>
        prev === null ? points.length - 1 : Math.min(points.length - 1, prev + 1),
      )
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActiveIdx(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActiveIdx(points.length - 1)
    } else if (e.key === 'Escape') {
      setActiveIdx(null)
    }
  }

  const singlePoint = points.length === 1 ? points[0]! : null

  return (
    <figure
      data-trend-chart={chartId}
      className={cn(
        'bg-surface-sunken/70 border-border/60 flex w-full max-w-full min-w-0 flex-col gap-1.5 overflow-hidden rounded-2xl border px-3 py-2.5',
        className,
      )}
    >
      {/* 顶部固定 24px 读数条：默认展示摘要，划动/悬停/键盘切换原地显示日期与数值 */}
      <div
        data-trend-readout="true"
        className="flex h-6 items-center justify-between gap-2 overflow-hidden"
      >
        {activePoint ? (
          <>
            <span className="font-display text-tiny text-muted shrink-0 tabular-nums">
              {activePoint.date}
            </span>
            <span className="font-display text-caption text-foreground truncate font-semibold tabular-nums">
              {fmtPoint(activePoint.value)}
            </span>
          </>
        ) : (
          <>
            <span className="text-tiny text-foreground/90 min-w-0 truncate font-semibold tabular-nums">
              {summaryText}
            </span>
            <span className="text-tiny text-muted shrink-0">
              {singlePoint ? singleHint : '划动看详情'}
            </span>
          </>
        )}
      </div>

      {/* 交互绘图区：data-base-ui-swipe-ignore + touch-pan-y 避免触发 Base UI Drawer 下滑关闭 */}
      <div
        ref={wrapRef}
        data-base-ui-swipe-ignore=""
        tabIndex={0}
        role="img"
        aria-label={`${label}：${summaryText}`}
        onPointerDown={handlePointer}
        onPointerMove={(e) => {
          if (e.pointerType === 'mouse' || e.buttons > 0) handlePointer(e)
        }}
        onPointerLeave={() => setActiveIdx(null)}
        onPointerCancel={() => setActiveIdx(null)}
        onBlur={() => setActiveIdx(null)}
        onKeyDown={handleKeyDown}
        className="focus-visible:ring-primary/50 w-full touch-pan-y rounded-xl outline-none select-none focus-visible:ring-2"
      >
        <svg width={width} height={height} className="block overflow-visible">
          {/* Y 轴网格与刻度标签 */}
          {yTickItems.map((t) => (
            <g key={`${t.value}-${t.label}`}>
              <line
                x1={pad.left}
                x2={pad.left + innerW}
                y1={y(t.value)}
                y2={y(t.value)}
                className="stroke-border"
                strokeDasharray="3 4"
              />
              <text
                x={pad.left - 6}
                y={y(t.value)}
                textAnchor="end"
                dominantBaseline="middle"
                className={cn(
                  'fill-muted text-tiny tabular-nums',
                  !hasTextYLabels && 'font-display',
                )}
              >
                {t.label}
              </text>
            </g>
          ))}

          {/* X 轴真实日历刻度 */}
          {xTickItems.map((tick, idx) => (
            <text
              key={`${tick.dayOffset}-${tick.label}`}
              x={x(tick.dayOffset)}
              y={height - 4}
              textAnchor={idx === 0 ? 'start' : idx === xTickItems.length - 1 ? 'end' : 'middle'}
              className="fill-muted text-tiny tabular-nums"
            >
              {tick.label}
            </text>
          ))}

          {/* 可选水平参考虚线（如每日步数参考线） */}
          {validRef && (
            <g data-trend-reference-line="true">
              <line
                x1={pad.left}
                x2={pad.left + innerW}
                y1={y(validRef.value)}
                y2={y(validRef.value)}
                strokeWidth={1.25}
                strokeDasharray="4 3"
                strokeOpacity={0.65}
                className={strokeToneClass[tone]}
              />
              {validRef.label && (
                <text
                  x={pad.left + 4}
                  y={Math.max(pad.top + 8, y(validRef.value) - 4)}
                  textAnchor="start"
                  paintOrder="stroke"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  className="fill-muted stroke-surface-sunken font-display text-tiny font-semibold tabular-nums"
                >
                  {validRef.label}
                </text>
              )}
            </g>
          )}

          {/* 单点参考虚线 */}
          {singlePoint && (
            <line
              x1={pad.left}
              x2={pad.left + innerW}
              y1={y(singlePoint.value)}
              y2={y(singlePoint.value)}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              strokeOpacity={0.55}
              className={strokeToneClass[tone]}
            />
          )}

          {/* 超过空窗阈值的浅虚线桥接 */}
          {gaps.map(([a, b]) => (
            <line
              key={`gap-${a.date}-${b.date}`}
              data-trend-series="gap"
              x1={x(a.dayOffset)}
              y1={y(a.value)}
              x2={x(b.dayOffset)}
              y2={y(b.value)}
              strokeWidth={1.5}
              strokeDasharray="3 4"
              strokeOpacity={0.45}
              className={strokeToneClass[tone]}
            />
          ))}

          {/* 连续段浅面积 */}
          {segments.map((s) =>
            s.length < 2 ? null : (
              <path
                key={`area-${s[0]!.date}`}
                d={areaGen(s) ?? undefined}
                className={fillToneClass[tone]}
                fillOpacity={0.14}
              />
            ),
          )}

          {/* 连续段平滑实线 */}
          {segments.map((s) =>
            s.length < 2 ? null : (
              <path
                key={`line-${s[0]!.date}`}
                data-trend-series="solid"
                d={lineGen(s) ?? undefined}
                fill="none"
                strokeWidth={2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={strokeToneClass[tone]}
              />
            ),
          )}

          {/* 孤立单点段 / 稀疏点标记，确保每周一次或间断记录清晰可见 */}
          {points.map((p, idx) => {
            const isActive = activePoint?.date === p.date
            const isLatest = !activePoint && latest?.date === p.date
            const isIsolated = segments.some((s) => s.length === 1 && s[0]!.date === p.date)
            if (!showAllDots && !isActive && !isLatest && !isIsolated) return null
            return (
              <circle
                key={`${p.date}-${idx}`}
                cx={x(p.dayOffset)}
                cy={y(p.value)}
                r={isActive ? 5 : isLatest || singlePoint ? 4.5 : 3}
                strokeWidth={2}
                className={cn('stroke-surface', fillToneClass[tone])}
              />
            )
          })}

          {/* 交互选中准星与柔光外环 */}
          {activePoint && (
            <g data-trend-crosshair="true">
              <line
                x1={x(activePoint.dayOffset)}
                x2={x(activePoint.dayOffset)}
                y1={pad.top}
                y2={pad.top + innerH}
                strokeWidth={1.25}
                strokeDasharray="3 3"
                strokeOpacity={0.55}
                className={strokeToneClass[tone]}
              />
              <circle
                cx={x(activePoint.dayOffset)}
                cy={y(activePoint.value)}
                r={8}
                fillOpacity={0.18}
                className={fillToneClass[tone]}
              />
              <circle
                cx={x(activePoint.dayOffset)}
                cy={y(activePoint.value)}
                r={4.5}
                strokeWidth={2}
                className={cn('stroke-surface', fillToneClass[tone])}
              />
            </g>
          )}
        </svg>
      </div>
    </figure>
  )
}
