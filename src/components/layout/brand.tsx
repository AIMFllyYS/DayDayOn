import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'

/** 品牌标识（占位）：珊瑚色圆角块 + 对勾。正式 logo 定稿后替换 */
export function BrandMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'bg-primary text-on-primary shadow-primary inline-flex shrink-0 rotate-[-6deg] items-center justify-center rounded-xl',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Icon name="check" size={Math.round(size * 0.6)} strokeWidth={3} />
    </span>
  )
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display text-heading font-semibold tracking-tight', className)}>
      DayDay<span className="text-primary">On</span>
    </span>
  )
}
