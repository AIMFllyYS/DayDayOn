'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'

/*
 * 后台导航（routing.md 第 2 节）：首页精确匹配，其余按前缀匹配，当前项 aria-current="page"。
 * usePathname 在预渲染时会挂起，使用处包在 <Suspense> 里，fallback 用 AdminNavLinks（不高亮）。
 */

export const ADMIN_NAV = [
  { href: '/admin', label: '额度监控' },
  { href: '/admin/users', label: '用户' },
  { href: '/admin/codes', label: '兑换码' },
  { href: '/admin/settings', label: '全站设置' },
] as const

function isActive(href: string, path: string | null): boolean {
  if (!path) return false
  return href === '/admin' ? path === '/admin' : path === href || path.startsWith(`${href}/`)
}

export function AdminNavLinks({ currentPath = null }: { currentPath?: string | null }) {
  return ADMIN_NAV.map((item) => {
    const active = isActive(item.href, currentPath)
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'text-caption flex h-11 shrink-0 items-center rounded-xl px-3 font-semibold transition-colors duration-(--dur-fast)',
          active
            ? 'bg-primary-soft text-primary-ink'
            : 'text-muted hover:bg-surface-sunken hover:text-foreground',
        )}
      >
        {item.label}
      </Link>
    )
  })
}

export function AdminNav() {
  const path = usePathname()
  return <AdminNavLinks currentPath={path} />
}
