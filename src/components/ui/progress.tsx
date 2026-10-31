import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { solidToneClass, strokeToneClass, type Tone } from './tone'

function clampRatio(value: number, max: number): number {
  if (max <= 0 || !Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value / max))
}

interface ProgressBarProps {
  value: number
  max?: number
  tone?: Tone
  size?: 'sm' | 'md' | 'lg'
  /** 读屏用的名称，例如"今日饮水" */
  label: string
  /** 进行中（例如 AI 正在处理）：填充部分加扫光 */
  active?: boolean
  className?: string
}

const barHeight = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' } as const

export function ProgressBar({
  value,
  max = 100,
  tone = 'primary',
  size = 'md',
  label,
  active = false,
  className,
}: ProgressBarProps) {
  const ratio = clampRatio(value, max)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(ratio * max)}
      className={cn(
        'bg-surface-sunken w-full overflow-hidden rounded-full',
        barHeight[size],
        className,
      )}
    >
      <div
        className={cn(
          'ease-out-soft relative h-full rounded-full transition-[width] duration-(--dur-slow)',
          solidToneClass[tone],
        )}
        style={{ width: `${ratio * 100}%` }}
      >
        {active && <span className="animate-shimmer bg-sheen absolute inset-0" />}
      </div>
    </div>
  )
}

interface ProgressRingProps {
  value: number
  max?: number
  tone?: Tone
  /** 直径（px） */
  size?: number
  thickness?: number
  label: string
  children?: ReactNode
  className?: string
}

/** 圆环：用于"今日完成度"、单个板块目标进度，中心可放数字 */
export function ProgressRing({
  value,
  max = 100,
  tone = 'primary',
  size = 72,
  thickness = 8,
  label,
  children,
  className,
}: ProgressRingProps) {
  const ratio = clampRatio(value, max)
  const r = (size - thickness) / 2
  const circumference = 2 * Math.PI * r
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(ratio * max)}
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={thickness}
          className="stroke-surface-sunken"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className={cn(
            'ease-out-soft transition-[stroke-dashoffset] duration-(--dur-slow)',
            strokeToneClass[tone],
          )}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  )
}

interface StepProgressProps {
  total: number
  done: number
  tone?: Tone
  label: string
  className?: string
}

/** 分段进度：一天要完成的次数（例如 3 餐里完成 2 餐），每段一格 */
export function StepProgress({
  total,
  done,
  tone = 'primary',
  label,
  className,
}: StepProgressProps) {
  const count = Math.max(0, Math.floor(total))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={count}
      aria-valuenow={Math.min(done, count)}
      className={cn('flex w-full gap-1.5', className)}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-2 flex-1 rounded-full transition-colors duration-(--dur-base)',
            i < done ? solidToneClass[tone] : 'bg-surface-sunken',
          )}
        />
      ))}
    </div>
  )
}
