import { cn } from '@/lib/cn'
import type { ModuleTone } from './tone'

/** 印章上的字不小于 12px（ui-design-system.md：不用小于 12px 的字），小尺寸印章也一样 */
const MIN_FONT_PX = 12

const toneClass: Record<ModuleTone | 'primary', string> = {
  primary: 'text-primary-ink border-primary',
  exercise: 'text-exercise-ink border-exercise',
  diet: 'text-diet-ink border-diet',
  sleep: 'text-sleep-ink border-sleep',
  study: 'text-study-ink border-study',
  custom: 'text-custom-ink border-custom',
}

interface StampProps {
  /** 印章中间的大字，默认"已打卡" */
  text?: string
  /** 印章下方的小字，一般是日期，例如 10.31 */
  caption?: string
  tone?: ModuleTone | 'primary'
  size?: number
  /** 是否播放盖章动画；换 key 可以重播 */
  animate?: boolean
  className?: string
}

/**
 * 打卡印章：打卡成功的标志性反馈，像在手账上盖一个章。
 * 只在"刚刚完成打卡"时播放动画，历史记录里静态显示。
 */
export function Stamp({
  text = '已打卡',
  caption,
  tone = 'primary',
  size = 88,
  animate = false,
  className,
}: StampProps) {
  return (
    <span
      role="img"
      aria-label={caption ? `${text} ${caption}` : text}
      className={cn(
        'bg-surface/60 font-display inline-flex shrink-0 rotate-[-12deg] flex-col items-center justify-center rounded-full border-[3px] border-double font-bold',
        toneClass[tone],
        animate && 'animate-stamp',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <span
        className="leading-none tracking-wider"
        style={{ fontSize: Math.max(MIN_FONT_PX, Math.round(size * 0.2)) }}
      >
        {text}
      </span>
      {caption && (
        <span
          className="mt-1 leading-none opacity-80"
          style={{ fontSize: Math.max(MIN_FONT_PX, Math.round(size * 0.13)) }}
        >
          {caption}
        </span>
      )}
    </span>
  )
}
