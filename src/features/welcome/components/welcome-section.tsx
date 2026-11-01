import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** 落地页的一个区块：小标题 + 大标题 + 说明 + 内容，进场 fade-up */
export function WelcomeSection({
  id,
  ann,
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  id: string
  ann: string
  eyebrow: string
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      data-ann={ann}
      aria-labelledby={`${id}-title`}
      className={cn('scroll-mt-20 py-10', className)}
    >
      <p className="text-tiny text-primary-ink font-semibold tracking-wider">{eyebrow}</p>
      <h2 id={`${id}-title`} className="text-title mt-1 font-bold">
        {title}
      </h2>
      {description && <p className="text-body text-muted mt-2 max-w-xl">{description}</p>}
      <div className="mt-6">{children}</div>
    </section>
  )
}
