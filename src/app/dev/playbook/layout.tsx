import type { Metadata } from 'next'
import Link from 'next/link'
import { BrandMark } from '@/components/layout/brand'
import { PlaybookNav } from './_components/playbook-nav'

export const metadata: Metadata = {
  title: { default: 'Playbook', template: '%s · Playbook · DayDayOn' },
}

/*
 * Playbook：全站可复用设计的唯一展示处。
 * 规则：新的 token / 原子组件 / 交互模式先在这里加演示并定稿，再用到正式页面（ui-design-system.md 第 1 节）。
 */
export default function PlaybookLayout({ children }: LayoutProps<'/dev/playbook'>) {
  return (
    <div className="bg-paper flex min-h-dvh flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-[calc(var(--safe-top)+1.25rem)] pb-28 md:flex-row md:gap-10 md:px-8 md:pt-10">
        <aside className="flex flex-col gap-4 md:sticky md:top-10 md:h-fit md:w-52 md:shrink-0">
          <Link href="/dev" className="flex items-center gap-2.5">
            <BrandMark size={32} />
            <span className="leading-tight">
              <span className="font-display text-subhead block font-semibold">Playbook</span>
              <span className="text-tiny text-muted block">DayDayOn 设计系统 v0.1</span>
            </span>
          </Link>
          <PlaybookNav />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
