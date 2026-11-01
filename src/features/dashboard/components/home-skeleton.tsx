import { Skeleton } from '@/components/ui/skeleton'

/** 主页加载骨架：形状接近真实的卡片排布（ui-design-system.md 第 6 节） */
export function HomeSkeleton() {
  return (
    <div
      role="status"
      aria-label="加载中"
      className="grid gap-3 pb-8 @xl:grid-cols-[1.25fr_1fr] @xl:gap-4"
    >
      <div className="grid content-start gap-3">
        <Skeleton className="h-30 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-52 w-full rounded-2xl" />
      </div>
      <div className="grid content-start gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    </div>
  )
}
