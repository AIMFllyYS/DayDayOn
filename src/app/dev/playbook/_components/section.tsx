import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface PageHeaderProps {
  title: string
  description: string
  /** 规范文档里对应的章节，例如"ui-design-system.md 第 3 节" */
  docRef?: string
}

export function PageHeader({ title, description, docRef }: PageHeaderProps) {
  return (
    <header className="animate-fade-up mb-8">
      <h1 className="text-display font-bold">{title}</h1>
      <p className="text-subhead text-muted mt-2 max-w-2xl">{description}</p>
      {docRef && <p className="text-tiny text-subtle mt-2 font-mono">docs/conventions/{docRef}</p>}
    </header>
  )
}

interface SectionProps {
  /** 批注定位用的 data-ann，格式 playbook.<页面>.<区块> */
  ann: string
  title: string
  description?: string
  children: ReactNode
  className?: string
}

/** Playbook 的一个章节。每个章节都有 data-ann，批注能稳定定位 */
export function Section({ ann, title, description, children, className }: SectionProps) {
  return (
    <section data-ann={ann} className={cn('mb-12 scroll-mt-8', className)}>
      <div className="border-border-strong mb-4 flex items-baseline gap-3 border-b border-dashed pb-2">
        <h2 className="text-heading font-bold">{title}</h2>
        <span className="text-tiny text-subtle font-mono">{ann}</span>
      </div>
      {description && <p className="text-caption text-muted -mt-1 mb-4 max-w-2xl">{description}</p>}
      {children}
    </section>
  )
}

interface SpecimenProps {
  ann: string
  label: string
  /** 用法说明：什么时候用、什么时候不用 */
  note?: string
  children: ReactNode
  className?: string
  /** 展示区背景：paper 点阵 / surface 纯色 */
  bg?: 'paper' | 'surface'
}

/** 单个组件或变体的展示框：上方展示，下方标签和用法 */
export function Specimen({ ann, label, note, children, className, bg = 'surface' }: SpecimenProps) {
  return (
    <figure
      data-ann={ann}
      className="border-border flex flex-col overflow-hidden rounded-2xl border"
    >
      <div
        className={cn(
          'flex flex-1 flex-wrap items-center gap-3 p-5',
          bg === 'paper' ? 'bg-paper' : 'bg-surface',
          className,
        )}
      >
        {children}
      </div>
      <figcaption className="border-border bg-background border-t px-4 py-2.5">
        <p className="text-caption font-semibold">{label}</p>
        {note && <p className="text-tiny text-muted">{note}</p>}
      </figcaption>
    </figure>
  )
}

/** 规则清单：✓ 推荐 / ✕ 避免 */
export function Rules({ dos, donts }: { dos: string[]; donts?: string[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <ul className="bg-success-soft text-caption text-success-ink rounded-2xl p-4">
        {dos.map((d) => (
          <li key={d} className="flex gap-2 py-0.5">
            <span aria-hidden>✓</span>
            {d}
          </li>
        ))}
      </ul>
      {donts && (
        <ul className="bg-danger-soft text-caption text-danger-ink rounded-2xl p-4">
          {donts.map((d) => (
            <li key={d} className="flex gap-2 py-0.5">
              <span aria-hidden>✕</span>
              {d}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
