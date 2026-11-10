'use client'

import { useSyncExternalStore } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { QuotaMeter } from '@/features/agent/components/quota-meter'
import { useQuery } from '@/lib/api'
import { quotaQuery } from '@/lib/api/queries/quota'

/*
 * 宽侧栏底部的 AI 额度（AppShell 的 sidebarFooter，ui-design-system.md 第 7 节）。
 * 只在宽侧栏可见（≥ 1024px）时才发起请求，避免手机端隐藏侧栏白发一次首屏 /api/v1/quota 请求。
 * 只读；加载失败时不显示（不在导航里放错误态），额度详情和重试在「我的」页。
 */

const LG_MEDIA = '(min-width: 1024px)'

function subscribeLg(onStoreChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mql = window.matchMedia(LG_MEDIA)
  mql.addEventListener('change', onStoreChange)
  return () => mql.removeEventListener('change', onStoreChange)
}

function getLgSnapshot(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(LG_MEDIA).matches
}

export function SidebarQuota() {
  const isLg = useSyncExternalStore(subscribeLg, getLgSnapshot, () => false)
  const quota = useQuery({ ...quotaQuery(), enabled: isLg })
  if (!isLg) return null
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
