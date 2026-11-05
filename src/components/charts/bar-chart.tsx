import { cn } from '@/lib/cn'
import { strokeToneClass, type Tone } from '@/components/ui/tone'
import { fillToneClass } from './chart-tone'
import { linearScale } from './scale'

/*
 * 每日柱状图：板块近况卡里看「每天做了多少」，可叠一条虚线门槛（有效线、每日下限）。
 * 宽度随容器（viewBox + preserveAspectRatio none），柱子不需要等比；无交互，不需要客户端组件。
 * null 表示那天没有记录：画一个小点占位，和「记了 0」区分开。
 */

interface BarChartProps {
  values: readonly (number | null)[]
  /** 读屏名称，同时包含摘要，例如"近 7 天每天的平均分，最高 4.1" */
  label: string
  tone?: Tone
  /** 门槛线（与 values 同单位）；达到门槛的柱子用实色，没到的用浅色 */
  threshold?: number | null
  height?: number
  className?: string
}

const W = 100

export function BarChart({
  values,
  label,
  tone = 'primary',
  threshold = null,
  height = 56,
  className,
}: BarChartProps) {
  const finite = values.filter((v): v is number => v !== null && Number.isFinite(v))
  const max = Math.max(1e-9, ...finite, threshold ?? 0) * 1.1
  const y = linearScale([0, max], [height - 2, 2])
  const n = Math.max(1, values.length)
  const slot = W / n
  const barW = Math.max(1, slot * 0.62)

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className={cn('block h-14 w-full overflow-visible', className)}
      style={{ height }}
    >
      {values.map((v, i) => {
        const x = i * slot + (slot - barW) / 2
        if (v === null || !Number.isFinite(v)) {
          return (
            <rect
              key={i}
              x={x}
              y={height - 3}
              width={barW}
              height={1.5}
              rx={0.75}
              className="fill-border"
            />
          )
        }
        const top = y(v)
        const reached = threshold === null || v >= threshold
        return (
          <rect
            key={i}
            x={x}
            y={Math.min(top, height - 3)}
            width={barW}
            height={Math.max(1.5, height - 2 - top)}
            rx={Math.min(2, barW / 2)}
            className={cn(fillToneClass[tone], !reached && 'opacity-35')}
          />
        )
      })}
      {threshold !== null && (
        <line
          x1={0}
          x2={W}
          y1={y(threshold)}
          y2={y(threshold)}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
          className={cn(strokeToneClass.neutral, 'stroke-1')}
        />
      )}
    </svg>
  )
}
