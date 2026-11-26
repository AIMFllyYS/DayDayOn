'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ui/icon'
import { MarqueeText } from '@/components/ui/marquee-text'
import { summaryTitle } from '../format'
import { nextQuoteFromStorage, quoteBucketFor, shouldRefreshOnReturn } from '../quotes'

export interface DailyQuoteCardProps {
  completion: { done: number; planned: number }
  /** Playbook 静态预览或单测覆盖文案；传入时关闭 localStorage 洗牌与后台切回刷新 */
  staticQuote?: string
}

/**
 * 独立每日鼓励语（治愈语录）横条：
 * - 上下高度严格锁死为 50px（border 2px + py-2.5 20px + h-7 28px），长句在横条内条件横向滚动，绝不撑高；
 * - SSR 与客户端首帧渲染确定性默认句，避免 Hydration Mismatch 与 CLS；
 * - 客户端进入主页（冷启动/路由返回）及后台停留 ≥30 秒切回前台时，通过无重复洗牌队列更新语录。
 */
export function DailyQuoteCard({ completion, staticQuote }: DailyQuoteCardProps) {
  const bucket = quoteBucketFor(completion)
  const fallback = staticQuote ?? summaryTitle(completion)
  const [drawn, setDrawn] = useState<{ bucket: 'daily' | 'done'; text: string } | null>(null)
  const hiddenAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (staticQuote !== undefined) return
    let active = true

    const refresh = () => {
      if (!active) return
      const text = nextQuoteFromStorage(bucket)
      setDrawn({ bucket, text })
    }

    const frame = window.requestAnimationFrame(refresh)

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
      } else if (document.visibilityState === 'visible') {
        if (shouldRefreshOnReturn(hiddenAtRef.current, Date.now())) {
          refresh()
        }
        hiddenAtRef.current = null
      }
    }

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refresh()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      active = false
      window.cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [bucket, staticQuote])

  const displayText =
    staticQuote !== undefined ? staticQuote : drawn?.bucket === bucket ? drawn.text : fallback

  return (
    <div
      data-daily-quote="true"
      className="border-primary/20 bg-primary-soft/35 flex min-w-0 items-center gap-2.5 rounded-2xl border px-3.5 py-2.5"
    >
      <span
        aria-hidden="true"
        className="bg-primary/15 text-primary-ink inline-flex size-7 shrink-0 items-center justify-center rounded-full"
      >
        <Icon name="sparkles" size={14} lineOnly />
      </span>
      <MarqueeText text={displayText} textClassName="text-caption text-foreground font-semibold" />
    </div>
  )
}
