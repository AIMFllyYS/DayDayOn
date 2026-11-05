'use client'

import { useState, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'
import { ProgressBar } from '@/components/ui/progress'
import { softToneClass, type Tone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
import type { FolderRow, FolderSpec, ReportCheck } from './flow-types'

/**
 * 折叠区：用 grid-template-rows 0fr → 1fr 做高度动画，内容不用知道自己多高。
 * 收起时 inert，键盘和读屏都够不到里面。
 */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-(--dur-base) ease-out',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div className="min-h-0 overflow-hidden" inert={!open}>
        {children}
      </div>
    </div>
  )
}

/**
 * 文件夹卡片：小圆角整体卡片，左上角是「图标块 + 小标题」，右侧徽章与展开箭头，结论一行写在标题下。
 * 折叠时主体只剩一行结论；展开后看明细（数值行、进度条、清单、嵌套的子文件夹）。
 * 嵌套的子文件夹（compact）用凹陷底、更小的圆角，像文件夹里的文件。
 */
export function FolderCard({
  spec,
  compact = false,
  defaultOpen = false,
}: {
  spec: FolderSpec
  compact?: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const tone: Tone = spec.tone ?? 'primary'
  const hasBody = Boolean(
    spec.rows?.length || spec.children?.length || spec.checks?.length || spec.note,
  )

  const header = (
    <button
      type="button"
      aria-expanded={open}
      disabled={!hasBody}
      onClick={() => setOpen((v) => !v)}
      className={cn(
        'flex w-full min-w-0 items-center gap-2 text-left',
        compact ? 'min-h-12 px-3 py-2' : 'min-h-14 px-3 py-2.5',
      )}
    >
      {compact ? (
        <Icon name={spec.icon} size={16} className="text-muted shrink-0" />
      ) : (
        <span
          className={cn('grid size-8 shrink-0 place-items-center rounded-md', softToneClass[tone])}
        >
          <Icon name={spec.icon} size={16} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        {compact ? (
          <span className="text-caption truncate font-bold">{spec.title}</span>
        ) : (
          <span className="text-tiny text-muted font-semibold">{spec.title}</span>
        )}
        <span
          className={cn(
            'leading-snug',
            compact ? 'text-tiny text-muted truncate' : 'text-caption font-bold',
          )}
        >
          {spec.headline}
        </span>
      </span>
      {spec.badge && <Badge tone={spec.badge.tone}>{spec.badge.text}</Badge>}
      {hasBody && (
        <Icon
          name="chevron-down"
          size={16}
          className={cn(
            'text-subtle shrink-0 transition-transform duration-(--dur-base)',
            open && 'rotate-180',
          )}
        />
      )}
    </button>
  )

  const body = (
    <Collapse open={open}>
      <div className={cn('flex flex-col gap-3 pb-3.5', compact ? 'px-3' : 'px-3')}>
        {spec.rows && spec.rows.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {spec.rows.map((r) => (
              <FolderRowView key={r.label} row={r} />
            ))}
          </ul>
        )}
        {spec.children && spec.children.length > 0 && (
          <div className="flex flex-col gap-2">
            {spec.children.map((c) => (
              <FolderCard key={c.id} spec={c} compact defaultOpen={c.defaultOpen} />
            ))}
          </div>
        )}
        {spec.checks && spec.checks.length > 0 && <CheckList checks={spec.checks} />}
        {spec.note && <p className="text-tiny text-muted leading-relaxed">{spec.note}</p>}
      </div>
    </Collapse>
  )

  if (compact) {
    return (
      <div
        className="bg-surface-sunken min-w-0 rounded-md"
        data-ann={`playbook.modules.flow.folder.${spec.id}`}
      >
        {header}
        {body}
      </div>
    )
  }

  return (
    <section className="min-w-0" data-ann={`playbook.modules.flow.folder.${spec.id}`}>
      <div className="border-border bg-surface shadow-soft rounded-lg border">
        {header}
        {body}
      </div>
    </section>
  )
}

function FolderRowView({ row }: { row: FolderRow }) {
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-tiny text-muted">{row.label}</span>
        <span className="text-caption font-display font-bold tabular-nums">{row.value}</span>
      </div>
      {row.ratio !== undefined && (
        <ProgressBar
          value={Math.min(100, Math.round(row.ratio * 100))}
          tone={row.tone ?? 'primary'}
          size="sm"
          label={row.label}
        />
      )}
      {row.sub && <span className="text-tiny text-subtle">{row.sub}</span>}
    </li>
  )
}

/** 校验清单：逐项打勾；未通过的项用警告色，不用红叉吓人 */
export function CheckList({ checks }: { checks: ReportCheck[] }) {
  return (
    <ul className="flex flex-col gap-2" aria-label="校验清单">
      {checks.map((c) => (
        <li key={c.text} className="flex items-start gap-2">
          <span
            className={cn(
              'mt-px flex size-5 shrink-0 items-center justify-center rounded-full',
              c.ok ? softToneClass.success : softToneClass.warning,
            )}
          >
            <Icon name={c.ok ? 'check' : 'alert'} size={12} strokeWidth={2.6} />
          </span>
          <span className="min-w-0">
            <span className="text-tiny text-foreground block leading-snug font-semibold">
              {c.text}
            </span>
            {c.source && (
              <span className="text-tiny text-subtle block leading-snug">{c.source}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}
