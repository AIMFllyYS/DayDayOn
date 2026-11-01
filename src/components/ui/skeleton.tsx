import { cn } from '@/lib/cn'

/** 骨架屏：形状由调用方用 className 决定（高度、宽度、圆角） */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('animate-shimmer bg-shimmer block rounded-lg', className)} />
  )
}
