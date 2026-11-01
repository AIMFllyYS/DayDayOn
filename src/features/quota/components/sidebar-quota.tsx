'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { QuotaMeter } from '@/features/agent/components/quota-meter'
import { useQuery } from '@/lib/api'
import { quotaQuery } from '@/lib/api/queries/quota'

/*
 * 宽侧栏底部的 AI 额度（AppShell 的 sidebarFooter，ui-design-system.md 第 7 节）。
 * 只读；加载失败时不显示（不在导航里放错误态），额度详情和重试在「我的」页。
 * 外壳不读会话（进静态外壳）：这里的请求在浏览器端发出，未登录时由 fetcher 处理 401。
 */
export function SidebarQuota() {
  const quota = useQuery(quotaQuery())
  if (quota.status === 'pending') {
    return (
      <div
        className="border-border bg-surface flex flex-col gap-2 rounded-2xl border p-3"
        aria-hidden
      >
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    )
  }
  if (quota.status === 'error') return null
  const q = quota.data
  return (
    <QuotaMeter
      weeklyLimitMicro={q.weeklyLimitMicros}
      weeklyUsedMicro={q.weeklyLimitMicros - q.weeklyRemainingMicros}
      bonusMicro={q.bonusMicros}
      compact
    />
  )
}
