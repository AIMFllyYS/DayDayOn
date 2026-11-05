'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

const ITEM = 32
const GAP = 4

/** 一列可滚动的数字：打开时把当前值滚到中间，滚动条完全隐藏 */
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
  useEffect(() => {
    const el = ref.current
    const idx = items.indexOf(current)
    if (el && idx >= 0) el.scrollTop = idx * (ITEM + GAP) + GAP - (el.clientHeight - ITEM) / 2
    // 只在挂载时对齐一次，之后由用户自己滚
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      className="flex h-28 flex-1 [scrollbar-width:none] flex-col gap-1 overflow-y-auto py-1 [&::-webkit-scrollbar]:hidden"
    >
      {items.map((it) => (
        <button
          key={it}
          type="button"
          role="option"
          aria-selected={it === current}
          onClick={() => onPick(it)}
          className={cn(
            'text-caption min-h-8 shrink-0 rounded-md font-semibold tabular-nums transition-colors',
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

/** 自己的时间选择器：时、分两列滚动选择（分钟精确到 1 分）。饮食的加餐时间、睡眠的入睡 / 起床共用 */
export function TimePicker({
  value,
  onChange,
  label,
  tone,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  /** 选中项的颜色 */
  tone?: 'diet' | 'sleep'
}) {
  const [h = '00', m = '00'] = value.split(':')
  const pick = (hh: string, mm: string) => onChange(`${hh}:${mm}`)
  return (
    <div
      className={cn(
        'bg-surface-sunken flex items-center gap-1 rounded-lg px-2',
        tone === 'diet' &&
          '[&_[aria-selected=true]]:bg-diet-soft [&_[aria-selected=true]]:text-diet-ink',
        tone === 'sleep' &&
          '[&_[aria-selected=true]]:bg-sleep-soft [&_[aria-selected=true]]:text-sleep-ink',
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
