import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { Icon, type IconName } from './icon'
import { softToneClass, solidToneClass, type Tone } from './tone'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  icon?: IconName
  /** 左侧小圆点，用于状态（进行中 / 已完成） */
  dot?: boolean
  size?: 'sm' | 'md'
}

export function Badge({
  tone = 'neutral',
  icon,
  dot = false,
  size = 'sm',
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap',
        size === 'sm' ? 'text-tiny h-6 px-2.5' : 'text-caption h-8 px-3',
        softToneClass[tone],
        className,
      )}
      {...rest}
    >
      {dot && <span className={cn('size-1.5 rounded-full', solidToneClass[tone])} />}
      {icon && <Icon name={icon} size={size === 'sm' ? 13 : 15} strokeWidth={2.2} />}
      {children}
    </span>
  )
}

interface IconTileProps {
  icon: IconName
  tone?: Tone
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const tileSize = {
  sm: { box: 'size-8 rounded-lg', icon: 16 },
  md: { box: 'size-10 rounded-xl', icon: 20 },
  lg: { box: 'size-12 rounded-2xl', icon: 24 },
} as const

/** 图标底座：板块图标、工具图标都放在这个圆角方块里 */
export function IconTile({ icon, tone = 'neutral', size = 'md', className }: IconTileProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        tileSize[size].box,
        softToneClass[tone],
        className,
      )}
    >
      <Icon name={icon} size={tileSize[size].icon} />
    </span>
  )
}
