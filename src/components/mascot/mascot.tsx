import { cn } from '@/lib/cn'
import { mascotMoods, MascotSvg, type MascotMood } from './mascot-svg'

const moodLabel = new Map(mascotMoods.map((m) => [m.mood, m.label]))

interface MascotProps {
  mood?: MascotMood
  size?: number
  /** 轻微上下浮动，用于空状态和加载页 */
  floating?: boolean
  className?: string
}

/** 静态团团：空状态、对话头像、插画位。需要互动时用 <InteractivePet> */
export function Mascot({ mood = 'happy', size = 96, floating = false, className }: MascotProps) {
  return (
    <span className={cn('inline-flex shrink-0', floating && 'animate-float', className)}>
      <MascotSvg mood={mood} size={size} label={`团团：${moodLabel.get(mood) ?? ''}`} />
    </span>
  )
}
