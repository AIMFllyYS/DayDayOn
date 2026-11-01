import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense, type ReactNode } from 'react'
import { BrandMark } from '@/components/layout/brand'
import { PageSkeleton } from '@/components/layout/page-skeleton'
import { ApiProvider } from '@/lib/api'
import { requireAdmin } from '@/server/auth'

export const metadata: Metadata = { robots: { index: false, follow: false } }

const adminNav = [
  { href: '/admin', label: '额度监控' },
  { href: '/admin/users', label: '用户' },
  { href: '/admin/codes', label: '兑换码' },
  { href: '/admin/settings', label: '全站设置' },
] as const

/*
 * 后台（routing.md 第 3 节）：独立布局，桌面优先。管理员校验放在 <Suspense> 里：
 * 未登录跳 /login，不是管理员跳 /。两步验证未开启时由页面显示绑定流程（PRD 7.1，D7）。
 * 侧栏高亮、两步验证页面等交互由 D7 替换。
 */
export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <ApiProvider>
      <div className="flex min-h-dvh flex-col md:flex-row">
        <nav
          aria-label="后台导航"
          className="border-border bg-surface/70 flex shrink-0 gap-1 overflow-x-auto border-b px-3 py-3 md:sticky md:top-0 md:h-dvh md:w-56 md:flex-col md:border-r md:border-b-0 md:py-5"
        >
          <div className="mr-2 flex items-center gap-2 px-1.5 md:mr-0 md:mb-4">
            <BrandMark size={28} />
            <span className="text-subhead font-bold">后台</span>
          </div>
          {adminNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-caption text-muted hover:bg-surface-sunken hover:text-foreground flex h-11 shrink-0 items-center rounded-xl px-3 font-semibold transition-colors duration-(--dur-fast)"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="flex min-w-0 flex-1 flex-col gap-4 px-4 py-6 md:px-8">
          <Suspense fallback={<PageSkeleton />}>
            <AdminGate>{children}</AdminGate>
          </Suspense>
        </main>
      </div>
    </ApiProvider>
  )
}

async function AdminGate({ children }: { children: ReactNode }) {
  await requireAdmin()
  return children
}
