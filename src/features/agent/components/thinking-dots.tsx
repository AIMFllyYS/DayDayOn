import { cn } from '@/lib/cn'

/** 三个依次呼吸的小圆点：AI 正在生成时使用，颜色跟随 currentColor */
export function ThinkingDots({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="生成中"
      className={cn('inline-flex items-center gap-1 align-middle', className)}
    >
      {[0, 160, 320].map((delay) => (
        <span
          key={delay}
          className="animate-breathe size-1.5 rounded-full bg-current"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  )
}
