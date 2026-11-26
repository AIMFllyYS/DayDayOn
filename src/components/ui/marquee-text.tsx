'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { cn } from '@/lib/cn'

/*
 * 等高单行条件横向滚动文本（ui-design-system.md 第 6 节，Playbook /dev/playbook/components）。
 * - 固定单行高度（默认 h-7），无论文本多长绝不折行撑高容器；
 * - 通过 ResizeObserver + document.fonts.ready 实时测量单份内容宽度与视口宽度，仅溢出 > 2px 时启用双轨无缝滚动与边缘 mask 渐隐；
 * - 桌面悬停 / 手机按压暂停滚动；系统开启 prefers-reduced-motion 时关闭动画与克隆轨，降级为单行 truncate + title。
 */

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const OVERFLOW_THRESHOLD_PX = 2
const TRACK_GAP_PX = 48
const SCROLL_SPEED_PX_PER_SEC = 36
const MIN_DURATION_SEC = 8

function subscribeReducedMotion(onChange: () => void) {
  const mql = window.matchMedia(REDUCED_MOTION_QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  )
}

/** 按单段像素宽度 + 轨道间距计算恒速跑马灯周期（秒），避免短句过慢或长句飞驰 */
export function computeMarqueeDuration(
  contentWidthPx: number,
  gapPx = TRACK_GAP_PX,
  speedPxPerSec = SCROLL_SPEED_PX_PER_SEC,
): number {
  if (!Number.isFinite(contentWidthPx) || contentWidthPx <= 0) return MIN_DURATION_SEC
  const raw = (contentWidthPx + gapPx) / Math.max(1, speedPxPerSec)
  return Math.max(MIN_DURATION_SEC, Math.round(raw * 10) / 10)
}

export interface MarqueeTextProps {
  /** 要展示的单行文案 */
  text: string
  /** 外层视口容器类名（默认定高 h-7） */
  className?: string
  /** 文本样式类名（如 text-caption font-semibold text-foreground） */
  textClassName?: string
  /** 滚动速度（像素/秒），默认 36 */
  speedPxPerSec?: number
}

export function MarqueeText({
  text,
  className,
  textClassName,
  speedPxPerSec = SCROLL_SPEED_PX_PER_SEC,
}: MarqueeTextProps) {
  const reducedMotion = usePrefersReducedMotion()
  const viewportRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const [metrics, setMetrics] = useState<{ overflow: boolean; duration: number }>({
    overflow: false,
    duration: 14,
  })

  useEffect(() => {
    const viewport = viewportRef.current
    const measure = measureRef.current
    if (!viewport || !measure) return

    let active = true
    const update = () => {
      if (!active) return
      const vpW = viewport.clientWidth
      const contentW = measure.getBoundingClientRect().width
      const overflow = vpW > 0 && contentW - vpW > OVERFLOW_THRESHOLD_PX
      const duration = computeMarqueeDuration(contentW, TRACK_GAP_PX, speedPxPerSec)
      setMetrics((prev) =>
        prev.overflow === overflow && prev.duration === duration ? prev : { overflow, duration },
      )
    }

    const frame = window.requestAnimationFrame(update)
    const ro = new ResizeObserver(update)
    ro.observe(viewport)
    ro.observe(measure)
    void document.fonts?.ready.then(update)

    return () => {
      active = false
      window.cancelAnimationFrame(frame)
      ro.disconnect()
    }
  }, [text, speedPxPerSec])

  const shouldScroll = metrics.overflow && !reducedMotion
  const trackStyle = shouldScroll
    ? ({ '--marquee-duration': `${metrics.duration}s` } as CSSProperties)
    : undefined

  return (
    <div
      ref={viewportRef}
      data-marquee="true"
      data-marquee-active={shouldScroll ? 'true' : 'false'}
      title={metrics.overflow ? text : undefined}
      className={cn(
        'marquee-root relative flex h-7 min-w-0 flex-1 items-center overflow-hidden',
        shouldScroll && 'marquee-mask',
        className,
      )}
    >
      {reducedMotion ? (
        <span
          ref={measureRef}
          className={cn('block min-w-0 truncate whitespace-nowrap', textClassName)}
        >
          {text}
        </span>
      ) : (
        <div
          style={trackStyle}
          className={cn(
            'marquee-track flex w-max shrink-0 items-center',
            shouldScroll && 'animate-marquee-x will-change-transform',
          )}
        >
          <span ref={measureRef} className={cn('shrink-0 whitespace-nowrap', textClassName)}>
            {text}
          </span>
          {shouldScroll && (
            <>
              <span aria-hidden="true" className="inline-block w-12 shrink-0" />
              <span aria-hidden="true" className={cn('shrink-0 whitespace-nowrap', textClassName)}>
                {text}
              </span>
              <span aria-hidden="true" className="inline-block w-12 shrink-0" />
            </>
          )}
        </div>
      )}
    </div>
  )
}
