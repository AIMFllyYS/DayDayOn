'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'

export const playbookPages = [
  { href: '/dev/playbook', label: '总览' },
  { href: '/dev/playbook/foundations', label: '色彩与字体' },
  { href: '/dev/playbook/motion', label: '动效' },
  { href: '/dev/playbook/components', label: '原子组件' },
  { href: '/dev/playbook/navigation', label: '导航与布局' },
  { href: '/dev/playbook/pet', label: '小宠物' },
  { href: '/dev/playbook/agent', label: 'Agent 组件' },
] as const

/** 手机端横向滚动的标签，桌面端竖排在左侧 */
export function PlaybookNav() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Playbook 目录"
      className="-mx-4 [scrollbar-width:none] overflow-x-auto px-4 md:mx-0 md:px-0"
    >
      <ul className="flex gap-1.5 md:flex-col">
        {playbookPages.map((p) => {
          const active = pathname === p.href
          return (
            <li key={p.href} className="shrink-0">
              <Link
                href={p.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'text-caption flex h-10 items-center rounded-full px-4 font-semibold whitespace-nowrap transition-colors duration-(--dur-fast) md:rounded-xl',
                  active
                    ? 'bg-primary-soft text-primary-ink'
                    : 'text-muted hover:bg-surface-sunken hover:text-foreground',
                )}
              >
                {p.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
