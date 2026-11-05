'use client'

import { useRef, type ReactNode } from 'react'
import { Badge, IconTile } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'
import type { ModuleTone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
import { Collapse } from './folder-card'
import type { FillSectionSpec } from './types'

/**
 * 填写页的折叠分区：一次只展开一个，其余收成一行（图标 + 名称 + 当前值）。
 * 这样填写页永远在一屏之内，不用上下来回滚；内容再长也只是展开的那一块变高。
 */
export function FillSection({
  spec,
  tone,
  open,
  ai,
  onToggle,
}: {
  spec: FillSectionSpec
  tone: ModuleTone
  open: boolean
  /** 这一项是 AI 识别填入的 */
  ai: boolean
  onToggle: () => void
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fired = useRef(false)
  const hold = spec.onLongPress
  function clear() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  return (
    <div
      data-ann={`playbook.modules.flow.section.${spec.id}`}
      className={cn(
        'bg-surface min-w-0 rounded-2xl border transition-colors duration-(--dur-fast)',
        open ? 'border-border-strong shadow-soft' : 'border-border',
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          if (fired.current) {
            fired.current = false
            return
          }
          onToggle()
        }}
        onContextMenu={
          hold
            ? (e) => {
                e.preventDefault()
                hold()
              }
            : undefined
        }
        onPointerDown={
          hold
            ? (e) => {
                if (e.pointerType === 'mouse') return
                fired.current = false
                timer.current = setTimeout(() => {
                  fired.current = true
                  hold()
                }, 550)
              }
            : undefined
        }
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2 text-left"
      >
        <IconTile icon={spec.icon} tone={tone} size="sm" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-caption font-bold">{spec.label}</span>
          <span className={cn('text-tiny truncate', spec.filled ? 'text-muted' : 'text-subtle')}>
            {spec.summary}
          </span>
        </span>
        {ai && spec.filled && (
          <Badge tone="primary" icon="sparkles">
            AI
          </Badge>
        )}
        {spec.filled && !ai && <Icon name="check" size={16} className="text-success shrink-0" />}
        <Icon
          name="chevron-down"
          size={16}
          className={cn(
            'text-subtle shrink-0 transition-transform duration-(--dur-base)',
            open && 'rotate-180',
          )}
        />
      </button>
      <Collapse open={open}>
        <div className="flex flex-col gap-3 px-3.5 pb-3.5">{spec.content as ReactNode}</div>
      </Collapse>
    </div>
  )
}

/** 分区里的一行：小标签 + 控件，控件一律独占一行（手机宽度下不并排） */
export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-tiny text-muted font-semibold">{label}</span>
      {children}
    </div>
  )
}
