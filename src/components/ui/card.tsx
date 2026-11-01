import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type CardVariant = 'plain' | 'sticker' | 'sunken' | 'outline'

const variantClass: Record<CardVariant, string> = {
  // 默认卡片：纸面 + 柔和阴影
  plain: 'bg-surface shadow-card',
  // 贴纸卡片：白描边 + 投影，像贴在手账上；用于主页重点卡片，一屏不超过两张
  sticker: 'bg-surface shadow-sticker',
  // 凹陷区：卡片内的分组、输入区、代码块
  sunken: 'bg-surface-sunken',
  // 描边卡片：列表项、可选项
  outline: 'bg-surface border border-border',
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  /** 是否可点击：加悬停上浮和按压反馈 */
  interactive?: boolean
}

export function Card({ variant = 'plain', interactive = false, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl p-4 md:p-5',
        variantClass[variant],
        interactive &&
          'ease-spring hover:shadow-float cursor-pointer transition-[transform,box-shadow] duration-(--dur-base) hover:-translate-y-0.5 active:scale-[0.98]',
        className,
      )}
      {...rest}
    />
  )
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
}

export function CardHeader({ title, description, className, children, ...rest }: CardHeaderProps) {
  return (
    <div className={cn('mb-3 flex items-start justify-between gap-3', className)} {...rest}>
      <div className="min-w-0">
        <h3 className="text-subhead font-bold">{title}</h3>
        {description && <p className="text-caption text-muted">{description}</p>}
      </div>
      {children}
    </div>
  )
}
