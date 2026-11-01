import { EmptyState } from '@/components/ui/empty-state'

/** 占位页内容（F3）：领域 Agent 实现页面时整页替换掉 */
export function ComingSoon() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <EmptyState title="这里很快就好" description="团团正在努力搭建这一页" />
    </div>
  )
}
