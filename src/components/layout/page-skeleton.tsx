import { Skeleton } from '@/components/ui/skeleton'

/** 页面加载骨架：会话校验和页面数据到达前占位（顶栏标题 + 两张卡片） */
export function PageSkeleton() {
  return (
    <div
      role="status"
      aria-label="加载中"
      className="flex flex-col gap-4 px-4 pt-[calc(var(--safe-top)+1rem)] md:px-8 md:pt-6"
    >
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-36 w-full rounded-3xl" />
      <Skeleton className="h-24 w-full rounded-3xl" />
    </div>
  )
}
