import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IconTile } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'

export const metadata: Metadata = { title: '目录' }

const entries = [
  {
    href: '/dev/playbook',
    title: 'Playbook 设计系统',
    description: '字体、配色、动效、原子组件、导航、Agent 组件。新组件先在这里定稿，再用到页面上',
  },
] as const

export default function DevIndexPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <main className="bg-paper mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-10">
      <header>
        <p className="text-tiny text-muted font-semibold">只在开发环境可见</p>
        <h1 className="text-title font-bold">调试区</h1>
        <p className="text-caption text-muted">
          右下角的「批注」可以在任何调试页上给区块写修改意见，并导出 JSON。
        </p>
      </header>
      <ul className="flex flex-col gap-3">
        {entries.map((e) => (
          <li key={e.href}>
            <Link
              href={e.href}
              data-ann={`dev.index.${e.href}`}
              className="bg-surface shadow-card ease-spring flex items-center gap-4 rounded-2xl p-4 transition-transform duration-(--dur-base) hover:-translate-y-0.5"
            >
              <IconTile icon="custom" tone="primary" size="lg" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{e.title}</span>
                <span className="text-caption text-muted block">{e.description}</span>
              </span>
              <Icon name="chevron-right" className="text-subtle" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
