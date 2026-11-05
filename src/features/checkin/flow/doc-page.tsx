'use client'

import { useState, type ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Icon, type IconName } from '@/components/ui/icon'
import { IconButton } from '@/components/ui/button'
import { softToneClass, type Tone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
import { Collapse } from './folder-card'
import type { DocPageSpec } from './types'

/*
 * 打卡页的二级页（达标规则 / 评判依据）与顶部返回栏（Playbook phone-flow 的 DocBody、PageBar）。
 * 速览卡 + 编号分组，默认只展开第一组，进来不用先啃一大片字。
 */

/** 顶部返回栏：安卓规范的紧凑样式，返回箭头 + 小标题 */
export function PageBar({
  title,
  onBack,
  action,
}: {
  title: string
  onBack: () => void
  action?: ReactNode
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 px-2.5 pt-[calc(var(--safe-top)+0.75rem)] pb-2 md:pt-4">
      <IconButton icon="chevron-left" label="返回" size="sm" onClick={onBack} />
      <h2 className="text-subhead min-w-0 flex-1 truncate font-bold">{title}</h2>
      {action}
    </div>
  )
}

/** 速览：门槛一句话 + 盖章 / 存档两行 */
export interface DocGlance {
  threshold: string
  tagline: string
  pass: string
  block: string
}

export function DocBody({
  doc,
  glance,
  kind,
}: {
  doc: DocPageSpec
  glance: DocGlance
  kind: 'rules' | 'basis'
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3.5 pb-6">
      <Card className="flex flex-col gap-2.5 p-3">
        <div className="flex items-start gap-2">
          <Icon
            name={kind === 'rules' ? 'shield' : 'bulb'}
            size={15}
            className="text-primary-ink mt-0.5 shrink-0"
          />
          <p className="text-caption leading-snug font-bold">
            {kind === 'rules' ? glance.threshold : glance.tagline}
          </p>
        </div>
        {kind === 'rules' ? (
          <div className="border-border flex flex-col gap-1.5 border-t border-dashed pt-2.5">
            <GlanceLine tone="success" label="盖章" text={glance.pass} />
            <GlanceLine tone="warning" label="存档" text={glance.block} />
          </div>
        ) : (
          <p className="text-tiny text-muted border-border border-t border-dashed pt-2.5">
            评分依据共 {doc.sections.length} 组，点开查看
          </p>
        )}
      </Card>
      {doc.sections.map((sec, i) => (
        <DocGroup key={sec.heading} index={i + 1} heading={sec.heading} items={sec.items} />
      ))}
      <p className="text-tiny text-subtle flex items-center gap-1 px-1 pt-1">
        <Icon name="alert" size={12} />
        估算结果，非医疗建议
      </p>
    </div>
  )
}

function GlanceLine({ tone, label, text }: { tone: Tone; label: string; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={cn(
          'text-tiny mt-px shrink-0 rounded-md px-1.5 py-0.5 leading-none font-bold',
          softToneClass[tone],
        )}
      >
        {label}
      </span>
      <span className="text-tiny text-muted leading-snug">{text}</span>
    </div>
  )
}

/** 一组条目：编号 + 标题 + 条数；「名称：说明」的条目把名称加粗 */
function DocGroup({ index, heading, items }: { index: number; heading: string; items: string[] }) {
  const [open, setOpen] = useState(index === 1)
  return (
    <section className="border-border bg-surface min-w-0 rounded-lg border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left"
      >
        <span className="bg-primary-soft text-primary-ink text-tiny grid size-5 shrink-0 place-items-center rounded-md leading-none font-bold">
          {index}
        </span>
        <span className="text-caption min-w-0 flex-1 truncate font-bold">{heading}</span>
        <span className="text-tiny text-subtle shrink-0">{items.length} 条</span>
        <Icon
          name="chevron-down"
          size={14}
          className={cn(
            'text-subtle shrink-0 transition-transform duration-(--dur-base)',
            open && 'rotate-180',
          )}
        />
      </button>
      <Collapse open={open}>
        <ul className="flex flex-col gap-1.5 px-3 pb-3">
          {items.map((it) => {
            const at = it.indexOf('：')
            const term = at > 0 && at <= 10 ? it.slice(0, at) : null
            return (
              <li key={it} className="text-tiny text-muted flex items-start gap-2 leading-snug">
                <span aria-hidden className="bg-primary mt-1.5 size-1 shrink-0 rounded-full" />
                <span>
                  {term && <b className="text-foreground font-bold">{term}：</b>}
                  {term ? it.slice(at + 1) : it}
                </span>
              </li>
            )
          })}
        </ul>
      </Collapse>
    </section>
  )
}

/** 标题行里的小标签：点开进二级文档页 */
export function TagChip({
  icon,
  label,
  tone,
  onClick,
}: {
  icon: IconName
  label: string
  tone: Tone
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-0.5 rounded-full px-2 text-[0.6875rem] leading-none font-semibold whitespace-nowrap transition-all hover:brightness-95 active:scale-95',
        softToneClass[tone],
      )}
    >
      <Icon name={icon} size={10} />
      {label}
    </button>
  )
}
