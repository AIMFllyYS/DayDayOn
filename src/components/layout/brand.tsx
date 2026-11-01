import { cn } from '@/lib/cn'
import { logoSvg } from './logo-svg'

// 构建时算好一次：内容是常量 SVG，不含用户输入
const MARK_HTML = logoSvg('mark')

/**
 * 品牌标识（ADR-0022）：团团大头的 App 图标，与标签页图标、App 图标同源（logo-svg.ts）。
 * 稍微歪一点，像贴在手账上的贴纸。
 */
export function BrandMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'shadow-soft inline-flex shrink-0 rotate-[-6deg] overflow-hidden rounded-[22%] [&>svg]:size-full',
        className,
      )}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: MARK_HTML }}
    />
  )
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display text-heading font-semibold tracking-tight', className)}>
      DayDay<span className="text-primary">On</span>
    </span>
  )
}
