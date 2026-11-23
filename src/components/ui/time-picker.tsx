'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

const ITEM = 32
const GAP = 4

/** 一列可滚动的数字：打开或外部变更时把当前值对齐到正中，滚动条完全隐藏；加 data-base-ui-swipe-ignore 避免在 Drawer 内触发下滑关闭 */
function Column({
  items,
  current,
  label,
  onPick,
}: {
  items: string[]
  current: string
  label: string
  onPick: (v: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(false)
  useEffect(() => {
    const el = ref.current
    const idx = items.indexOf(current)
    if (!el || idx < 0) return
    // 容器 h-28(112px)、上下 py-10(40px)、单项 32px + gap 4px，idx * 36 刚好将第 idx 项居中
    const targetTop = idx * (ITEM + GAP)
    if (!mountedRef.current) {
      el.scrollTop = targetTop
      mountedRef.current = true
    } else if (Math.abs(el.scrollTop - targetTop) > 2) {
      el.scrollTo({ top: targetTop, behavior: 'smooth' })
    }
  }, [current, items])
  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      data-base-ui-swipe-ignore
      className="flex h-28 flex-1 snap-y snap-mandatory [scrollbar-width:none] flex-col gap-1 overflow-y-auto overscroll-contain py-10 [&::-webkit-scrollbar]:hidden"
    >
      {items.map((it) => (
        <button
          key={it}
          type="button"
          role="option"
          aria-selected={it === current}
          onClick={() => onPick(it)}
          className={cn(
            'text-caption min-h-8 shrink-0 snap-center rounded-md font-semibold tabular-nums transition-colors',
            it === current
              ? 'bg-primary-soft text-primary-ink'
              : 'text-muted hover:text-foreground',
          )}
        >
          {it}
        </button>
      ))}
    </div>
  )
}

/** 共享时间选择器：时、分两列滚动选择（分钟精确到 1 分）。饮食加餐、睡眠入睡/起床、待办 DDL 共用 */
export function TimePicker({
  value,
  onChange,
  label,
  tone = 'primary',
  className,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  /** 选中项的颜色 */
  tone?: 'primary' | 'diet' | 'sleep'
  className?: string
}) {
  const [h = '00', m = '00'] = value.split(':')
  const pick = (hh: string, mm: string) => onChange(`${hh}:${mm}`)
  return (
    <div
      data-base-ui-swipe-ignore
      className={cn(
        'bg-surface-sunken flex items-center gap-1 rounded-xl px-2',
        tone === 'diet' &&
          '[&_[aria-selected=true]]:bg-diet-soft [&_[aria-selected=true]]:text-diet-ink',
        tone === 'sleep' &&
          '[&_[aria-selected=true]]:bg-sleep-soft [&_[aria-selected=true]]:text-sleep-ink',
        className,
      )}
      role="group"
      aria-label={label}
    >
      <Column items={HOURS} current={h} label="时" onPick={(v) => pick(v, m)} />
      <span className="text-subhead text-muted font-bold">:</span>
      <Column items={MINUTES} current={m} label="分" onPick={(v) => pick(h, v)} />
    </div>
  )
}
