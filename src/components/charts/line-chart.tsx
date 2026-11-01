'use client'

import { useEffect, useRef, useState } from 'react'
import { area, curveMonotoneX, line } from 'd3-shape'
import { cn } from '@/lib/cn'
import { strokeToneClass, type Tone } from '@/components/ui/tone'
import { defaultFormat, fillToneClass } from './chart-tone'
import { extentOf, linearScale, paddedExtent, ticks } from './scale'

/*
 * 折线图：体重趋势、AI 花费（ADR-0010）。自研 SVG + d3-shape 的 line / area / curveMonotoneX。
 * 横轴按点的顺序等距排列（调用方传入按日期升序的序列），value 为 null 的点断开不画。
 * 宽度跟随容器（ResizeObserver），文字不随缩放变形。
 */

export interface LineChartPoint {
  /** 横轴文字，例如"11/1" */
  label: string
  value: number | null
}

interface LineChartProps {
  data: readonly LineChartPoint[]
  /** 图表名称，同时用于读屏，例如"近 30 天体重" */
  label: string
  tone?: Tone
  /** 单位，拼在数值后面，例如"kg" */
  unit?: string
  /** 固定小数位数（服务端组件里用它，函数不能跨服务端 / 客户端边界传） */
  decimals?: number
  /** 自定义数值格式，只能在客户端组件里传；优先于 decimals */
  formatValue?: (v: number) => string
  height?: number
  /** 线下面铺一层浅色面积 */
  showArea?: boolean
  /** 在图表下方显示"最近 / 最低 / 最高"摘要，默认显示 */
  showSummary?: boolean
  /** 没有数据时的文案 */
  emptyText?: string
  className?: string
}

const PAD = { top: 16, right: 12, bottom: 24, left: 36 }

type Defined = { i: number; value: number }

export function LineChart({
  data,
  label,
  tone = 'primary',
  unit = '',
  decimals,
  formatValue: customFormat,
  height = 180,
  showArea = true,
  showSummary = true,
  emptyText = '还没有数据',
  className,
}: LineChartProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(160, Math.round(entry.contentRect.width)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const formatValue =
    customFormat ?? (decimals !== undefined ? (v: number) => v.toFixed(decimals) : defaultFormat)
  const fmt = (v: number) => `${formatValue(v)}${unit}`
  const points: Defined[] = []
  data.forEach((d, i) => {
    if (d.value !== null && Number.isFinite(d.value)) points.push({ i, value: d.value })
  })
  const raw = extentOf(points.map((p) => p.value))
  const latest = points.at(-1)
  const summary =
    raw && latest
      ? `最近 ${fmt(latest.value)} · 最低 ${fmt(raw[0])} · 最高 ${fmt(raw[1])}`
      : emptyText

  const innerW = width - PAD.left - PAD.right
  const innerH = height - PAD.top - PAD.bottom
  const yDomain = raw ? paddedExtent(raw) : ([0, 1] as const)
  const x = linearScale([0, Math.max(1, data.length - 1)], [PAD.left, PAD.left + innerW])
  const y = linearScale(yDomain, [PAD.top + innerH, PAD.top])

  const lineGen = line<Defined>()
    .x((d) => x(d.i))
    .y((d) => y(d.value))
    .curve(curveMonotoneX)
  const areaGen = area<Defined>()
    .x((d) => x(d.i))
    .y0(PAD.top + innerH)
    .y1((d) => y(d.value))
    .curve(curveMonotoneX)

  // 断开的段分别画，null 不连线
  const segments: Defined[][] = []
  let current: Defined[] = []
  data.forEach((d, i) => {
    if (d.value === null || !Number.isFinite(d.value)) {
      if (current.length > 0) segments.push(current)
      current = []
    } else current.push({ i, value: d.value })
  })
  if (current.length > 0) segments.push(current)

  const yTicks = raw ? ticks(yDomain, 3) : []
  // 横轴最多标 5 个，首尾必标
  const step = Math.max(1, Math.ceil((data.length - 1) / 4))
  const xLabels = data
    .map((d, i) => ({ i, text: d.label }))
    .filter(
      ({ i }) =>
        i === 0 || i === data.length - 1 || (i % step === 0 && data.length - 1 - i >= step / 2),
    )
  const showDots = points.length <= 14

  return (
    <figure
      className={cn('flex w-full max-w-full min-w-0 flex-col gap-2 overflow-hidden', className)}
    >
      <div ref={ref} className="w-full">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${label}：${summary}`}
          className="block overflow-visible"
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={PAD.left + innerW}
                y1={y(t)}
                y2={y(t)}
                className="stroke-border"
                strokeDasharray="3 4"
              />
              <text
                x={PAD.left - 6}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted text-tiny font-display tabular-nums"
              >
                {formatValue(t)}
              </text>
            </g>
          ))}
          {xLabels.map(({ i, text }) => (
            <text
              key={i}
              x={x(i)}
              y={height - 6}
              textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
              className="fill-muted text-tiny tabular-nums"
            >
              {text}
            </text>
          ))}
          {showArea &&
            segments.map((s) => (
              <path
                key={`a${s[0]?.i}`}
                d={areaGen(s) ?? undefined}
                className={fillToneClass[tone]}
                fillOpacity={0.14}
              />
            ))}
          {segments.map((s) =>
            s.length === 1 ? null : (
              <path
                key={`l${s[0]?.i}`}
                d={lineGen(s) ?? undefined}
                fill="none"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={strokeToneClass[tone]}
              />
            ),
          )}
          {showDots &&
            points.map((p) => (
              <circle
                key={p.i}
                cx={x(p.i)}
                cy={y(p.value)}
                r={p === latest ? 4.5 : 3}
                strokeWidth={2}
                className={cn('stroke-surface', fillToneClass[tone])}
              />
            ))}
          {latest && !showDots && (
            <circle
              cx={x(latest.i)}
              cy={y(latest.value)}
              r={4.5}
              strokeWidth={2}
              className={cn('stroke-surface', fillToneClass[tone])}
            />
          )}
          {latest && (
            <text
              x={x(latest.i)}
              y={y(latest.value) - 10}
              textAnchor={latest.i === data.length - 1 ? 'end' : 'middle'}
              className="fill-foreground text-tiny font-display font-semibold tabular-nums"
            >
              {fmt(latest.value)}
            </text>
          )}
        </svg>
      </div>
      {showSummary && (
        <figcaption className="text-tiny text-muted tabular-nums">{summary}</figcaption>
      )}
    </figure>
  )
}
