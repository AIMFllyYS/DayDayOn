'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { IconTile } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { moduleMeta, softToneClass } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
import { Rules } from '../../_components/section'
import { MODULE_SPECS, type ModuleSpec } from '../_data/module-specs'

/**
 * 板块子页的统一骨架：
 *   Hero（定位 + 板块切换 + 裁判速览） → 吸顶四段 Tab → 一次只看一个面板。
 * 手机上一屏只展示一块内容，不再 6–10 屏长滚动；桌面上 Hero 左右分栏。
 */

type PanelId = 'sandbox' | 'compare' | 'rules' | 'guide'

const TAB_OPTIONS = [
  { value: 'sandbox', label: '整页稿' },
  { value: 'compare', label: '判例' },
  { value: 'rules', label: '规则' },
  { value: 'guide', label: '守则' },
] as const

interface ModulePageProps {
  spec: ModuleSpec
  /** 整页沙盒 */
  sandbox: ReactNode
  /** 判例对比 */
  compare: ReactNode
  /** 规则设计演示 */
  rules: ReactNode
}

export function ModulePage({ spec, sandbox, compare, rules }: ModulePageProps) {
  const [tab, setTab] = useState<PanelId>('sandbox')
  const slug = spec.slug

  return (
    <>
      <ModuleHero spec={spec} />

      <div className="bg-background/90 sticky top-0 z-20 -mx-4 mb-5 px-4 py-2.5 backdrop-blur md:mx-0 md:rounded-2xl md:px-0">
        <SegmentedControl
          label="板块内容分段"
          options={TAB_OPTIONS}
          value={tab}
          onValueChange={setTab}
        />
      </div>

      <Panel
        id="sandbox"
        active={tab}
        ann={`playbook.modules.${slug}.sandbox`}
        summary={spec.summaries.sandbox}
        detail={spec.details.sandbox}
      >
        {sandbox}
      </Panel>
      <Panel
        id="compare"
        active={tab}
        ann={`playbook.modules.${slug}.verdict`}
        summary={spec.summaries.compare}
        detail={spec.details.compare}
      >
        {compare}
      </Panel>
      <Panel
        id="rules"
        active={tab}
        ann={`playbook.modules.${slug}.rules-demo`}
        summary={spec.summaries.rules}
        detail={spec.details.rules}
      >
        {rules}
      </Panel>
      <Panel
        id="guide"
        active={tab}
        ann={`playbook.modules.${slug}.guidelines`}
        summary="做与不做"
        docRef={spec.docRef}
      >
        <Rules dos={spec.dos} donts={spec.donts} />
      </Panel>
    </>
  )
}

function ModuleHero({ spec }: { spec: ModuleSpec }) {
  const meta = moduleMeta[spec.tone]
  return (
    <header
      data-ann={`playbook.modules.${spec.slug}.hero`}
      className="animate-fade-up mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-end"
    >
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center gap-3">
          <IconTile icon={meta.icon} tone={spec.tone} size="lg" />
          <div className="min-w-0">
            <h1 className="text-display truncate font-bold">{spec.title}</h1>
            <p className="text-caption text-muted">{spec.tagline}</p>
          </div>
        </div>
        <ModuleSwitcher current={spec.slug} />
      </div>
      <VerdictGlance spec={spec} />
    </header>
  )
}

/** 五个板块一排切换：手机上一拇指够得到，不用再去横滚目录 */
function ModuleSwitcher({ current }: { current: string }) {
  return (
    <nav aria-label="切换打卡板块" className="grid grid-cols-5 gap-1.5">
      {MODULE_SPECS.map((m) => {
        const active = m.slug === current
        return (
          <Link
            key={m.slug}
            href={`/dev/playbook/modules/${m.slug}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'text-tiny flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border px-1 font-semibold transition-colors duration-(--dur-fast)',
              active
                ? cn(softToneClass[m.tone], 'border-transparent font-bold')
                : 'border-border bg-surface text-muted hover:text-foreground',
            )}
          >
            <Icon name={moduleMeta[m.tone].icon} size={18} />
            {m.short}
          </Link>
        )
      })}
    </nav>
  )
}

/** 裁判速览：门槛 / 盖章 / 拦截，三行说完 */
export function VerdictGlance({ spec, className }: { spec: ModuleSpec; className?: string }) {
  return (
    <Card
      data-ann={`playbook.modules.${spec.slug}.glance`}
      className={cn('flex flex-col gap-2.5 p-3.5', className)}
    >
      <div className="flex items-start gap-2">
        <Icon name="shield" size={16} className="text-primary-ink mt-0.5 shrink-0" />
        <p className="text-caption font-bold">{spec.threshold}</p>
      </div>
      <div className="border-border flex flex-col gap-2 border-t border-dashed pt-2.5">
        <GlanceRow tone="success" label="盖章" text={spec.pass} />
        <GlanceRow tone="warning" label="存档" text={spec.block} />
      </div>
    </Card>
  )
}

function GlanceRow({
  tone,
  label,
  text,
}: {
  tone: 'success' | 'warning'
  label: string
  text: string
}) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={cn(
          'text-tiny mt-px shrink-0 rounded-md px-1.5 py-0.5 font-bold',
          softToneClass[tone],
        )}
      >
        {label}
      </span>
      <span className="text-tiny text-muted leading-snug">{text}</span>
    </div>
  )
}

interface PanelProps {
  id: PanelId
  active: PanelId
  ann: string
  summary: string
  /** 折叠的设计说明 */
  detail?: string
  docRef?: string
  children: ReactNode
}

/** 面板：未选中时用 hidden 保留内部状态，切回来沙盒不会重置 */
function Panel({ id, active, ann, summary, detail, docRef, children }: PanelProps) {
  return (
    <section data-ann={ann} hidden={id !== active} className="mb-12 scroll-mt-20">
      <div className="mb-4 flex flex-col gap-1.5">
        <p className="text-caption text-muted">{summary}</p>
        {detail && (
          <details className="group">
            <summary className="text-tiny text-primary-ink inline-flex min-h-8 cursor-pointer list-none items-center gap-1 font-semibold select-none">
              设计说明
              <Icon
                name="chevron-down"
                size={13}
                className="transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="text-tiny text-muted bg-surface-sunken mt-1 max-w-2xl rounded-xl p-3 leading-relaxed">
              {detail}
            </p>
          </details>
        )}
        {docRef && <p className="text-tiny text-subtle font-mono">docs/conventions/{docRef}</p>}
      </div>
      {children}
    </section>
  )
}
