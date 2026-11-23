import { PageSkeleton } from '@/components/layout/page-skeleton'

/** 根级路由加载占位：与全站骨架屏规范统一，使用内容形状扫光而非转圈 */
export default function Loading() {
  return <PageSkeleton />
}
