import { area, curveMonotoneX, line } from 'd3-shape'
import { cn } from '@/lib/cn'
import { strokeToneClass, type Tone } from '@/components/ui/tone'
import { fillToneClass } from './chart-tone'
import { extentOf, linearScale, paddedExtent } from './scale'

/*
 * 迷你趋势线：放在卡片里，只看走势不看刻度（主页体重卡）。
 * 固定尺寸、无交互，不需要客户端组件。null 值跳过（直接连到下一个有值的点）。
 */

interface SparklineProps {
  values: readonly (number | null)[]
  /** 读屏名称，同时包含走势摘要，例如"近 7 天体重，从 53.0 降到 52.4" */
  label: string
  tone?: Tone
  width?: number
  height?: number
  /** 线下面铺一层浅色面积 */
  showArea?: boolean
  className?: string
}

type Pt = { i: number; v: number }

export function Sparkline({
  values,
  label,
  tone = 'primary',
  width = 96,
  height = 32,
  showArea = true,
  className,
}: SparklineProps) {
  const pts: Pt[] = []
  values.forEach((v, i) => {
    if (v !== null && Number.isFinite(v)) pts.push({ i, v })
  })
  const raw = extentOf(pts.map((p) => p.v))
  const pad = 3
  const x = linearScale([0, Math.max(1, values.length - 1)], [pad, width - pad])
  const y = linearScale(raw ? paddedExtent(raw, 0.1, 0.5) : [0, 1], [height - pad, pad])
  const last = pts.at(-1)

  const lineD =
    pts.length > 1
      ? line<Pt>()
          .x((p) => x(p.i))
          .y((p) => y(p.v))
          .curve(curveMonotoneX)(pts)
      : null
  const areaD =
    showArea && pts.length > 1
      ? area<Pt>()
          .x((p) => x(p.i))
          .y0(height)
          .y1((p) => y(p.v))
          .curve(curveMonotoneX)(pts)
      : null

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className={cn('block shrink-0 overflow-visible', className)}
    >
      {areaD && <path d={areaD} className={fillToneClass[tone]} fillOpacity={0.16} />}
      {lineD && (
        <path
          d={lineD}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={strokeToneClass[tone]}
        />
      )}
      {last && (
        <circle
          cx={x(last.i)}
          cy={y(last.v)}
          r={3}
          strokeWidth={1.5}
          className={cn('stroke-surface', fillToneClass[tone])}
        />
      )}
    </svg>
  )
}
