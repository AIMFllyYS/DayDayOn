import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Mascot } from '@/components/mascot/mascot'
import type { MascotMood } from '@/components/mascot/mascot-svg'

interface EmptyStateProps {
  /** 一句话说明现在是什么情况，例如"今天还没有待办" */
  title: string
  /** 下一步可以做什么 */
  description?: string
  /** 一般是一个 Button 或 Link，例如"去设定目标" */
  action?: ReactNode
  mood?: MascotMood
  /** compact 用于卡片内部（小团团、横向更紧凑），默认用于整页 / 整块 */
  size?: 'md' | 'compact'
  className?: string
}

/** 空状态：团团 + 文案 + 可选操作（PRD 7.1：每个页面都有空状态） */
export function EmptyState({
  title,
  description,
  action,
  mood = 'happy',
  size = 'md',
  className,
}: EmptyStateProps) {
  const compact = size === 'compact'
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        compact ? 'gap-2 py-4' : 'gap-3 py-8',
        className,
      )}
    >
      <Mascot mood={mood} size={compact ? 64 : 104} floating={!compact} />
      <div className="flex max-w-xs flex-col gap-1">
        <p className={cn('font-bold', compact ? 'text-subhead' : 'text-heading')}>{title}</p>
        {description && <p className="text-caption text-muted">{description}</p>}
      </div>
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}
